import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOffers from '../SubscriptionOffers';

/**
 * VITRINE — L APP CELEBRE UN ACHAT QUE LE SERVEUR A REFUSE.
 *
 * Mesure de production du 2026-09-04 : le rail avale l erreur de validation et
 * rend `{ pendingWebhook: true, validationError: true }`. `validationError` n a
 * AUCUN lecteur dans tout `app/src` : l ecran part vers « C est debloque ! »
 * sans jamais tester ce champ, et annonce une date de renouvellement calculee
 * sur l horloge du telephone.
 *
 * Pilote par la NAVIGATION et l ALERTE, jamais par des pixels.
 */

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogQueryState;
const mockAlert = jest.fn();
const mockPerformPurchase = jest.fn();
const mockPerformPlanChange = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQuery: (/** @type {any} */ options) => (
    String(options?.queryKey?.[0]) === 'subscription-store-prices'
      ? { data: undefined, error: null, isLoading: false }
      : mockCatalogQueryState
  ),
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  /**
   * Lit une cle de traduction, segment par segment.
   * @param {string[]} chemin
   * @returns {any} La valeur trouvee, ou undefined.
   */
  const lire = (chemin) => chemin.reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const valeur = lire(String(cle || '').split('.'));
        if (typeof valeur === 'string') return valeur;
        return typeof options === 'string' ? options : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  getSubscriptionCatalog: jest.fn(),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  getActiveSubscriptionPurchaseRail: () => 'NATIVE_STORE',
  isSubscriptionPurchaseAvailable: () => true,
  performSubscriptionPlanChange: (/** @type {any} */ ...args) => mockPerformPlanChange(...args),
  performSubscriptionPurchase: (/** @type {any} */ ...args) => mockPerformPurchase(...args),
  SUBSCRIPTION_PURCHASE_RAILS: { NATIVE_STORE: 'NATIVE_STORE', TRUSTED_TEST: 'TRUSTED_TEST' },
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: jest.fn(),
  scheduleSubscriptionStateRefresh: jest.fn(),
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
      Images: { arrowRight: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <VueRN /> };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <PressableRN
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={onPress}
      >
        <TexteRN>{title}</TexteRN>
      </PressableRN>
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN, View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, value }) => (
      <VueRN><SaisieRN onChangeText={onChangeText} value={value} /></VueRN>
    ),
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => {
  const { TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isChecked, setIsChecked }) => (
      <PressableRN
        accessibilityRole="checkbox"
        accessibilityState={{ checked: Boolean(isChecked) }}
        onPress={setIsChecked}
      >
        {children}
      </PressableRN>
    ),
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = { alert: (/** @type {any} */ ...args) => mockAlert(...args) };
  return { ...mockModule, default: mockModule };
});

const CATALOG_ENTRIES = [
  {
    billingPeriod: 'yearly',
    displayName: 'Équipe · 1 équipe',
    featureKeys: ['events.unlimited'],
    isActive: true,
    licenseeCap: null,
    maxTeams: null,
    planCode: 'fc_team_1_yearly',
    providerProductId: 'fc_team_1_yearly',
    referencePriceEurCents: 5999,
    requiresClubVerification: false,
    scopeType: 'TEAM',
    slotCount: 1,
  },
  {
    billingPeriod: 'yearly',
    displayName: 'Club Illimité',
    featureKeys: ['events.unlimited', 'club.profile'],
    isActive: true,
    licenseeCap: null,
    maxTeams: null,
    planCode: 'fc_club_tier_4_yearly',
    providerProductId: 'fc_club_tier_4_yearly',
    referencePriceEurCents: 93999,
    requiresClubVerification: true,
    scopeType: 'CLUB',
    slotCount: null,
  },
];

/**
 * Le contexte d authentification, dans la forme exacte rendue par useAuth.
 * @param {Record<string, any>} [surcharges]
 * @returns {any} Le contexte a servir a l ecran.
 */
const contexteAuth = (surcharges = {}) => ({
  allMyTeams: [{ club: { name: 'AS Test' }, documentId: 'team-1', name: 'U15' }],
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  freeUsageSummary: [],
  subscriptionAccessLevel: 'FREE',
  subscriptionSummary: {
    activePlanCodes: [],
    payerSubscriptionIds: [],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
  userData: {
    club: { documentId: 'club-1' },
    documentId: 'user-1',
    role: { name: 'Dirigeant', type: 'president' },
  },
  ...surcharges,
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string} Le texte concatene.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Appuie sur le DERNIER pressable dont le libelle commence ainsi (le CTA collant).
 * @param {any} arbre
 * @param {string} debutDuLibelle
 * @returns {Promise<void>} Quand le rendu a fini de reagir.
 */
const appuyerSurLeCta = async (arbre, debutDuLibelle) => {
  const cible = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => noeud
      .findAllByType(Text)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children)
        .trim()
        .startsWith(debutDuLibelle)))
    .pop();
  if (!cible) {
    throw new Error(`Aucun pressable ne commence par « ${debutDuLibelle} »`);
  }
  await act(async () => { cible.props.onPress(); });
};

