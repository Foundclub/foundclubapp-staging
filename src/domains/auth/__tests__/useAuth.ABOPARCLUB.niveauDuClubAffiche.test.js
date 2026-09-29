import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// ABOPARCLUB (2026-09-29) — le TEMOIN SUR `useAuth` que reclamait le piege c.
//
// Les temoins de `SubscriptionOverview` posent `subscriptionAccessLevel` A LA
// MAIN dans leurs decors : ils ne peuvent pas voir un changement du calcul.
// Celui-ci monte le VRAI hook, nourri par le VRAI resume de demarrage
// (`GET /app/bootstrap`) du dirigeant de la recette du 28/09 : il paie
// « Club 100 » pour FoundClub Demo et regarde l'app depuis AIKI.
//
// Il mesure les trois valeurs que les ecrans lisent :
//   · `subscriptionAccessLevel`        — le niveau du club AFFICHE (AIKI) ;
//   · `accountSubscriptionAccessLevel` — ce que le compte PAIE (piege a) ;
//   · `getSubscriptionAccessLevelForClub` — le niveau d'un club nomme (un
//     evenement de Demo ouvert depuis AIKI).
// Ecrit ROUGE, puis vert.

const mockAppState = { auth: /** @type {any} */ (null), authSessions: [], isAddingAccount: false };

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn(),
    getAllKeys: () => [],
    getBoolean: () => false,
    getString: jest.fn(),
    set: jest.fn(),
  },
  useAppContext: () => ([mockAppState, jest.fn()]),
}));

jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {string} */ repli) => repli || key,
  }),
}));

// Ces modules lisent `.env` (absent des copies de travail) : sans doublure, la
// suite ENTIERE meurt au chargement.
jest.mock('@/services/auth/authService', () => ({
  deleteDeviceToken: jest.fn(),
  getMe: jest.fn(() => new Promise(() => {})),
  login: jest.fn(),
  logout: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
}));
jest.mock('@/services/bootstrap/bootstrapService', () => ({
  getAppBootstrap: jest.fn(() => new Promise(() => {})),
}));
jest.mock('@/services/bootRequestGuard', () => ({
  getRetryAfterSeconds: () => 0,
  resetBootRequestGuard: jest.fn(),
}));
jest.mock('@/hooks/useNotificationController', () => ({ UNREAD_COUNT_QUERY_KEY: ['unread'] }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));
jest.mock('@/services/teamInvite/teamInviteShare', () => ({ shareTeamInviteLink: jest.fn() }));

const useAuth = require('@/domains/auth/useAuth').default;

const JETON = 'jeton-aboparclub';
const DEMO = 'club-foundclub-demo';
const AIKI = 'club-aiki';

const DIRIGEANT = {
  club: { documentId: AIKI, name: 'AIKI' },
  clubs: [{ documentId: AIKI, name: 'AIKI' }, { documentId: DEMO, name: 'FoundClub Démo' }],
  documentId: 'u-dirigeant-demo-aiki',
  role: { name: 'Dirigeant', type: 'president' },
};

const DEMARRAGE = {
  clubVerificationSummary: {
    clubDocumentId: AIKI,
    clubPartner: false,
    clubVerified: false,
    hasActiveClubEntitlement: false,
    legacyIsCustomer: false,
    requiresClubVerification: false,
  },
  entitlementsSummary: [{
    capability: '*',
    paidBy: { documentId: DIRIGEANT.documentId, firstname: 'Adel', lastname: 'F' },
    scopeClubDocumentId: DEMO,
    scopeClubName: 'FoundClub Démo',
    scopeTeamDocumentId: null,
    scopeType: 'CLUB',
    status: 'active',
    subscriptionPlanCode: 'fc_club_tier_1_yearly',
  }],
  freeUsageSummary: [],
  serverTime: '2026-09-29T10:00:00.000Z',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_1_yearly'],
    hasClubPlan: true,
    hasTeamPlan: false,
    hasVerifiedClubPlan: false,
    payerSubscriptionIds: ['sub-demo'],
    requiresClubVerification: true,
  },
  userSummary: DIRIGEANT,
};

/**
 * Monte le vrai hook, nourri du resume de demarrage deja en cache, et rend ce
 * qu'il expose.
 * @returns {any} La valeur de retour de `useAuth`.
 */
const lire = () => {
  mockAppState.auth = { token: JETON, user: DIRIGEANT };
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData(['app-bootstrap', JETON], DEMARRAGE);

  /** @type {any} */
  let vu = null;
  /**
   * La sonde : elle ne rend rien, elle capture ce que le hook expose.
   * @returns {null} Rien.
   */
  function Sonde() {
    vu = useAuth();
    return null;
  }

  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Sonde)),
    );
  });
  // ⛔ Toujours demonter : un arbre laisse vivant fait sortir Jest en erreur.
  act(() => { arbre.unmount(); });
  queryClient.clear();
  return vu;
};

describe('ABOPARCLUB — useAuth : le niveau d acces suit le club AFFICHE', () => {
  it('depuis AIKI, non couvert : le niveau lu par les ecrans est GRATUIT', () => {
    expect(lire().subscriptionAccessLevel).toBe('FREE');
  });

  it('ce que le compte PAIE reste expose a part : Club (non certifie)', () => {
    expect(lire().accountSubscriptionAccessLevel).toBe('CLUB_UNVERIFIED');
  });

  it('le niveau d un club nomme : Demo couvert, AIKI non, un club vide = le club affiche', () => {
    const vu = lire();
    expect(vu.getSubscriptionAccessLevelForClub(DEMO)).toBe('CLUB_UNVERIFIED');
    expect(vu.getSubscriptionAccessLevelForClub(AIKI)).toBe('FREE');
    expect(vu.getSubscriptionAccessLevelForClub('')).toBe('FREE');
  });
});
