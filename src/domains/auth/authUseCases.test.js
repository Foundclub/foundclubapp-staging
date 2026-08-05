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
  onboardingCollectsBirthdate,
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

      expect(result.totalViews).toBe(13);
      expect(result.views[0]).toEqual({ canShow: true, index: 1, route: RouteNames.UserRole });
      expect(result.views[result.views.length - 1]).toEqual({
        canShow: true,
        index: 13,
        route: RouteNames.Welcome,
      });
    });

    it('returns coach flow with address step', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(5);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
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
        index: 2,
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

      expect(result.totalViews).toBe(13);
      expect(result.views.map((v) => v.route)).toEqual([
        RouteNames.UserName,
        RouteNames.UserSection,
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
        birthdate: '1990-01-01',
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });

      expect(result.totalViews).toBe(5);
      expect(result.views[0]).toEqual({ canShow: false, index: 1, route: RouteNames.UserName });
      expect(result.views[1]).toEqual({ canShow: true, index: 2, route: RouteNames.UserAddress });
    });

    // D15 - l'ecran fusionne ne se saute que si les TROIS champs sont connus.
    // Sans cette regle, un coach dont le nom est deja rempli n'aurait plus
    // AUCUN ecran ou saisir sa date de naissance : la declaration parentale
    // deviendrait injoignable.
    it('keeps the merged identity step visible when only the name is known', () => {
      const result = getOnboardingViews({
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.coach },
      });

      expect(result.views[0]).toEqual({ canShow: true, index: 1, route: RouteNames.UserName });
    });

    // ... mais le dirigeant, lui, n'a jamais de date de naissance a saisir :
    // son ecran doit bien se sauter des que nom et prenom sont connus.
    it('hides the merged identity step for a president once the name is known', () => {
      const result = getOnboardingViews({
        firstname: 'John',
        lastname: 'Doe',
        role: { name: USER_ROLES.president },
      });

      expect(result.views[0]).toEqual({ canShow: false, index: 1, route: RouteNames.UserName });
    });

    it('skips position step when selected sport has no positions', () => {
      const result = getOnboardingViews({
        preferredSport: 'padel',
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: false, index: 6, route: RouteNames.UserPosition });
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
      expect(positionStep).toEqual({ canShow: true, index: 6, route: RouteNames.UserPosition });
    });

    // `UserSport.js` enregistre `activity.name` tel que Strapi le nomme : la
    // comparaison doit tenir la majuscule.
    it('shows position step when the sport is stored capitalised, as onboarding writes it', () => {
      const result = getOnboardingViews({
        preferredSport: 'Rugby',
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: true, index: 6, route: RouteNames.UserPosition });
    });

    it('skips position step when preferred sport is not selected', () => {
      const result = getOnboardingViews({
        role: { name: USER_ROLES.player },
      });

      const positionStep = result.views.find((v) => v.route === RouteNames.UserPosition);
      expect(positionStep).toEqual({ canShow: false, index: 6, route: RouteNames.UserPosition });
    });

    it('keeps club visibility step visible even with default isLookingForClub value', () => {
      const result = getOnboardingViews({
        isLookingForClub: false,
        role: { name: USER_ROLES.player },
      });

      const clubSearchStep = result.views.find((v) => v.route === RouteNames.UserClubSearch);
      expect(clubSearchStep).toEqual({
        canShow: true,
        index: 11,
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

      expect(result.totalViews).toBe(5);
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
        index: 4,
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
        index: 12,
        route: RouteNames.UserAffiliationGuide,
      });
    });

    // ------------------------------------------------------------------
    // D15 - FILET DE CARACTERISATION (E6)
    //
    // `getOnboardingViews` est le SEUL endroit qui decide de l'ordre ET du
    // nombre d'etapes de l'inscription : le `n/N` de l'en-tete en sort
    // directement (`PrivateNavigator.js` -> `onboardingViews.totalViews`).
    // Les 9 ecrans d'inscription, eux, n'ont aucun test.
    //
    // Ce bloc epingle la liste ORDONNEE des routes et le total pour les 5
    // roles, cas majeur et cas mineur. Toute modification du parcours doit
    // passer par ici : c'est le filet des lots D15/D16/D17.
    // ------------------------------------------------------------------
    describe('D15 - parcours complet, liste ordonnee et total par role', () => {
      // Sous le seuil parental (15 ans) tant que la suite tourne avant 2033.
      const BIRTHDATE_MINEUR = '2018-05-14';

      const PARCOURS = [
        {
          roleName: USER_ROLES.player,
          routes: [
            RouteNames.UserName,
            RouteNames.UserSection,
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
          ],
          totalViews: 13,
          totalViewsMineur: 14,
        },
        {
          roleName: USER_ROLES.coach,
          routes: [
            RouteNames.UserName,
            RouteNames.UserAddress,
            RouteNames.UserAvatar,
            RouteNames.UserAffiliationGuide,
            RouteNames.Welcome,
          ],
          totalViews: 5,
          totalViewsMineur: 6,
        },
        {
          roleName: USER_ROLES.president,
          routes: [
            RouteNames.UserName,
            RouteNames.UserAvatar,
            RouteNames.UserAffiliationGuide,
            RouteNames.Welcome,
          ],
          // Le dirigeant n'a pas d'etape date de naissance : pas de
          // declaration parentale possible, le total ne bouge pas.
          totalViews: 4,
          totalViewsMineur: 4,
        },
        {
          roleName: USER_ROLES.superAdmin,
          routes: [
            RouteNames.UserName,
            RouteNames.UserAvatar,
            RouteNames.Welcome,
          ],
          totalViews: 3,
          totalViewsMineur: 3,
        },
        {
          roleName: USER_ROLES.new,
          routes: [
            RouteNames.UserRole,
            RouteNames.UserName,
            RouteNames.UserSection,
            RouteNames.UserAddress,
            RouteNames.UserAvatar,
            RouteNames.UserSport,
            RouteNames.UserPosition,
            RouteNames.UserPhysique,
            RouteNames.UserLevel,
            RouteNames.UserCategory,
            RouteNames.UserSportHistory,
            RouteNames.UserClubSearch,
            RouteNames.Welcome,
          ],
          totalViews: 13,
          totalViewsMineur: 14,
        },
      ];

      it.each(PARCOURS)(
        'role $roleName : $totalViews etapes, dans cet ordre exact',
        ({ roleName, routes, totalViews }) => {
          const result = getOnboardingViews({ role: { name: roleName } });

          expect(result.views.map((view) => view.route)).toEqual(routes);
          expect(result.totalViews).toBe(totalViews);
        },
      );

      it.each(PARCOURS)(
        'role $roleName, utilisateur mineur : $totalViewsMineur etapes',
        ({ roleName, totalViewsMineur }) => {
          const result = getOnboardingViews({
            birthdate: BIRTHDATE_MINEUR,
            role: { name: roleName },
          });

          expect(result.totalViews).toBe(totalViewsMineur);
        },
      );

      // Le piege de la fusion nom + date : `needsParentalDeclaration` se
      // calcule A PARTIR de la date de naissance. Depuis D15 cette date est
      // saisie sur l'ecran fusionne `UserName` ; la declaration parentale doit
      // donc arriver JUSTE APRES lui, jamais avant.
      it.each(PARCOURS.filter((parcours) => parcours.totalViewsMineur > parcours.totalViews))(
        'role $roleName, mineur : la declaration parentale suit immediatement l ecran fusionne',
        ({ roleName }) => {
          const result = getOnboardingViews({
            birthdate: BIRTHDATE_MINEUR,
            role: { name: roleName },
          });

          const routes = result.views.map((view) => view.route);
          const indexDeclaration = routes.indexOf(RouteNames.UserParentalDeclaration);
          const indexEcranFusionne = routes.indexOf(RouteNames.UserName);

          expect(indexDeclaration).toBeGreaterThan(-1);
          expect(indexDeclaration).toBe(indexEcranFusionne + 1);
        },
      );

      it.each(PARCOURS.filter((parcours) => parcours.totalViewsMineur === parcours.totalViews))(
        'role $roleName : aucune declaration parentale, ce parcours ne demande pas la date de naissance',
        ({ roleName }) => {
          const result = getOnboardingViews({
            birthdate: BIRTHDATE_MINEUR,
            role: { name: roleName },
          });

          expect(result.views.map((view) => view.route))
            .not.toContain(RouteNames.UserParentalDeclaration);
        },
      );

      // D15 - LE LIEN QUI EMPECHE LA DIVERGENCE.
      // `onboardingCollectsBirthdate` decide si l'ecran fusionne affiche les
      // trois champs de date ; `getOnboardingViews` decide si une declaration
      // parentale peut s'inserer. Les deux doivent dire la MEME chose, sinon
      // un role se verrait demander une date qui ne sert a rien, ou pire, ne se
      // la verrait jamais demander alors que son parcours l'attend.
      it.each(PARCOURS)(
        'role $roleName : l ecran fusionne demande la date de naissance ssi le parcours peut inserer la declaration parentale',
        ({ roleName, totalViews, totalViewsMineur }) => {
          expect(onboardingCollectsBirthdate({ name: roleName }))
            .toBe(totalViewsMineur > totalViews);
        },
      );

      // La date de naissance n'a plus d'etape a elle : l'ecran fusionne l'a
      // absorbee. Aucun parcours ne doit la faire reapparaitre.
      it.each(PARCOURS)('role $roleName : plus aucune etape date de naissance separee', ({ roleName }) => {
        const result = getOnboardingViews({ role: { name: roleName } });

        expect(result.views.map((view) => view.route)).not.toContain(RouteNames.UserBirthdate);
      });
    });
  });
});
