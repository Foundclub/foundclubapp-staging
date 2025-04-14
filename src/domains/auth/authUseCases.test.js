import { getAuthTokens, getOnboardingViews, USER_TYPES } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

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
      const mockAuth = { refreshToken: 'refresh-token', token: 'test-token' };
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

  describe('getOnboardingViews', () => {
    it('should return complete flow for new user', () => {
      const views = getOnboardingViews({ role: { name: 'Authenticated' } });
      expect(views).toEqual([
        RouteNames.UserType,
        RouteNames.UserName,
        RouteNames.UserSection,
        RouteNames.UserBirthdate,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should return coach-specific flow', () => {
      const views = getOnboardingViews({ role: { name: USER_TYPES.coach } });
      expect(views).toEqual([
        RouteNames.UserName,
        RouteNames.UserSection,
        RouteNames.UserBirthdate,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should return player-specific flow', () => {
      const views = getOnboardingViews({ role: { name: USER_TYPES.player } });
      expect(views).toEqual([
        RouteNames.UserName,
        RouteNames.UserBirthdate,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should return president-specific flow', () => {
      const views = getOnboardingViews({ role: { name: USER_TYPES.president } });
      expect(views).toEqual([
        RouteNames.UserName,
        RouteNames.UserBirthdate,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should skip completed steps', () => {
      const views = getOnboardingViews({
        avatar: 'avatar.jpg',
        birthdate: '1990-01-01',
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_TYPES.coach },
        section: 'male',
      });
      expect(views).toEqual([RouteNames.Home]);
    });

    it('should skip name step when firstname and lastname are provided', () => {
      const views = getOnboardingViews({
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_TYPES.coach },
      });
      expect(views).toEqual([
        RouteNames.UserSection,
        RouteNames.UserBirthdate,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should skip section step when section is provided', () => {
      const views = getOnboardingViews({
        role: { name: USER_TYPES.coach },
        section: 'male',
      });
      expect(views).toEqual([
        RouteNames.UserName,
        RouteNames.UserBirthdate,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should skip birthdate step when birthdate is provided', () => {
      const views = getOnboardingViews({
        birthdate: '1990-01-01',
        role: { name: USER_TYPES.coach },
      });
      expect(views).toEqual([
        RouteNames.UserName,
        RouteNames.UserSection,
        RouteNames.UserAvatar,
        RouteNames.Welcome,
      ]);
    });

    it('should skip avatar step when avatar is provided', () => {
      const views = getOnboardingViews({
        avatar: 'avatar.jpg',
        role: { name: USER_TYPES.coach },
      });
      expect(views).toEqual([
        RouteNames.UserName,
        RouteNames.UserSection,
        RouteNames.UserBirthdate,
        RouteNames.Welcome,
      ]);
    });
  });
});
