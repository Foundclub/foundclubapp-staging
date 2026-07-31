import { storage } from '@/store/appContext';

import {
  getConversationName,
  getLastReadMessageKey,
  getUnreadStatus,
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
});
