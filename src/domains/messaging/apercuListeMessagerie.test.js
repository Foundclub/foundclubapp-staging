import {
  formatChatTimestamp,
  getChatLastMessage,
  getChatMessagePreview,
  resolveFriendlyMatchOpponent,
} from './messagingUseCases';

jest.mock('@/store/appContext', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

// AC05 — LES HUIT TEMOINS D ADEL SUR LA MESSAGERIE.
//
// Constat 1 : « les conversations doivent afficher le dernier message — la
// c est vide », et surtout « quand on envoie un evenement, une composition,
// un sondage, des documents ».
// Constat 2 : le non-lu doit porter un NOMBRE, et l heure OU le jour.
// Constat 3 : un match amical doit montrer l ecusson ADVERSE.
//
// Mesure du 2026-08-21 : `getChatMessagePreview` savait deja resumer le
// sondage, le document et la localisation — mais PAS la composition d equipe
// (`lineup_share`), qui est justement le premier exemple cite par Adel. Le
// serveur la poste avec `message: ''` (event-composition.ts), donc la ligne
// tombait dans le `default`, ne trouvait aucun texte, et rendait ''.

describe('AC05 — ce que la liste des conversations affiche', () => {
  describe('temoin 1 a 4 — aucun type de message ne rend une ligne vide', () => {
    test('1 — une COMPOSITION d equipe dit une phrase', () => {
      expect(getChatMessagePreview({
        composition: { teamName: 'U15 A', type: 'lineup_share' },
        createdAt: '2026-08-20T10:00:00.000Z',
        documentId: 'msg-1',
        message: '',
      })).toBe('Composition : U15 A');

      expect(getChatMessagePreview({
        composition: { type: 'lineup_share' },
        createdAt: '2026-08-20T10:00:00.000Z',
        documentId: 'msg-2',
        message: '',
      })).toBe('Composition publiée');
    });

    test('2 — un EVENEMENT, un SONDAGE et un DOCUMENT disent une phrase', () => {
      expect(getChatMessagePreview({
        composition: { eventName: 'Match U15 vs Nantes', type: 'event_share' },
        documentId: 'msg-3',
        message: 'Partage',
      })).toBe('Événement : Match U15 vs Nantes');

      expect(getChatMessagePreview({
        composition: { question: 'Qui vient samedi ?', type: 'poll' },
        documentId: 'msg-4',
        message: '',
      })).toBe('Sondage : Qui vient samedi ?');

      expect(getChatMessagePreview({
        attachments: [{ documentId: 'a-1', mime: 'application/pdf', name: 'convocation.pdf' }],
        documentId: 'msg-5',
        message: '',
      })).toBe('PDF • convocation.pdf');
    });

    test('3 — un message texte ordinaire s affiche tel quel', () => {
      expect(getChatMessagePreview({
        documentId: 'msg-6',
        message: 'On se voit samedi ?',
      })).toBe('On se voit samedi ?');
    });

    test('4 — LE GARDE-FOU : un type inconnu ne rend JAMAIS une ligne vide', () => {
      // Le serveur peut poster demain une charge que l app ne connait pas
      // encore (11 chemins de creation cote LEAGUE). Une ligne vide ferait
      // croire a une conversation vide ; on dit au moins qu il y a quelque
      // chose a lire.
      expect(getChatMessagePreview({
        composition: { type: 'un_type_que_l_app_ne_connait_pas' },
        createdAt: '2026-08-20T10:00:00.000Z',
        documentId: 'msg-7',
        message: '',
      })).toBe('Nouveau message');

      // ⛔ Mais un objet SANS aucune substance n invente rien.
      expect(getChatMessagePreview(null)).toBe('');
      expect(getChatMessagePreview({})).toBe('');
    });
  });

  describe('temoin 5 — le message le PLUS RECENT, jamais le premier venu', () => {
    test('l ordre du tableau ne decide pas', () => {
      const ancien = { createdAt: '2026-08-01T08:00:00.000Z', documentId: 'vieux', message: 'Bonjour' };
      const recent = { createdAt: '2026-08-20T18:30:00.000Z', documentId: 'neuf', message: 'A samedi' };

      expect(getChatLastMessage({ messages: [ancien, recent] })?.documentId).toBe('neuf');
      expect(getChatLastMessage({ messages: [recent, ancien] })?.documentId).toBe('neuf');
      expect(getChatLastMessage({ messages: [] })).toBeNull();
      expect(getChatLastMessage(null)).toBeNull();
    });
  });

  describe('temoin 6 — l heure le meme jour, le jour avant', () => {
    const maintenant = new Date('2026-08-21T15:00:00.000Z');

    test('un message du jour montre son HEURE', () => {
      expect(formatChatTimestamp('2026-08-21T09:05:00.000Z', { now: maintenant, timeZone: 'UTC' }))
        .toBe('09:05');
    });

    test('un message d hier montre son JOUR', () => {
      expect(formatChatTimestamp('2026-08-20T09:05:00.000Z', { now: maintenant, timeZone: 'UTC' }))
        .toBe('20/08');
    });

    test('une date absente ou illisible ne rend rien', () => {
      expect(formatChatTimestamp(null, { now: maintenant })).toBe('');
      expect(formatChatTimestamp('pas une date', { now: maintenant })).toBe('');
    });
  });

  describe('temoin 8 — l ecusson ADVERSE d un match amical', () => {
    const mesEquipes = [{ documentId: 't-moi', name: 'AS Foundclub U15' }];

    test('le titre « Match amical : A vs B » donne le camp d en face', () => {
      expect(resolveFriendlyMatchOpponent({
        chat: {
          groupName: 'Match amical : AS Foundclub U15 vs FC Nantes U15',
          type: 'friendly_match',
        },
        myTeams: mesEquipes,
      })).toEqual({ logoUrl: '', name: 'FC Nantes U15' });
    });

    test('l autre sens marche aussi', () => {
      expect(resolveFriendlyMatchOpponent({
        chat: {
          groupName: 'Match amical : FC Nantes U15 vs AS Foundclub U15',
          type: 'friendly_match',
        },
        myTeams: mesEquipes,
      })).toEqual({ logoUrl: '', name: 'FC Nantes U15' });
    });

    test('quand le serveur donne les deux equipes, il gagne sur le titre', () => {
      expect(resolveFriendlyMatchOpponent({
        chat: {
          friendlyMatchTeams: [
            { documentId: 't-moi', logo: { url: '/moi.png' }, name: 'AS Foundclub U15' },
            { documentId: 't-eux', logo: { url: '/eux.png' }, name: 'FC Nantes U15' },
          ],
          groupName: 'Match amical : AS Foundclub U15 vs FC Nantes U15',
          type: 'friendly_match',
        },
        myTeams: mesEquipes,
      })).toEqual({ logoUrl: '/eux.png', name: 'FC Nantes U15' });
    });

    test('⛔ quand on ne sait pas, on n invente pas un club', () => {
      expect(resolveFriendlyMatchOpponent({
        chat: { groupName: 'Match amical', type: 'friendly_match' },
        myTeams: mesEquipes,
      })).toBeNull();

      expect(resolveFriendlyMatchOpponent({
        chat: { groupName: 'Match amical : A vs B', type: 'team' },
        myTeams: mesEquipes,
      })).toBeNull();
    });
  });
});
