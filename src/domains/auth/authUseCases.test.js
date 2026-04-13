import {
  getAuthTokens,
  getOnboardingViews,
  getRoleDocumentIdByKey,
  getUserRoleKey,
  USER_ROLES,
} from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';
import {
  resetAuthRuntimeForTests,
  syncAuthRuntimeState,
} from '@/store/authRuntime';

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
    resetAuthRuntimeForTests();
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

    it('returns runtime auth when runtime state is ready', () => {
      const runtimeAuth = { token: 'runtime-token' };
      syncAuthRuntimeState({
        activeSessionDocumentId: 'user-doc',
        auth: runtimeAuth,
        authSessions: [runtimeAuth],
        isAddingAccount: false,
      });
      storage.getString.mockReturnValue(JSON.stringify({ token: 'storage-token' }));

      expect(getAuthTokens()).toEqual(runtimeAuth);
    });

    it('returns null during add-account flow even if a session is kept in memory', () => {
      const runtimeAuth = { token: 'runtime-token' };
      syncAuthRuntimeState({
        activeSessionDocumentId: 'user-doc',
        auth: runtimeAuth,
        authSessions: [runtimeAuth],
        isAddingAccount: true,
      });
      storage.getString.mockReturnValue(JSON.stringify({ token: 'storage-token' }));

      expect(getAuthTokens()).toBeNull();
    });

    it('returns null when auth data is invalid JSON', () => {
      storage.getString.mockReturnValue('invalid-json');
      expect(getAuthTokens()).toBeNull();
    });
  });

  describe('getOnboardingViews', () => {
    it('normalizes coach role aliases for onboarding', () => {
      expect(getUserRoleKey('Coach')).toBe('coach');
      expect(getUserRoleKey('Entraineur')).toBe('coach');
      expect(getUserRoleKey('Entraîneur')).toBe('coach');
    });

    it('normalizes president role aliases for onboarding', () => {
      expect(getUserRoleKey('President')).toBe('president');
      expect(getUserRoleKey('Dirigeant')).toBe('president');
      expect(getUserRoleKey('ClubAdmin')).toBe('president');
    });

    it('finds coach role document id from role aliases and backend type', () => {
      const roles = [
        { documentId: 'role-player', name: 'Joueur', type: 'joueur' },
        { documentId: 'role-coach', name: 'Entraineur', type: 'entraineur' },
        { documentId: 'role-president', name: 'Dirigeant', type: 'dirigeant' },
      ];

      expect(getRoleDocumentIdByKey(roles, USER_ROLES.coach)).toBe('role-coach');
      expect(getRoleDocumentIdByKey(roles, 'Entraîneur')).toBe('role-coach');
      expect(getRoleDocumentIdByKey(roles, 'coach')).toBe('role-coach');
    });

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

      expect(result.totalViews).toBe(14);
      expect(result.views[0]).toEqual({ canShow: true, index: 1, route: RouteNames.UserRole });
      expect(result.views[result.views.length - 1]).toEqual({
        canShow: true,
        index: 14,
        route: RouteNames.Welcome,
      });
    });

    it('returns coach flow with address step', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(6);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserBirthdate,
        RouteNames.UserAddress,
        RouteNames.UserAvatar,
        RouteNames.UserAffiliationGuide,
        RouteNames.Welcome,
      ]);
    });

    it('returns coach onboarding flow for alias role names', () => {
      const result = getOnboardingViews({
        role: { name: 'Coach' },
      });

      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserBirthdate,
        RouteNames.UserAddress,
        RouteNames.UserAvatar,
        RouteNames.UserAffiliationGuide,
        RouteNames.Welcome,
      ]);
    });

    it('returns player flow with optional football profile steps', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.player },
      });

      expect(result.totalViews).toBe(14);
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
        RouteNames.UserAffiliationGuide,
        RouteNames.Welcome,
      ]);
    });

    it('returns president flow', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.president },
      });

      expect(result.totalViews).toBe(4);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserAvatar,
        RouteNames.UserAffiliationGuide,
        RouteNames.Welcome,
      ]);
    });

    it('hides steps already filled', () => {
      const result = getOnboardingViews({
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(6);
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

    it('skips position step when preferred sport is not selected', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: false, index: 7, route: RouteNames.UserPosition });
    });

    it('keeps club visibility step visible even with default isLookingForClub value', () => {
      const result = getOnboardingViews({
        isLookingForClub: false,
        role: { name: USER_ROLES.player },
      });

      const clubSearchStep = result.views.find((v) => v.route === RouteNames.UserClubSearch);
      expect(clubSearchStep).toEqual({
        canShow: true,
        index: 12,
        route: RouteNames.UserClubSearch,
      });
    });

    it('returns welcome-only view when coach fields are already completed', () => {
      const result = getOnboardingViews({
        address: { label: 'Paris', value: '2.35|48.85' },
        avatar: 'avatar.jpg',
        birthdate: '1990-01-01',
        club: { documentId: 'club-1' },
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(6);
      const visibleRoutes = result.views.filter((v) => v.canShow).map((v) => v.route);
      expect(visibleRoutes).toEqual([RouteNames.Welcome]);
    });

    it('hides affiliation guide for coach when already affiliated to a club', () => {
      const result = getOnboardingViews({
        club: { documentId: 'club-1' },
        role: { name: USER_ROLES.coach },
      });

      const affiliationStep = result.views.find((v) => v.route === RouteNames.UserAffiliationGuide);
      expect(affiliationStep).toEqual({
        canShow: false,
        index: 5,
        route: RouteNames.UserAffiliationGuide,
      });
    });

    it('hides affiliation guide for player when already in a team', () => {
      const result = getOnboardingViews({
        myTeams: [{ documentId: 'team-1' }],
        role: { name: USER_ROLES.player },
      });

      const affiliationStep = result.views.find((v) => v.route === RouteNames.UserAffiliationGuide);
      expect(affiliationStep).toEqual({
        canShow: false,
        index: 13,
        route: RouteNames.UserAffiliationGuide,
      });
    });
  });
});
