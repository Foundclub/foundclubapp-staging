import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  abonnes,
  emettreDuServeur,
  envois,
  reinitialiserSocketDeTest,
} from '@/testSupport/msgliveSocketDouble';
import { creerQueryClientDeTest } from '@/testSupport/queryClientDeTest';

// MSGLIVE — « EST-CE QUE LES MESSAGES ARRIVENT VRAIMENT EN DIRECT ? »
//
// Adel demande (22/09) « les messages qui arrivent en direct ». Avant de
// changer quoi que ce soit, il fallait MESURER : quand l'autre envoie, est-ce
// que l'écran l'affiche par le fil téléphonique, ou seulement à la prochaine
// relecture du serveur ?
//
// 📏 CE QUE CE FICHIER MESURE, et pourquoi il est posé ICI et pas sur l'écran :
// `useMessaging.js` (1 403 lignes) n'avait AUCUN témoin. C'est pourtant lui qui
// tient le direct : à la réception de `message-received`, il écrit le message
// dans le cache de react-query (`setQueriesData`), et l'écran, qui lit ce même
// cache, se redessine. L'écran n'est qu'un spectateur — la couture est ici.
//
// ⚠️ LE PIÈGE QUE CES TÉMOINS VERROUILLENT : écrire dans le cache et INVALIDER
// le cache se ressemblent dans un diff, et ne font PAS la même chose. Invalider
// déclenche un aller-retour réseau : le message apparaîtrait après le trajet,
// pas tout de suite — et pas du tout si le téléphone est en zone blanche. Le
// témoin n°2 compte donc les appels réseau et EXIGE qu'il y en ait ZÉRO.

const mockGetChatMessages = jest.fn();
const mockCreateWhisperChat = jest.fn();
const mockGetChats = jest.fn(() => Promise.resolve({ data: [] }));
const mockUnarchiveChat = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/hooks/useSocket', () => ({
  __esModule: true,
  default: () => ({
    isConnected: true,
    // eslint-disable-next-line global-require
    socket: require('@/testSupport/msgliveSocketDouble').socketDeTest,
  }),
  EVENTS: jest.requireActual('@/hooks/useSocket').EVENTS,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: { documentId: 'moi', firstname: 'Adel' },
  }),
}));

jest.mock('@/services/chat/chatService', () => ({
  addGroupMembers: jest.fn(),
  archiveChat: jest.fn(),
  createClubChat: jest.fn(),
  createGroupChat: jest.fn(),
  createTeamChat: jest.fn(),
  createWhisperChat: mockCreateWhisperChat,
  deleteMessage: jest.fn(),
  editMessage: jest.fn(),
  // C'est CE compteur qui dit si un message est arrivé par le fil ou par le
  // réseau : s'il bouge, ce n'est plus du direct.
  getChatMessages: (/** @type {any[]} */ ...args) => mockGetChatMessages(...args),
  getChats: mockGetChats,
  pinChat: jest.fn(),
  removeGroupMember: jest.fn(),
  respondProposalMessage: jest.fn(),
  unarchiveChat: mockUnarchiveChat,
  unpinChat: jest.fn(),
  updateGroupMeta: jest.fn(),
  votePollMessage: jest.fn(),
}));

jest.mock('@/store/appContext', () => ({
  storage: { getString: () => undefined, set: () => {} },
  useAppContext: () => [{ auth: { token: 'jwt' } }, jest.fn()],
}));

const CLEF_MESSAGES = buildNormalizedQueryKey(['chat-messages', 'chat-1'], {
  pageSize: undefined,
  payload: 'light',
});

/**
 * Fabrique un message tel que le serveur le diffuse.
 * @param {string} documentId - Identifiant du message.
 * @param {string} texte - Le texte du message.
 * @returns {any} Le message.
 */
const unMessage = (documentId, texte) => ({
  chat: { documentId: 'chat-1' },
  createdAt: new Date().toISOString(),
  documentId,
  id: documentId,
  message: texte,
  readBy: [],
  sender: { documentId: 'marc', firstname: 'Marc', lastname: 'Durand' },
});

/**
 * Monte le vrai crochet de messagerie sur un vrai cache react-query.
 * @param {any} clientRequetes - Le client react-query du témoin.
 * @returns {{ arbre: any, lireMessagerie: () => any }} L'arbre et la messagerie.
 */
