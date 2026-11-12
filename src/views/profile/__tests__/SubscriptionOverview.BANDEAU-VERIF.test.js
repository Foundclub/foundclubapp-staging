// BANDEAU-VERIF (11/11, decision d'Adel « 248- A ») — AU TELEPHONE, « Mon abonnement »
// N'AFFICHE JAMAIS « Offre Club payée, vérification en attente » NI « droits bloqués ».
//
// Ce bandeau vivait sur le SITE seulement (web/src/views/profile/SubscriptionOverview.tsx,
// retire par le meme lot) : CLUB_UNVERIFIED ouvre les memes droits que CLUB
// (domains/subscription/subscriptionDecision.js, hasActiveClubOffer). Ce temoin tient
// qu'il ne s'installe pas au telephone, pour chaque etat d'abonnement. Il est vert
// avant comme apres : le telephone ne l'a jamais eu (constate le 11/11).
//
// Mocks : ceux de SubscriptionOverview.portailWeb.test.js, a l'identique.
import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

/** @type {any} */
let mockAuthValue;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockAlert = jest.fn();
const mockPortal = jest.fn();
const mockRestorePurchases = jest.fn();
const mockIncrease = jest.fn();
const mockInvalidate = jest.fn();
const mockScheduleRefresh = jest.fn();

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  /**
   * @param {string[]} chemin
   * @returns {any}
   */
  const lire = (chemin) => chemin.reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = lire(String(cle || '').split('.'));
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/subscription/useSubscriptionCatalog', () => ({
  useSubscriptionCatalog: () => ({
    entries: [],
    error: null,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  openSubscriptionManagementPortal: (/** @type {any} */ ...args) => mockPortal(...args),
  performSubscriptionLicenseeIncrease: (/** @type {any} */ ...args) => mockIncrease(...args),
  restoreAllSubscriptionPurchases: (/** @type {any} */ ...args) => mockRestorePurchases(...args),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: (/** @type {any} */ ...args) => mockInvalidate(...args),
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockScheduleRefresh(...args),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {
        arrowRight: 1, calendar: 1, check: 1, euroCircle: 1, search: 1, shield: 1, users: 1,
      },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('@/views/profile/SubscriptionCoveredHero', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>HEROS DEJA COUVERT</TexteRN> };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <PressableRN onPress={onPress}><TexteRN>{title}</TexteRN></PressableRN>
    ),
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = {
    alert: (/** @type {any} */ ...args) => mockAlert(...args),
  };
  // RN 0.79 lit `require(module).default` la ou 0.78 lisait le module entier :
  // le mock sert les DEUX formes, pour survivre aux deux versions.
  return { ...mockModule, default: mockModule };
});

/* ------------------------------------------------------------------ */

/**
 * Le contexte d'authentification d'un dirigeant dans l'etat voulu.
 * @param {{ certifie?: boolean, planCode: string | null, portee?: 'CLUB' | 'TEAM',
 *   provider?: string }} cas - L'etat d'abonnement.
 * @returns {any} Le contexte.
 */
const contexteAuth = ({
  certifie = false,
  planCode,
  portee = 'CLUB',
  provider = 'web',
}) => {
  const club = Boolean(planCode) && portee === 'CLUB';
  const equipe = Boolean(planCode) && portee === 'TEAM';
  let niveau = 'FREE';
  if (club) niveau = certifie ? 'CLUB' : 'CLUB_UNVERIFIED';
  else if (equipe) niveau = 'TEAM';
  return {
    clubVerificationSummary: {
      clubDocumentId: 'club-1',
      clubVerified: certifie,
      requiresClubVerification: club && !certifie,
    },
    entitlementsSummary: planCode ? [{
      capability: '*',
      scopeClubDocumentId: 'club-1',
      scopeTeamDocumentId: equipe ? 'team-1' : null,
      scopeType: portee,
      status: 'active',
      subscriptionPlanCode: planCode,
    }] : [],
    subscriptionAccessLevel: niveau,
    subscriptionSummary: {
      activePlanCodes: planCode ? [planCode] : [],
      hasClubPlan: club,
      hasTeamPlan: equipe,
      hasVerifiedClubPlan: club && certifie,
      payerSubscriptionIds: planCode ? ['sub-1'] : [],
      payerSubscriptionsSummary: planCode ? [{
        autoRenew: provider !== 'manual',
        billingPeriod: provider === 'manual' ? 'manual' : 'yearly',
        currentPeriodEnd: null,
        documentId: 'sub-1',
        isTrial: planCode.startsWith('fc_trial_'),
        planCode,
        provider,
        status: 'active',
      }] : [],
      requiresClubVerification: club && !certifie,
      teamSlotSummary: equipe
        ? {
          assigned: 1, available: 0, coveredTeamDocumentIds: ['team-1'], total: 1,
        }
        : {
          assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
        },
    },
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-1',
      myTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'Seniors' }],
      role: { name: 'Dirigeant', type: 'president' },
    },
  };
};

/**
 * Le texte de tous les Text de l'ecran, mis bout a bout.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Tout le texte affiche, mis bout a bout.
 */
const texteAffiche = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => {
    const enfants = noeud.props.children;
    return Array.isArray(enfants) ? enfants.join('') : String(enfants ?? '');
  })
  .join(' | ');

/**
 * Monte l'ecran « Mon abonnement ».
 * @returns {any} L'arbre rendu.
 */
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SubscriptionOverview
        navigation={{ navigate: mockNavigate, replace: mockReplace }}
        route={{ params: {} }}
      />,
    );
  });
  return arbre;
};

const plateformeDorigine = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
});

afterAll(() => {
  Platform.OS = plateformeDorigine;
});

const CLUB_PAYE = 'fc_club_tier_1_yearly';
const ACTIF = 'Club · actif';

const CAS = [
  ['gratuit', { planCode: null }, 'Gratuit'],
  ['Equipe payee', { planCode: 'fc_team_1_yearly', portee: 'TEAM' }, 'Équipe'],
  ['Club certifie', { certifie: true, planCode: CLUB_PAYE }, ACTIF],
  ['Club non certifie, paye sur iPhone', { planCode: CLUB_PAYE, provider: 'apple' }, ACTIF],
  ['Club non certifie, paye sur Android', { planCode: CLUB_PAYE, provider: 'google' }, ACTIF],
  ['Club non certifie, paye sur le site', { planCode: CLUB_PAYE, provider: 'web' }, ACTIF],
  ['Club non certifie, en essai', { planCode: 'fc_trial_club', provider: 'manual' }, ACTIF],
];
describe('BANDEAU-VERIF — « Mon abonnement » au telephone', () => {
  test.each(CAS)('jamais de bandeau « vérification en attente » : %s', (_nom, cas, statut) => {
    mockAuthValue = contexteAuth(/** @type {any} */ (cas));
    const texte = texteAffiche(rendre());

    // L'etat vise est bien atteint (sinon le temoin ne prouverait rien).
    expect(texte).toContain(statut);

    expect(texte).not.toMatch(/Offre Club payée/i);
    expect(texte).not.toMatch(/vérification en attente/i);
    expect(texte).not.toMatch(/restent bloqués|droits bloqués/i);
  });
});
