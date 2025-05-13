import { getAuthTokens, getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';
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

    it('should handle empty string auth data', () => {
      storage.getString.mockReturnValue('');
      expect(getAuthTokens()).toBeNull();
    });
  });

  describe('getOnboardingViews', () => {
    it('should return complete flow for new user', () => {
      const result = getOnboardingViews({ role: { name: 'Authenticated' } });
      expect(result.totalViews).toBe(6);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserRole },
        { canShow: true, index: 2, route: RouteNames.UserName },
        { canShow: true, index: 3, route: RouteNames.UserSection },
        { canShow: true, index: 4, route: RouteNames.UserBirthdate },
        { canShow: true, index: 5, route: RouteNames.UserAvatar },
        { canShow: true, index: 6, route: RouteNames.Welcome },
      ]);
    });

    it('should return coach-specific flow', () => {
      const result = getOnboardingViews({ role: { name: USER_ROLES.coach } });
      expect(result.totalViews).toBe(4);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserName },
        { canShow: true, index: 2, route: RouteNames.UserBirthdate },
        { canShow: true, index: 3, route: RouteNames.UserAvatar },
        { canShow: true, index: 4, route: RouteNames.Welcome },
      ]);
    });

    it('should return player-specific flow', () => {
      const result = getOnboardingViews({ role: { name: USER_ROLES.player } });
      expect(result.totalViews).toBe(5);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserName },
        { canShow: true, index: 2, route: RouteNames.UserSection },
        { canShow: true, index: 3, route: RouteNames.UserBirthdate },
        { canShow: true, index: 4, route: RouteNames.UserAvatar },
        { canShow: true, index: 5, route: RouteNames.Welcome },
      ]);
    });

    it('should return president-specific flow', () => {
      const result = getOnboardingViews({ role: { name: USER_ROLES.president } });
      expect(result.totalViews).toBe(3);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserName },
        { canShow: true, index: 2, route: RouteNames.UserAvatar },
        { canShow: true, index: 3, route: RouteNames.Welcome },
      ]);
    });

    it('should return empty views array when all steps are completed', () => {
      const result = getOnboardingViews({
        avatar: 'avatar.jpg',
        birthdate: '1990-01-01',
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
        section: 'male',
      });
      expect(result.totalViews).toBe(4);
      expect(result.views).toEqual([]);
    });

    it('should skip name step when firstname and lastname are provided', () => {
      const result = getOnboardingViews({
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });
      expect(result.totalViews).toBe(4);
      expect(result.views).toEqual([
        { canShow: false, index: 1, route: RouteNames.UserName },
        { canShow: true, index: 2, route: RouteNames.UserBirthdate },
        { canShow: true, index: 3, route: RouteNames.UserAvatar },
        { canShow: true, index: 4, route: RouteNames.Welcome },
      ]);
    });

    it('should skip section step when section is provided', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.player },
        section: 'male',
      });
      expect(result.totalViews).toBe(5);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserName },
        { canShow: false, index: 2, route: RouteNames.UserSection },
        { canShow: true, index: 3, route: RouteNames.UserBirthdate },
        { canShow: true, index: 4, route: RouteNames.UserAvatar },
        { canShow: true, index: 5, route: RouteNames.Welcome },
      ]);
    });

    it('should skip birthdate step when birthdate is provided', () => {
      const result = getOnboardingViews({
        birthdate: '1990-01-01',
        role: { name: USER_ROLES.coach },
      });
      expect(result.totalViews).toBe(4);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserName },
        { canShow: false, index: 2, route: RouteNames.UserBirthdate },
        { canShow: true, index: 3, route: RouteNames.UserAvatar },
        { canShow: true, index: 4, route: RouteNames.Welcome },
      ]);
    });

    it('should skip avatar step when avatar is provided', () => {
      const result = getOnboardingViews({
        avatar: 'avatar.jpg',
        role: { name: USER_ROLES.coach },
      });
      expect(result.totalViews).toBe(4);
      expect(result.views).toEqual([
        { canShow: true, index: 1, route: RouteNames.UserName },
        { canShow: true, index: 2, route: RouteNames.UserBirthdate },
        { canShow: false, index: 3, route: RouteNames.UserAvatar },
        { canShow: true, index: 4, route: RouteNames.Welcome },
      ]);
    });

    it('should handle invalid role gracefully', () => {
      const result = getOnboardingViews({ role: { name: 'InvalidRole' } });
      expect(result.totalViews).toBe(6);
      expect(result.views).toEqual([
        { canShow: false, index: 1, route: RouteNames.UserRole },
        { canShow: true, index: 2, route: RouteNames.UserName },
        { canShow: true, index: 3, route: RouteNames.UserSection },
        { canShow: true, index: 4, route: RouteNames.UserBirthdate },
        { canShow: true, index: 5, route: RouteNames.UserAvatar },
        { canShow: true, index: 6, route: RouteNames.Welcome },
      ]);
    });

    it('should handle undefined user data', () => {
      const result = getOnboardingViews({ role: {} });
      expect(result.totalViews).toBe(6);
      expect(result.views).toEqual([
        { canShow: false, index: 1, route: RouteNames.UserRole },
        { canShow: true, index: 2, route: RouteNames.UserName },
        { canShow: true, index: 3, route: RouteNames.UserSection },
        { canShow: true, index: 4, route: RouteNames.UserBirthdate },
        { canShow: true, index: 5, route: RouteNames.UserAvatar },
        { canShow: true, index: 6, route: RouteNames.Welcome },
      ]);
    });
  });
});