const monterMessagerie = (clientRequetes) => {
  // eslint-disable-next-line global-require
  const useMessaging = require('@/domains/messaging/useMessaging').default;
  let messagerie;
  /**
   * Sonde minimale : elle ne fait qu'allumer le crochet.
   * @returns {null} Rien à l'écran.
   */
  function Sonde() {
    messagerie = useMessaging('chat-1');
    return null;
  }
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      createElement(Sonde),
    ));
  });
  return { arbre, lireMessagerie: () => messagerie };
};

/**
 * Les messages actuellement dans le cache, du plus récent au plus ancien.
 * @param {any} clientRequetes - Le client react-query du témoin.
 * @returns {any[]} Les messages.
 */
const messagesEnCache = (clientRequetes) => {
  const donnees = /** @type {any} */ (clientRequetes.getQueryData(CLEF_MESSAGES));
  return (donnees?.pages || []).flatMap((/** @type {any} */ page) => page?.data || []);
};

describe('MSGLIVE — les messages arrivent-ils vraiment en direct ?', () => {
  /** @type {any} */
  let clientRequetes;

  beforeEach(() => {
    reinitialiserSocketDeTest();
    mockGetChatMessages.mockClear();
    clientRequetes = creerQueryClientDeTest();
    clientRequetes.setQueryData(CLEF_MESSAGES, {
      pageParams: [1],
      pages: [{
        data: [unMessage('msg-ancien', 'Salut')],
        meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
      }],
    });
  });

  afterEach(() => {
    clientRequetes.clear();
  });

  it('1. LE FIL EST BRANCHÉ : entrer dans un fil s\'abonne à « message-received »', () => {
    monterMessagerie(clientRequetes);

    expect((abonnes.get('message-received') || []).length).toBeGreaterThan(0);
    // Et on prévient le serveur qu'on est entré, sinon il ne nous diffuse rien.
    expect(envois.some((envoi) => envoi.nom === 'join-chat')).toBe(true);
  });

  it('2. LE DIRECT : un message reçu s\'affiche SANS un seul aller-retour réseau', () => {
    monterMessagerie(clientRequetes);
    expect(messagesEnCache(clientRequetes)).toHaveLength(1);

    emettreDuServeur('message-received', unMessage('msg-neuf', 'Tu viens ce soir ?'));

    const messages = messagesEnCache(clientRequetes);
    expect(messages).toHaveLength(2);
    // Le plus récent en tête : la liste de la conversation est inversée.
    expect(messages[0].documentId).toBe('msg-neuf');
    // 🎯 LE CŒUR DU TÉMOIN : aucune relecture. Le message est là parce qu'il
    // est ARRIVÉ, pas parce qu'on est allé le rechercher.
    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });

  it('3. PAS DE DOUBLON : le même message reçu deux fois ne s\'affiche qu\'une', () => {
    monterMessagerie(clientRequetes);

    const message = unMessage('msg-neuf', 'Tu viens ce soir ?');
    emettreDuServeur('message-received', message);
    emettreDuServeur('message-received', message);

    expect(messagesEnCache(clientRequetes)).toHaveLength(2);
  });

  it('4. LE FILET RESTE : un fil ouvert SANS rien en cache redemande la relecture', () => {
    // `joined` est la réponse du serveur à notre entrée. Le direct ne peut rien
    // pour ce qui s'est dit AVANT qu'on entre : c'est la relecture qui le
    // rattrape. Elle ne doit être demandée que si le cache est vide, sinon on
    // paierait un aller-retour à chaque ouverture de conversation.
    //
    // ⚠️ ON MESURE LA DEMANDE, PAS LE TRAJET, et c'est délibéré : une requête
    // que PERSONNE n'observe ne se relit pas quand on l'invalide (piège connu
    // du dépôt). Cette sonde n'affiche rien, donc elle n'observe rien : compter
    // les allers-retours ici ne mesurerait que l'absence de spectateur, pas le
    // comportement du code. Dans le vrai écran, la liste observe la requête.
    clientRequetes.removeQueries({ queryKey: ['chat-messages', 'chat-1'] });
    const relectures = [];
    const invaliderReel = clientRequetes.invalidateQueries.bind(clientRequetes);
    clientRequetes.invalidateQueries = (/** @type {any} */ filtres) => {
      relectures.push(filtres?.queryKey);
      return invaliderReel(filtres);
    };

    monterMessagerie(clientRequetes);
    emettreDuServeur('joined', { chatDocumentId: 'chat-1' });

    expect(relectures).toContainEqual(['chat-messages', 'chat-1']);
  });

  it('5. ET IL NE COÛTE RIEN QUAND IL NE SERT PAS : cache plein, aucune relecture', () => {
    monterMessagerie(clientRequetes);

    emettreDuServeur('joined', { chatDocumentId: 'chat-1' });

    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });

  it('6. UN MESSAGE EFFACÉ DISPARAÎT EN DIRECT LUI AUSSI', () => {
    // 🔎 LE PAYLOAD EST CELUI DU VRAI SERVEUR, pas un payload de confort :
    // c'est le contrôleur `DELETE /chat-messages/:id` que l'app appelle
    // (chatService.js:430), et il diffuse bien `chatDocumentId`
    // (admin/src/api/chat-message/controllers/chat-message.ts:721).
    //
    // ⚠️ DÉFAUT DORMANT REPÉRÉ EN ÉCRIVANT CE TÉMOIN, et signalé au chef
    // d'orchestre : le SECOND chemin de suppression du serveur, le cycle de vie
    // `content-types/chat-message/lifecycles.ts:352`, diffuse le même événement
    // SANS `chatDocumentId`. L'app le jette alors en silence
    // (useMessaging.js:532), et le message ne disparaît pas chez les autres.
    // Ce chemin-là n'est pas celui de l'app — il sert aux suppressions faites
    // depuis l'admin Strapi ou en cascade. Non corrigé ici : c'est le dépôt
    // `admin`, et ce lot ne le touche pas.
    monterMessagerie(clientRequetes);

    emettreDuServeur('message-deleted', {
      chatDocumentId: 'chat-1',
      documentId: 'msg-ancien',
      messageDocumentId: 'msg-ancien',
    });

    expect(messagesEnCache(clientRequetes)).toHaveLength(0);
    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });
});