/**
 * Va sur la carte Club (index 2 du carrousel : Gratuit, Équipe, Club).
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const allerSurLaCarteClub = async (arbre) => {
  const point = arbre.root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Carte 3 sur 3');
  await act(async () => { point.props.onPress(); });
};

/**
 * Monte le carrousel avec le contexte d authentification demande.
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>} L arbre rendu.
 */
const rendre = async (surcharges = {}) => {
  mockAuthValue = contexteAuth(surcharges);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOffers navigation={{ navigate: mockNavigate }} route={undefined} />,
    );
  });
  return arbre;
};

/**
 * Ce que l ecran de succes a recu, ou null s il n a jamais ete ouvert.
 * @returns {any} Les params de navigation, ou null.
 */
const paramsDuSucces = () => {
  const appel = mockNavigate.mock.calls
    .find((/** @type {any[]} */ args) => String(args[0]) === 'SubscriptionSuccess');
  return appel ? appel[1] : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  mockPerformPurchase.mockResolvedValue({ subscription: { currentPeriodEnd: null } });
});

describe('T1 — le refus se voit', () => {
  it('le serveur refuse : AUCUN ecran de succes, et la personne lit ce qu il a dit', async () => {
    mockPerformPurchase.mockResolvedValue({
      pendingWebhook: true,
      purchase: { productIdentifier: 'fc_club_tier_4_yearly', transactionIdentifier: 'GPA.42' },
      serverRefused: true,
      validationError: true,
      validationErrorMessage: 'Ce club est déjà couvert par une offre Club active '
        + '(souscrite par un autre membre). Inutile de payer deux fois : les droits sont partages.',
    });

    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);
    await appuyerSurLeCta(arbre, 'Choisir Club');

    expect(paramsDuSucces()).toBeNull();
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(String(mockAlert.mock.calls[0][1]))
      .toContain('Ce club est déjà couvert par une offre Club active');
  });

  it('le serveur ne repond PAS : on ne l accuse de rien, on annonce la verification', async () => {
    mockPerformPurchase.mockResolvedValue({
      pendingWebhook: true,
      purchase: { productIdentifier: 'fc_club_tier_4_yearly', transactionIdentifier: 'GPA.42' },
      serverRefused: false,
      validationError: true,
    });

    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);
    await appuyerSurLeCta(arbre, 'Choisir Club');

    // Une coupure reseau ne doit JAMAIS dire « ton achat a ete refuse » a
    // quelqu un qui a paye : on ne sait pas encore, on le dit.
    expect(mockAlert).not.toHaveBeenCalled();
    expect(paramsDuSucces()).toMatchObject({ pendingActivation: true });
  });
});

describe('T2 — le succes reste un succes (LE FILET)', () => {
  it('un achat valide celebre exactement comme avant', async () => {
    mockPerformPurchase.mockResolvedValue({
      subscription: { currentPeriodEnd: '2027-07-10T09:00:00.000Z', documentId: 'sub-9' },
    });

    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);
    await appuyerSurLeCta(arbre, 'Choisir Club');

    expect(mockAlert).not.toHaveBeenCalled();
    expect(paramsDuSucces()).toMatchObject({
      clubDocumentId: 'club-1',
      offerLabel: 'Club Illimité',
      offerScope: 'CLUB',
    });
  });
});

describe('T4 — la date ne s invente pas', () => {
  it('sans date du serveur : AUCUNE date affichee, et une activation annoncee', async () => {
    mockPerformPurchase.mockResolvedValue({
      pendingWebhook: true,
      purchase: { productIdentifier: 'fc_club_tier_4_yearly', transactionIdentifier: '' },
    });

    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);
    await appuyerSurLeCta(arbre, 'Choisir Club');

    const params = paramsDuSucces();
    expect(params.renewalDateLabel).toBeUndefined();
    expect(params.pendingActivation).toBe(true);
  });

  it('avec une date du serveur : c est CETTE date, pas l horloge du telephone', async () => {
    mockPerformPurchase.mockResolvedValue({
      subscription: { currentPeriodEnd: '2027-07-10T09:00:00.000Z', documentId: 'sub-9' },
    });

    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);
    await appuyerSurLeCta(arbre, 'Choisir Club');

    const params = paramsDuSucces();
    expect(params.renewalDateLabel).toBe('10 juillet 2027');
    expect(params.pendingActivation).toBe(false);
  });
});
