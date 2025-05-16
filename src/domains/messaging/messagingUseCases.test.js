import { storage } from '@/store/appContext';

import { getConversationName, getLastReadMessageKey, getUnreadStatus } from './messagingUseCases';

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