describe('PARFIN exact — recherche locale ou résultat du serveur, sans horodatage', () => {
  let clientRequetes;
  let arbre;

  beforeEach(() => {
    jest.clearAllMocks();
    reinitialiserSocketDeTest();
    mockGetChats.mockResolvedValue({ data: [] });
    clientRequetes = creerQueryClientDeTest();
  });

  afterEach(async () => {
    if (arbre) await act(async () => { arbre.unmount(); });
    arbre = null;
    clientRequetes.clear();
  });

  it('un fil local de 30 s est réutilisé, même si son ancien résultat disait créé', async () => {
    const fil = {
      archivedBy: [{ documentId: 'moi' }],
      createdAt: new Date(Date.now() - 30000).toISOString(),
      documentId: 'fil-local',
      openingOutcome: 'created',
      participants: [{ documentId: 'moi' }, { documentId: 'maryline' }],
    };
    clientRequetes.setQueryData(['chats'], { pages: [{ data: [fil] }] });
    const sonde = monterMessagerie(clientRequetes);
    arbre = sonde.arbre;
    let resultat;

    await act(async () => {
      resultat = await sonde.lireMessagerie().startWhisperChat(['maryline']);
    });

    expect(resultat).toMatchObject({ documentId: 'fil-local', openingOutcome: 'reused' });
    expect(fil.openingOutcome).toBe('created');
    expect(mockUnarchiveChat.mock.calls[0][0]).toBe('fil-local');
    expect(mockCreateWhisperChat).not.toHaveBeenCalled();
  });

  it.each(['created', 'reused', 'unknown'])(
    'un cache incomplet conserve le résultat %s de la réponse distante',
    async (openingOutcome) => {
      const fil = { documentId: 'fil-distant', openingOutcome };
      mockCreateWhisperChat.mockResolvedValueOnce(fil);
      const sonde = monterMessagerie(clientRequetes);
      arbre = sonde.arbre;
      let resultat;

      await act(async () => {
        resultat = await sonde.lireMessagerie().startWhisperChat(['moi', 'maryline', 'maryline']);
      });

      expect(resultat).toEqual(fil);
      expect(mockCreateWhisperChat.mock.calls[0][0]).toEqual(['maryline']);
    },
  );

  it('un refus serveur est propagé, aucun succès fabriqué', async () => {
    mockCreateWhisperChat.mockRejectedValueOnce(new Error('Contact refusé'));
    const sonde = monterMessagerie(clientRequetes);
    arbre = sonde.arbre;

    await act(async () => {
      await expect(sonde.lireMessagerie().startWhisperChat(['maryline']))
        .rejects.toThrow('Contact refusé');
    });
  });
});
