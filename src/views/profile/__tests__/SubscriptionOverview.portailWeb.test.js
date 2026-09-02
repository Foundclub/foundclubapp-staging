import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// ABO-FIX / R3 — LA PORTE DE SORTIE DE L'ABONNE WEB.
//
// LE TROU, MESURE LE 01/09 : `grep billing_portal|customer_portal|
// manageSubscription` sur app/src, admin/src et web/src rendait ZERO. Un
// abonne pris sur le site n'avait AUCUN endroit pour resilier — ni ecran, ni
// route — pendant que l'app lui PROMET « resiliable a tout moment ».
//
// LES TROIS PROPRIETES QUE CES TEMOINS TIENNENT :
//   R3/a — la ligne EXISTE pour un abonnement pris sur le site ;
//   R3/b — elle N'EXISTE PAS pour un abonnement iPhone/Android : ceux-la se
//          resilient chez leur magasin, et un bouton qui ne peut pas les
//          servir est pire que pas de bouton ;
//   R3/c — quand le portail est indisponible (il n'y a AUCUNE cle Stripe en
//          production), on ne laisse personne devant un bouton muet : on DIT.

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

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

/* ------------------------------------------------------------------ */

const LIBELLE_LIGNE = 'Gérer ou résilier mon abonnement';

/**
 * Un dirigeant abonne, avec le fournisseur qu'on veut eprouver.
 * `provider` vient du resume du serveur (subscription-permission.ts) : les
 * valeurs possibles sont apple / google / manual / legacy / web.
 * @param {string} provider - Le fournisseur de l'abonnement paye.
 * @returns {any} Le contexte d'authentification.
 */
const contexteAuth = (provider) => ({
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  entitlementsSummary: [],
  subscriptionAccessLevel: 'CLUB',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_1_yearly'],
    payerSubscriptionIds: ['sub-1'],
    payerSubscriptionsSummary: [{
      autoRenew: true,
      billingPeriod: 'yearly',
      currentPeriodEnd: null,
      documentId: 'sub-1',
      isTrial: false,
      planCode: 'fc_club_tier_1_yearly',
      provider,
      status: 'active',
    }],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
  userData: {
    club: { documentId: 'club-1' },
    documentId: 'user-1',
    role: { name: 'Dirigeant', type: 'president' },
  },
});

/**
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle cherche.
 * @returns {any[]} Les pressables portant ce libelle.
 */
const pressablesPortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

/**
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

beforeEach(() => {
  jest.clearAllMocks();
  mockPortal.mockResolvedValue({ opened: true, reason: 'ok' });
  mockAuthValue = contexteAuth('web');
});

describe('ABO-FIX/R3 — la porte de sortie de l\'abonne web', () => {
  test('R3/a — un abonnement pris sur le SITE ouvre le portail de resiliation', async () => {
    const arbre = rendre();

    const lignes = pressablesPortant(arbre, LIBELLE_LIGNE);
    expect(lignes).toHaveLength(1);

    await act(async () => {
      lignes[0].props.onPress();
    });

    expect(mockPortal).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('R3/b — un abonnement iPhone n\'affiche AUCUNE ligne : il se resilie chez Apple', () => {
    mockAuthValue = contexteAuth('apple');
    const arbre = rendre();

    expect(pressablesPortant(arbre, LIBELLE_LIGNE)).toHaveLength(0);
  });

  test('R3/c — portail indisponible : on DIT pourquoi, on ne laisse pas un bouton muet', async () => {
    // Le cas REEL d'aujourd'hui : aucune cle Stripe en production.
    mockPortal.mockResolvedValue({ opened: false, reason: 'stripe-not-configured' });
    const arbre = rendre();

    await act(async () => {
      pressablesPortant(arbre, LIBELLE_LIGNE)[0].props.onPress();
    });

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(String(mockAlert.mock.calls[0][0])).toContain('Gestion indisponible');
  });
});
