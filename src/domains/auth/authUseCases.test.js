import { getAuthTokens, getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

jest.mock('../../store/appContext', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
  },
}));

describe('authUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getBoolean.mockReturnValue(false);
  });

  describe('getAuthTokens', () => {
    it('returns null when no auth data exists', () => {
      storage.getString.mockReturnValue(null);
      expect(getAuthTokens()).toBeNull();
    });

    it('returns parsed auth data when valid', () => {
      const mockAuth = { refreshToken: 'refresh-token', token: 'test-token' };
      storage.getString.mockReturnValue(JSON.stringify(mockAuth));
      expect(getAuthTokens()).toEqual(mockAuth);
    });

    it('returns null when auth data is invalid JSON', () => {
      storage.getString.mockReturnValue('invalid-json');
      expect(getAuthTokens()).toBeNull();
    });
  });

  describe('getOnboardingViews', () => {
    it('returns empty views when onboarding is marked completed', () => {
      storage.getBoolean.mockReturnValue(true);
      const result = getOnboardingViews({
        documentId: 'user-doc',
        role: { name: USER_ROLES.player },
      });

      expect(result.totalViews).toBe(0);
      expect(result.views).toEqual([]);
    });

    it('returns full default flow for new authenticated user', () => {
      const result = getOnboardingViews({
        documentId: 'user-doc',
        role: { name: USER_ROLES.new },
      });

      expect(result.totalViews).toBe(13);
      expect(result.views[0]).toEqual({ canShow: true, index: 1, route: RouteNames.UserRole });
      expect(result.views[result.views.length - 1]).toEqual({
        canShow: true,
        index: 13,
        route: RouteNames.UserClubSearch,
      });
    });

    it('returns coach flow with address step', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(4);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserBirthdate,
        RouteNames.UserAddress,
        RouteNames.UserAvatar,
      ]);
    });

    it('returns player flow with optional football profile steps', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.player },
      });

      expect(result.totalViews).toBe(12);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserSection,
        RouteNames.UserBirthdate,
        RouteNames.UserAddress,
        RouteNames.UserAvatar,
        RouteNames.UserSport,
        RouteNames.UserPosition,
        RouteNames.UserPhysique,
        RouteNames.UserLevel,
        RouteNames.UserCategory,
        RouteNames.UserSportHistory,
        RouteNames.UserClubSearch,
      ]);
    });

    it('returns president flow', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.president },
      });

      expect(result.totalViews).toBe(2);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserAvatar,
      ]);
    });

    it('hides steps already filled', () => {
      const result = getOnboardingViews({
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(4);
      expect(result.views[0]).toEqual({ canShow: false, index: 1, route: RouteNames.UserName });
      expect(result.views[1]).toEqual({ canShow: true, index: 2, route: RouteNames.UserBirthdate });
    });

    it('skips position step when selected sport has no positions', () => {
      const result = getOnboardingViews({
        preferredSport: 'padel',
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: false, index: 7, route: RouteNames.UserPosition });
    });

    it('returns empty views when all coach fields are already completed', () => {
      const result = getOnboardingViews({
        address: { label: 'Paris', value: '2.35|48.85' },
        avatar: 'avatar.jpg',
        birthdate: '1990-01-01',
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(4);
      expect(result.views).toEqual([]);
    });
  });
});
