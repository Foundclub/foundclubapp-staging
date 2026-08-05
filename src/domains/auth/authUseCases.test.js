import {
  activateSessionByDocumentId,
  activateSessionForNotificationPayload,
  canUserEditClub,
  findAuthSessionByDocumentId,
  getAuthTokens,
  getManagedMultisportIds,
  getManagedMultisportSectionIds,
  getOnboardingViews,
  getRoleDocumentIdByKey,
  getStoredAuthSessions,
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
    set: jest.fn(),
  },
}));

describe('authUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthRuntimeForTests();
    storage.getBoolean.mockReturnValue(false);
    storage.getString.mockReturnValue(null);
  });

  describe('club management scope', () => {
    it('lets a multisport dirigeant edit child section clubs', () => {
      const user = {
        club: null,
        multisportClubs: [
          {
            documentId: 'cm-1',
            sections: [
              { documentId: 'section-club-1', name: 'Basket' },
              { documentId: 'section-club-2', name: 'Football' },
            ],
          },
        ],
        role: { name: USER_ROLES.president },
      };

      expect(Array.from(getManagedMultisportIds(user))).toEqual(['cm-1']);
      expect(Array.from(getManagedMultisportSectionIds(user))).toEqual([
        'section-club-1',
        'section-club-2',
      ]);
      expect(canUserEditClub(user, 'section-club-1')).toBe(true);
    });

    it('does not let non-dirigeants edit multisport child sections', () => {
      const user = {
        multisportClubs: [
          {
            sections: [{ documentId: 'section-club-1' }],
          },
        ],
        role: { name: USER_ROLES.coach },
      };

      expect(canUserEditClub(user, 'section-club-1')).toBe(false);
    });
  });

  describe('getAuthTokens', () => {
    it('returns null when no auth data exists', () => {
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

  describe('multi-account notification helpers', () => {
    it('reads stored auth sessions and appends persisted auth when missing from authSessions', () => {
      storage.getString.mockImplementation((key) => {
        if (key === 'auth') {
          return JSON.stringify({
            token: 'token-a',
            user: { documentId: 'user-a' },
          });
        }
        if (key === 'authSessions') {
          return JSON.stringify([
            {
              token: 'token-b',
              user: { documentId: 'user-b' },
            },
          ]);
        }
        return null;
      });

      expect(getStoredAuthSessions().map((session) => session.user.documentId)).toEqual([
        'user-b',
        'user-a',
      ]);
      expect(findAuthSessionByDocumentId('user-a')?.token).toBe('token-a');
    });

    it('activates a stored session through persisted storage when runtime dispatch is unavailable', () => {
      storage.getString.mockImplementation((key) => {
        if (key === 'activeSessionDocumentId') return 'user-a';
        if (key === 'auth') {
          return JSON.stringify({
            token: 'token-a',
            user: { documentId: 'user-a' },
          });
        }
        if (key === 'authSessions') {
          return JSON.stringify([
            {
              token: 'token-a',
              user: { documentId: 'user-a' },
            },
            {
              token: 'token-b',
              user: { documentId: 'user-b' },
            },
          ]);
        }
        return null;
      });

      const result = activateSessionByDocumentId('user-b');

      expect(result).toMatchObject({
        activated: true,
        switched: true,
      });
      expect(result.session?.token).toBe('token-b');
      expect(storage.set).toHaveBeenCalledWith('activeSessionDocumentId', 'user-b');
      expect(storage.set).toHaveBeenCalledWith('auth', JSON.stringify({
        token: 'token-b',
        user: { documentId: 'user-b' },
      }));
    });

    it('activates the targeted session from a notification payload', () => {
      storage.getString.mockImplementation((key) => {
        if (key === 'activeSessionDocumentId') return 'user-a';
        if (key === 'authSessions') {
          return JSON.stringify([
            {
              token: 'token-a',
              user: { documentId: 'user-a' },
            },
            {
              token: 'token-b',
              user: { documentId: 'user-b' },
            },
          ]);
        }
        if (key === 'auth') {
          return JSON.stringify({
            token: 'token-a',
            user: { documentId: 'user-a' },
          });
        }
        return null;
      });

      const result = activateSessionForNotificationPayload({
        targetUserDocumentId: 'user-b',
      });

      expect(result).toMatchObject({
        activated: true,
        switched: true,
      });
      expect(result.session?.user?.documentId).toBe('user-b');
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

    it('treats missing roles as onboarding-safe new users', () => {
      expect(getUserRoleKey(undefined)).toBe('new');
      expect(getUserRoleKey(null)).toBe('new');
      expect(getUserRoleKey('')).toBe('new');
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

    it('inserts parental declaration step when a saved birthdate is under 13', () => {
      const result = getOnboardingViews({
        birthdate: '2018-05-14',
        role: { name: USER_ROLES.player },
      });

      expect(result.views.map((view) => view.route)).toContain(RouteNames.UserParentalDeclaration);
      const parentalStep = result.views.find((view) => view.route === RouteNames.UserParentalDeclaration);
      expect(parentalStep).toEqual({
        canShow: true,
        index: 4,
        route: RouteNames.UserParentalDeclaration,
      });
    });

    it('hides parental declaration step when it was already accepted', () => {
      const result = getOnboardingViews({
        birthdate: '2018-05-14',
        parentalDeclarationAccepted: true,
        role: { name: USER_ROLES.player },
      });

      expect(result.views.map((view) => view.route)).not.toContain(RouteNames.UserParentalDeclaration);
    });

    it('inserts parental declaration step for a 14 year old (D1 threshold 15)', () => {
      const now = new Date();
      const birthdate = new Date(Date.UTC(
        now.getUTCFullYear() - 14,
        now.getUTCMonth(),
        now.getUTCDate(),
      )).toISOString().slice(0, 10);

      const result = getOnboardingViews({
        birthdate,
        role: { name: USER_ROLES.player },
      });

      expect(result.views.map((view) => view.route)).toContain(RouteNames.UserParentalDeclaration);
    });

    it('does not insert parental declaration step for a 15 year old (D1 threshold 15)', () => {
      const now = new Date();
      const birthdate = new Date(Date.UTC(
        now.getUTCFullYear() - 15,
        now.getUTCMonth(),
        now.getUTCDate() - 1,
      )).toISOString().slice(0, 10);

      const result = getOnboardingViews({
        birthdate,
        role: { name: USER_ROLES.player },
      });

      expect(result.views.map((view) => view.route)).not.toContain(RouteNames.UserParentalDeclaration);
    });

    it('keeps parental declaration visible for a partially completed minor player profile loaded from persisted auth', () => {
      const result = getOnboardingViews({
        birthdate: '2016-05-16T00:00:00.000Z',
        documentId: 'minor-player-doc',
        firstname: 'Test',
        lastname: 'Mineur',
        parentalDeclarationAccepted: false,
        role: { name: 'Joueur', type: 'joueur' },
        section: { documentId: 'section-doc', id: 2, name: 'Masculine' },
      });

      expect(result.views.filter((view) => view.canShow).map((view) => view.route)).toEqual([
        RouteNames.UserParentalDeclaration,
        RouteNames.UserAddress,
        RouteNames.UserAvatar,
        RouteNames.UserSport,
        RouteNames.UserPhysique,
        RouteNames.UserLevel,
        RouteNames.UserCategory,
        RouteNames.UserSportHistory,
        RouteNames.UserClubSearch,
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

    // L44 — la liste des sports « qui ont des postes » etait derivee de
    // `sportsPositions.js`, ou le RUGBY n'existait pas : l'inscription sautait
    // purement et simplement l'etape des postes pour un rugbyman. Il n'arrivait
    // donc jamais a `UserPosition`, qui, lui, connait les 10 postes de rugby.
    it('shows position step for rugby, which has ten positions', () => {
      const result = getOnboardingViews({
        preferredSport: 'rugby',
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: true, index: 7, route: RouteNames.UserPosition });
    });

    // `UserSport.js` enregistre `activity.name` tel que Strapi le nomme : la
    // comparaison doit tenir la majuscule.
    it('shows position step when the sport is stored capitalised, as onboarding writes it', () => {
      const result = getOnboardingViews({
        preferredSport: 'Rugby',
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: true, index: 7, route: RouteNames.UserPosition });
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

    it('hides affiliation guide for president when already affiliated through a multisport club', () => {
      const result = getOnboardingViews({
        multisportClubs: [{ documentId: 'cm-1', name: 'FoundClub Multisport' }],
        role: { name: USER_ROLES.president },
      });

      const affiliationStep = result.views.find((v) => v.route === RouteNames.UserAffiliationGuide);
      expect(affiliationStep).toEqual({
        canShow: false,
        index: 3,
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
