import { getAuthTokens } from './EXAMPLE-authUseCases';
import { storage } from '../../store/appContext';

jest.mock('../../store/appContext', () => ({
  storage: {
    getString: jest.fn(),
  },
}));

describe('authUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthTokens', () => {
    it('should return null when no auth data exists', () => {
      storage.getString.mockReturnValue(null);
      expect(getAuthTokens()).toBeNull();
    });

    it('should return parsed auth data when valid', () => {
      const mockAuth = { token: 'test-token', refreshToken: 'refresh-token' };
      storage.getString.mockReturnValue(JSON.stringify(mockAuth));
      expect(getAuthTokens()).toEqual(mockAuth);
    });

    it('should return null when auth data is invalid JSON', () => {
      storage.getString.mockReturnValue('invalid-json');
      expect(getAuthTokens()).toBeNull();
    });

    it('should call storage.getString with correct key', () => {
      getAuthTokens();
      expect(storage.getString).toHaveBeenCalledWith('auth');
    });
  });
});
