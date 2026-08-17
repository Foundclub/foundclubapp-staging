import { storage } from '@/store/appContext';

import {
  getChatMessagePreview,
  getConversationName,
  getLastReadMessageKey,
  getUnreadStatus,
  isFriendlyMatchChat,
  isLeagueChat,
} from './messagingUseCases';

jest.mock('@/store/appContext', () => ({
  storage: {
    getString: jest.fn(),
  },
}));

describe('messagingUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLastReadMessageKey', () => {
    test('should return correct key', () => {
      const chatId = 'test-chat-123';
      expect(getLastReadMessageKey(chatId)).toBe('chat_test-chat-123_last_read');
    });
  });

  describe('getUnreadStatus', () => {
    test('should return true when no last read timestamp exists', () => {
      storage.getString.mockReturnValue(null);
      expect(getUnreadStatus('test-chat', '2023-01-01T00:00:00.000Z')).toBe(true);
    });

    test('should return true when last message is newer than last read', () => {
      storage.getString.mockReturnValue('2023-01-01T00:00:00.000Z');
      expect(getUnreadStatus('test-chat', '2023-01-02T00:00:00.000Z')).toBe(true);
    });

    test('should return false when last message is older than last read', () => {
      storage.getString.mockReturnValue('2023-01-02T00:00:00.000Z');
      expect(getUnreadStatus('test-chat', '2023-01-01T00:00:00.000Z')).toBe(false);
    });
  });

  describe('isLeagueChat', () => {
    test('should return true for league match chat type', () => {
      expect(isLeagueChat({ type: 'league_match' })).toBe(true);
    });

    test('should return true when a league match relation is present', () => {
      expect(isLeagueChat({
        league_match: { documentId: 'league-match-1' },
        type: 'group',
      })).toBe(true);
    });

    test('should return false for classic chat types', () => {
      expect(isLeagueChat({ type: 'team' })).toBe(false);
      expect(isLeagueChat({ type: 'club' })).toBe(false);
      expect(isLeagueChat({ type: 'whisper' })).toBe(false);
    });

    test('should handle missing chat gracefully', () => {
      expect(isLeagueChat(null)).toBe(false);
      expect(isLeagueChat(undefined)).toBe(false);
    });
  });

  /**
   * D92 — le fil ouvert par une proposition de match etait en LECTURE SEULE.
   * Ce n etait pas un choix : le serveur, lui, autorise l ecriture
   * (chat-message.ensureUserCanWriteInChat ne restreint que `club` et
   * `multisport`). C est l app qui oubliait `friendly_match` dans sa liste,
   * la ou son jumeau `league_match` y figure. Un canal de negociation ou
   * personne ne peut ecrire contredit tout ce que l ecran promet.
   */
  describe('isFriendlyMatchChat', () => {
    test('reconnait le fil ouvert par une proposition de match amical', () => {
      expect(isFriendlyMatchChat({ type: 'friendly_match' })).toBe(true);
    });

    // ⚠️ Contrairement a `league_match`, le schema serveur du chat n a AUCUNE
    // relation inverse vers la candidature (chat/schema.json : `league_match`
    // existe, `friendly_match_application` non). Le TYPE est donc la seule
    // marque disponible — inutile de chercher une relation qui n existe pas.
    test('ne se declenche pas sur les autres canaux', () => {
      expect(isFriendlyMatchChat({ type: 'team' })).toBe(false);
      expect(isFriendlyMatchChat({ type: 'club' })).toBe(false);
      expect(isFriendlyMatchChat({ type: 'league_match' })).toBe(false);
    });

    test('supporte l absence de canal', () => {
      expect(isFriendlyMatchChat(null)).toBe(false);
      expect(isFriendlyMatchChat(undefined)).toBe(false);
    });
  });

  describe('getConversationName — fil de match amical (lot L5)', () => {
    // Le serveur cree le fil avec groupName = « Match amical : A vs B »
    // (friendly-match-workflow.ts:279). Sans cas dedie, le `default` du switch
    // rendait '' : le fil s'affichait SANS TITRE dans la liste de messagerie
    // (Messaging.js:654 rend la valeur brute) et restait introuvable a la
    // recherche (Messaging.js:337).
    test('reprend le nom pose par le serveur', () => {
      expect(getConversationName({
        chatGroupName: 'Match amical : FC Annonceur U15 vs US Candidat U15',
        chatType: 'friendly_match',
      })).toBe('Match amical : FC Annonceur U15 vs US Candidat U15');
    });

    test('sans nom serveur, dit quand meme de quoi il s agit', () => {
      expect(getConversationName({ chatType: 'friendly_match' })).toBe('Match amical');
    });

    test('n est jamais vide : un fil sans titre est un fil qu on ne retrouve pas', () => {
      expect(getConversationName({ chatType: 'friendly_match' })).not.toBe('');
    });
  });

  describe('getConversationName', () => {
    test('should return club name for club chat', () => {
      const params = {
        chatClub: { name: 'Test Club' },
        chatType: 'club',
      };
      expect(getConversationName(params)).toBe('Test Club');
    });

    test('should return team name for team chat', () => {
      const params = {
        chatTeam: { name: 'Test Team' },
        chatType: 'team',
      };
      expect(getConversationName(params)).toBe('Test Team');
    });

    test('should return participant name for whisper chat', () => {
      const params = {
        chatParticipants: [
          { documentId: 'user1', firstname: 'John', lastname: 'Doe' },
          { documentId: 'user2', firstname: 'Jane', lastname: 'Smith' },
        ],
        chatType: 'whisper',
        meId: 'user1',
      };
      expect(getConversationName(params)).toBe('Jane Smith');
    });

    test('should return first participant name for whisper chat when no meId', () => {
      const params = {
        chatParticipants: [
          { documentId: 'user1', firstname: 'John', lastname: 'Doe' },
        ],
        chatType: 'whisper',
      };
      expect(getConversationName(params)).toBe('John Doe');
    });

    test('should return empty string for unknown chat type', () => {
      const params = {
        chatType: 'unknown',
      };
      expect(getConversationName(params)).toBe('');
    });

    test('should handle missing data gracefully', () => {
      expect(getConversationName({ chatType: 'club' })).toBe('');
      expect(getConversationName({ chatType: 'team' })).toBe('');
      expect(getConversationName({ chatType: 'whisper' })).toBe('');
    });
  });

  // Filet E6 posé par le lot S03 : cette fonction n'avait AUCUN test, et le lot
  // devait la toucher. On décrit d'abord ce qu'elle fait déjà, puis ce qu'elle
  // doit faire en plus.
  //
  // 🧨 POURQUOI IL A FALLU LA TOUCHER — une mesure a démenti une hypothèse.
  // La liste des conversations n'affiche JAMAIS le texte d'un message porteur
  // d'une charge : elle affiche l'étiquette de sa famille. En donnant enfin une
  // charge à la proposition d'amical (S03), on faisait donc passer la ligne de
  // « AS Candidats U15 propose un match. » à « Proposition » — c'est-à-dire
  // qu'on RECULAIT sur le constat d'Adel du 13/08 (« on ne voit pas le contenu
  // des messages », lot R06). La ligne dit donc de quel match il s'agit.
  describe('getChatMessagePreview', () => {
    test('un message ordinaire s affiche tel quel, et un message vide ne dit rien', () => {
      expect(getChatMessagePreview({ message: 'On se voit samedi ?' })).toBe('On se voit samedi ?');
      expect(getChatMessagePreview(null)).toBe('');
      expect(getChatMessagePreview({})).toBe('');
    });

    test('les charges connues gardent leur etiquette (non-regression)', () => {
      expect(getChatMessagePreview({ composition: { type: 'poll' } })).toBe('Sondage');
      expect(getChatMessagePreview({ composition: { type: 'voice_note' } })).toBe('Note vocale');
      expect(getChatMessagePreview({ composition: { type: 'location_share' } }))
        .toBe('Localisation');
      // Une proposition LEAGUE reste « Proposition » : elle n a pas de date a
      // montrer dans la liste, et son fil porte deja le nom du match.
      expect(getChatMessagePreview({ composition: { matchId: 'm-1', type: 'proposal' } }))
        .toBe('Proposition');
    });

    test('S03 — une proposition de match amical dit DE QUEL match il s agit', () => {
      expect(getChatMessagePreview({
        composition: {
          dateLabel: 'jeudi 12 novembre',
          kind: 'friendly_match',
          teamName: 'AS Candidats U15',
          type: 'proposal',
        },
      })).toBe('AS Candidats U15 propose un match — jeudi 12 novembre');
    });

    test('S03 — et elle ne raconte que ce qu elle sait', () => {
      // Sans nom d equipe ni date, on retombe sur l etiquette : ⛔ jamais un
      // tiret orphelin ni un nom inventé.
      expect(getChatMessagePreview({ composition: { kind: 'friendly_match', type: 'proposal' } }))
        .toBe('Proposition de match');
      expect(getChatMessagePreview({
        composition: { kind: 'friendly_match', teamName: 'AS Candidats U15', type: 'proposal' },
      })).toBe('AS Candidats U15 propose un match');
    });
  });
});
