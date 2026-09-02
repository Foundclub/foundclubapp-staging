import {
  hideBlockedChats,
  hideBlockedMessages,
  isOneToOneChatWithBlockedUser,
  resolveOtherParticipantId,
} from '../userBlockFilters';

// BLOQUER — K4 : LE BLOCAGE CACHE, IL NE SUPPRIME PAS.
//
// 🔴 LA MESURE DU 2026-09-02, avant ce lot :
//   grep -rniE "bloquer cet utilisateur|blockUser|block-user|blocked_users" app/src
//   -> 0 occurrence. Une app avec une messagerie 1:1, des notes vocales et des
//   comptes de mineurs n'avait aucun moyen de bloquer une personne, alors que
//   les DEUX magasins l'exigent (Apple 1.2, Play « Contenu généré par les
//   utilisateurs »).
//
// ⚠️ CE FICHIER NE MESURE PAS LA BARRIERE. La vraie porte est au serveur
// (`canAccessChat` refuse d'écrire ET de lire — voir, côté admin,
// tests/authz/BLOQUER-le-serveur-refuse.test.js). Ici on vérifie seulement que
// l'ECRAN reste propre : pas de fil mort dans la liste, pas de message d'une
// personne bloquée dans un fil de groupe.
//
// 🧒 K5 — LA REGLE, ECRITE UNE FOIS ET LA MEME DES DEUX COTES :
//   LE BLOCAGE NE FERME QU'UNE DISCUSSION STRICTEMENT A DEUX.
//   Un enfant de moins de 13 ans n'est contactable qu'avec son parent dans le
//   fil (UserDetails.js, `handleContactUser`). Ce fil-là porte TROIS
//   participants : il ne disparaît jamais. Un enfant qui bloque son coach
//   n'éteint donc pas la discussion parent-coach.

const MOI = 'moi';
const BLOQUE = 'bloque';
const PARENT = 'parent';

const filAdeux = {
  documentId: 'chat-1a1',
  participants: [{ documentId: MOI }, { documentId: BLOQUE }],
  type: 'whisper',
};

const filATrois = {
  documentId: 'chat-mineur',
  participants: [{ documentId: MOI }, { documentId: BLOQUE }, { documentId: PARENT }],
  type: 'whisper',
};

const filDeClub = {
  club: { documentId: 'club-1' },
  documentId: 'chat-club',
  participants: [],
  type: 'club',
};

const filDeGroupe = {
  documentId: 'chat-groupe',
  groupName: 'Les U15',
  participants: [{ documentId: MOI }, { documentId: BLOQUE }, { documentId: PARENT }],
  type: 'group',
};

describe('BLOQUER · témoin A — la liste des discussions perd le tête-à-tête bloqué', () => {
  it('cache le fil strictement à deux avec une personne bloquée', () => {
    const restants = hideBlockedChats([filAdeux, filDeClub], MOI, [BLOQUE]);

    expect(restants.map((chat) => chat.documentId)).toEqual(['chat-club']);
  });

  it('ne touche à RIEN quand personne n\'est bloqué', () => {
    const tous = [filAdeux, filATrois, filDeClub, filDeGroupe];

    expect(hideBlockedChats(tous, MOI, [])).toHaveLength(4);
  });

  it('K5 — la discussion à trois du mineur et de son parent RESTE', () => {
    const restants = hideBlockedChats([filATrois, filDeGroupe], MOI, [BLOQUE]);

    expect(restants.map((chat) => chat.documentId))
      .toEqual(['chat-mineur', 'chat-groupe']);
  });

  it('ne ferme jamais un fil collectif', () => {
    expect(isOneToOneChatWithBlockedUser(filDeClub, MOI, [BLOQUE])).toBe(false);
    expect(isOneToOneChatWithBlockedUser(filDeGroupe, MOI, [BLOQUE])).toBe(false);
  });

  it('« strictement à deux » : qui est en face de moi', () => {
    expect(resolveOtherParticipantId(filAdeux, MOI)).toBe(BLOQUE);
    expect(resolveOtherParticipantId(filATrois, MOI)).toBe('');
    expect(resolveOtherParticipantId(filDeClub, MOI)).toBe('');
    expect(resolveOtherParticipantId(filAdeux, 'inconnu')).toBe('');
  });
});

describe('BLOQUER · témoin B — dans un fil collectif, les messages du bloqué disparaissent', () => {
  const messages = [
    { documentId: 'm1', message: 'bonjour', sender: { documentId: MOI } },
    { documentId: 'm2', message: 'insulte', sender: { documentId: BLOQUE } },
    { documentId: 'm3', message: 'reponse', sender: { documentId: PARENT } },
    // 🧾 Un message SYSTEME n'a pas d'expéditeur : il ne se cache jamais.
    { documentId: 'm4', message: 'match publie', sender: null },
  ];

  it('retire les bulles de la personne bloquée, et elles seules', () => {
    const restants = hideBlockedMessages(messages, [BLOQUE]);

    expect(restants.map((message) => message.documentId)).toEqual(['m1', 'm3', 'm4']);
  });

  it('K4 — la liste SOURCE n\'est jamais modifiée : rien n\'est supprimé', () => {
    hideBlockedMessages(messages, [BLOQUE]);

    expect(messages).toHaveLength(4);
    expect(messages[1].documentId).toBe('m2');
  });

  it('comprend aussi la forme gifted-chat (`user._id`)', () => {
    const bulles = [
      { _id: 'a', user: { _id: MOI } },
      { _id: 'b', user: { _id: BLOQUE } },
    ];

    // eslint-disable-next-line no-underscore-dangle -- forme imposée par gifted-chat
    const restants = hideBlockedMessages(bulles, [BLOQUE]).map((bulle) => bulle._id);

    expect(restants).toEqual(['a']);
  });
});

describe('BLOQUER · témoin C — le filtre est BRANCHÉ sur la liste des discussions', () => {
  // ⚠️ Ce témoin-ci est STRUCTUREL, et il le dit. Monter `Messaging.js` en
  // entier coûterait un harnais de 200 lignes pour une seule ligne de code ;
  // ce qu'on veut empêcher, c'est qu'elle soit DÉBRANCHÉE sans que rien ne
  // devienne rouge — exactement le défaut le plus cher du projet (du code
  // devenu inatteignable, que ni la relecture ni les portes n'attrapent).
  //
  // Le témoin équivalent pour la CONVERSATION, lui, est comportemental : il
  // monte le vrai écran et lit les bulles que GiftedChat reçoit
  // (src/views/__tests__/ConversationBLOQUER.menu.test.js, témoins B4 et B5).
  // eslint-disable-next-line global-require
  const fs = require('fs');
  // eslint-disable-next-line global-require
  const path = require('path');

  const lireSource = (chemin) => fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', chemin),
    'utf8',
  );

  it('Messaging.js retire les tête-à-tête bloqués de la liste', () => {
    const source = lireSource('views/Messaging.js');

    expect(source).toContain("from '@/domains/userBlock/userBlockFilters'");
    expect(source).toContain('hideBlockedChats(chats, userData?.documentId, blockedUserIds)');
  });

  it('Conversation.js retire les bulles des personnes bloquées', () => {
    const source = lireSource('views/Conversation.js');

    expect(source).toContain('hideBlockedMessages(');
  });
});
