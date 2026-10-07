import canWriteInChat from '../canWriteInChat';

// MSG1W — la regle « qui peut ecrire » du telephone (Conversation.js, `canWrite`), sortie pour
// servir aussi au site, avec la correction G1 de MESSAGERIE-1A (un groupe n est pas un canal).

const JOUEUR = { documentId: 'joueur', role: { type: 'player' } };
const DIRIGEANT = { documentId: 'dirigeant', role: { type: 'president' } };
const acces = (/** @type {string} */ clubId) => clubId === 'club-1';

describe('canWriteInChat', () => {
  test.each([
    ['tete-a-tete', { type: 'whisper' }],
    ['groupe (MSG1A G1)', { type: 'group' }],
    ['equipe', { type: 'team' }],
    ['match League', { type: 'league_match' }],
    ['match amical', { type: 'friendly_match' }],
    ['canal des dirigeants de la Ville', { type: 'collectivite_dirigeants' }],
    ['conversation Ville et club', { type: 'collectivite_club' }],
  ])('%s : tous les participants ecrivent', (_nom, chat) => {
    expect(canWriteInChat({ chat, hasClubAccess: acces, user: JOUEUR })).toBe(true);
  });

  test('canal de club : le dirigeant de CE club ecrit, un joueur non', () => {
    const chat = { club: { documentId: 'club-1' }, type: 'club' };
    expect(canWriteInChat({ chat, hasClubAccess: acces, user: DIRIGEANT })).toBe(true);
    expect(canWriteInChat({ chat, hasClubAccess: acces, user: JOUEUR })).toBe(false);
    expect(canWriteInChat({
      chat: { club: { documentId: 'club-2' }, type: 'club' }, hasClubAccess: acces, user: DIRIGEANT,
    })).toBe(false);
  });

  test('canal omnisport : seulement ses administrateurs dirigeants', () => {
    const chat = {
      multisportClub: { admins: [{ documentId: 'dirigeant' }], documentId: 'omni-1' },
      type: 'multisport',
    };
    expect(canWriteInChat({ chat, user: DIRIGEANT })).toBe(true);
    expect(canWriteInChat({ chat, user: JOUEUR })).toBe(false);
    expect(canWriteInChat({
      chat: { multisportClub: { documentId: 'omni-1' }, type: 'multisport' },
      user: { ...DIRIGEANT, multisportClubs: [{ documentId: 'omni-1' }] },
    })).toBe(true);
  });

  test('sans fil ou sans personne : rien n est offert', () => {
    expect(canWriteInChat({ chat: null, user: JOUEUR })).toBe(false);
    expect(canWriteInChat({ chat: { type: 'team' }, user: null })).toBe(false);
    expect(canWriteInChat({ chat: { type: 'inconnu' }, user: JOUEUR })).toBe(false);
  });
});
