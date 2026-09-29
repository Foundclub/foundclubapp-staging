import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOffers from '../SubscriptionOffers';

/**
 * ABOPARCLUB (2026-09-29) — L'ECRAN DES OFFRES NE VEND PLUS RIEN A TRAVERS LES CLUBS.
 *
 * Decisions d'Adel du 29/09 : « niveau oui » et « abo2 A ». Le decor est celui
 * de la recette du 28/09 : un dirigeant paie « Club 100 » pour FoundClub Demo
 * et ouvre les offres depuis son autre club, AIKI. Avant ce lot :
 *  - le Club 100 s'affichait « Ton offre actuelle », bouton eteint ;
 *  - tout autre palier partait comme un CHANGEMENT de l'abonnement de Demo
 *    (`clubDocumentId` = AIKI, `subscriptionDocumentId` = celui de Demo) : la
 *    couverture de Demo aurait demenage vers AIKI.
 * Desormais : un NOUVEL abonnement pour AIKI la ou le magasin le permet, et,
 * sur iPhone (un seul abonnement par compte Apple dans le groupe FoundClub),
 * l'ecran dit franchement comment faire.
 * Pilote par ce que l'ecran REND et par ce que le rail RECOIT. Ecrit ROUGE, puis vert.
 */
/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogQueryState;
let mockRail = 'trusted-test';
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
      t: (/** @type {string} */ cle, /** @type {any} */ options, /** @type {any} */ valeurs) => {
        // I18N-1 : repli a {{jetons}} ou pluriel -> le vrai i18next (fr.js), comme l'app.
        if (
          (typeof options === 'string' && valeurs)
          || (options && typeof options === 'object' && 'defaultValue_one' in options)
        ) {
          return jest.requireActual('i18next').t(cle, options, valeurs);
        }
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
  getActiveSubscriptionPurchaseRail: () => mockRail,
  isSubscriptionPurchaseAvailable: () => true,
  performSubscriptionPlanChange: (/** @type {any} */ ...args) => mockPerformPlanChange(...args),
  performSubscriptionPurchase: (/** @type {any} */ ...args) => mockPerformPurchase(...args),
  SUBSCRIPTION_PURCHASE_RAILS: {
    REVENUECAT: 'revenuecat',
    STRIPE_WEB: 'stripe-web',
    TRUSTED_TEST: 'trusted-test',
  },
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

const DEMO = 'club-foundclub-demo';
const AIKI = 'club-aiki';
const MOI = 'u-dirigeant-demo-aiki';

/**
 * Une tranche Club du catalogue serveur.
 * @param {number} tier - le numero de tranche.
 * @param {string} displayName - son nom commercial.
 * @param {number | null} licenseeCap - son plafond de licencies.
 * @param {number} priceEurCents - son prix de reference.
 * @returns {any} - l entree de catalogue.
 */
const trancheClub = (tier, displayName, licenseeCap, priceEurCents) => ({
  billingPeriod: 'yearly',
  displayName,
  featureKeys: ['events.unlimited', 'club.profile'],
  isActive: true,
  licenseeCap,
  maxTeams: null,
  planCode: `fc_club_tier_${tier}_yearly`,
  providerProductId: `fc_club_tier_${tier}_yearly`,
  referencePriceEurCents: priceEurCents,
  requiresClubVerification: true,
  scopeType: 'CLUB',
  slotCount: null,
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
  trancheClub(1, 'Club 100', 100, 24999),
  trancheClub(2, 'Club 500', 500, 124999),
];

/**
 * Le contexte d'authentification du dirigeant de la recette du 28/09 : il paie
 * « Club 100 » pour FoundClub Demo ; `clubActif` est le club qu'il regarde.
 * Les niveaux sont ceux que calcule `useAuth` depuis ABOPARCLUB.
 * @param {string} clubActif - Le club affiche.
 * @param {string} [provider] - Le magasin de l'abonnement de Demo.
 * @returns {any} Le contexte a servir a l'ecran.
 */
const contexteAuth = (clubActif, provider = 'apple') => ({
  accountSubscriptionAccessLevel: 'CLUB_UNVERIFIED',
  allMyTeams: [{ club: { documentId: AIKI, name: 'AIKI' }, documentId: 'team-aiki-u13', name: 'U13' }],
  clubVerificationSummary: {
    clubDocumentId: clubActif,
    clubVerified: false,
    hasActiveClubEntitlement: clubActif === DEMO,
    requiresClubVerification: clubActif === DEMO,
  },
  entitlementsSummary: [{
    capability: '*',
    paidBy: { documentId: MOI, firstname: 'Adel', lastname: 'F' },
    scopeClubDocumentId: DEMO,
    scopeClubName: 'FoundClub Démo',
    scopeTeamDocumentId: null,
    scopeType: 'CLUB',
    status: 'active',
    subscriptionPlanCode: 'fc_club_tier_1_yearly',
  }],
  freeUsageSummary: [],
  subscriptionAccessLevel: clubActif === DEMO ? 'CLUB_UNVERIFIED' : 'FREE',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_1_yearly'],
    payerSubscriptionIds: ['sub-demo'],
    payerSubscriptionsSummary: [{
      autoRenew: true,
      billingPeriod: 'yearly',
      currentPeriodEnd: '2027-09-10T00:00:00.000Z',
      documentId: 'sub-demo',
      isTrial: false,
      planCode: 'fc_club_tier_1_yearly',
      provider,
      scopeClubDocumentIds: [DEMO],
      status: 'active',
    }],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
  userData: {
    club: { documentId: clubActif, name: clubActif === DEMO ? 'FoundClub Démo' : 'AIKI' },
    clubs: [{ documentId: AIKI, name: 'AIKI' }, { documentId: DEMO, name: 'FoundClub Démo' }],
    documentId: MOI,
    role: { name: 'Dirigeant', type: 'president' },
  },
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
 * Tous les pressables portant EXACTEMENT ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any[]}
 */
const pressablesPortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

/**
 * Libelle du CTA collant (derniere occurrence : il vit apres les cartes).
 * @param {any} arbre
 * @returns {string}
 */
const libelleDuCta = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .filter((/** @type {string} */ texte) => texte.startsWith('Choisir ')
    || texte === 'Ton offre actuelle'
    || texte === 'Gérer mes équipes couvertes'
    || texte === 'Offre indisponible')
  .pop() || '';

/**
 * Appuie sur le CTA collant.
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const appuyerSurLeCta = async (arbre) => {
  const cta = pressablesPortant(arbre, libelleDuCta(arbre)).pop();
  await act(async () => { cta.props.onPress(); });
};

/**
 * Appuie sur le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const [cible] = pressablesPortant(arbre, libelle);
  await act(async () => { cible.props.onPress(); });
};

/**
 * Va sur une carte du carrousel (1 = Equipe, 2 = Club).
 * @param {any} arbre
 * @param {number} index
 * @returns {Promise<void>}
 */
const allerALaCarte = async (arbre, index) => {
  const point = arbre.root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === `Carte ${index + 1} sur 3`);
  await act(async () => { point.props.onPress(); });
};

/**
 * Monte le carrousel pour ce dirigeant, depuis ce club.
 * @param {string} clubActif
 * @param {string} [provider]
 * @returns {Promise<any>} L arbre rendu.
 */
const rendre = async (clubActif, provider) => {
  mockAuthValue = contexteAuth(clubActif, provider);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOffers navigation={{ navigate: mockNavigate }} route={undefined} />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRail = 'trusted-test';
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  mockPerformPurchase.mockResolvedValue({ subscription: { currentPeriodEnd: null } });
  mockPerformPlanChange.mockResolvedValue({ subscription: { currentPeriodEnd: null } });
});

describe('ABOPARCLUB — depuis AIKI, l offre payee pour Demo n est ni « actuelle » ni modifiee', () => {
  it('le Club 100 (paye pour Demo) n est PAS « Ton offre actuelle » dans AIKI : il s achete', async () => {
    const arbre = await rendre(AIKI);
    await allerALaCarte(arbre, 2);

    expect(libelleDuCta(arbre)).toMatch(/^Choisir Club 100/);
  });

  it('choisir une offre Club depuis AIKI cree un NOUVEL abonnement pour AIKI — jamais l abonnement de Demo', async () => {
    const arbre = await rendre(AIKI);
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, '500');
    await appuyerSurLeCta(arbre);

    expect(mockPerformPlanChange).not.toHaveBeenCalled();
    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    const envoi = mockPerformPurchase.mock.calls[0][0];
    expect(envoi.catalogEntry.planCode).toBe('fc_club_tier_2_yearly');
    expect(envoi.clubDocumentId).toBe(AIKI);
    expect(envoi.subscriptionDocumentId).toBeUndefined();
  });

  it('une offre Equipe choisie depuis AIKI ne touche pas non plus l abonnement de Demo', async () => {
    const arbre = await rendre(AIKI);
    await allerALaCarte(arbre, 1);
    await appuyerSurLeCta(arbre);
    await appuyerSur(arbre, 'Activer cette offre');

    expect(mockPerformPlanChange).not.toHaveBeenCalled();
    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    expect(mockPerformPurchase.mock.calls[0][0].subscriptionDocumentId).toBeUndefined();
  });

  it('iPhone, abonnement Apple pour Demo : l ecran DIT comment faire, et n achete rien', async () => {
    mockRail = 'revenuecat';
    const arbre = await rendre(AIKI, 'apple');
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, '500');
    await appuyerSurLeCta(arbre);

    expect(mockPerformPurchase).not.toHaveBeenCalled();
    expect(mockPerformPlanChange).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const [titre, message, boutons] = mockAlert.mock.calls[0];
    expect(titre).toBe('Couvrir AIKI');
    expect(message).toContain('FoundClub Démo');
    expect(message).toContain('contact@foundclubpro.com');
    expect(boutons.map((/** @type {any} */ bouton) => bouton.text)).toEqual(['Fermer', 'Nous écrire']);
  });
});

describe('ABOPARCLUB — temoin « club couvert : inchange » depuis Demo', () => {
  it('le Club 100 y reste « Ton offre actuelle »', async () => {
    const arbre = await rendre(DEMO);
    await allerALaCarte(arbre, 2);

    expect(libelleDuCta(arbre)).toBe('Ton offre actuelle');
  });

  it('monter en Club 500 CHANGE l abonnement de Demo, meme sur iPhone', async () => {
    mockRail = 'revenuecat';
    const arbre = await rendre(DEMO, 'apple');
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, '500');
    await appuyerSurLeCta(arbre);

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockPerformPurchase).not.toHaveBeenCalled();
    expect(mockPerformPlanChange).toHaveBeenCalledTimes(1);
    const envoi = mockPerformPlanChange.mock.calls[0][0];
    expect(envoi.subscriptionDocumentId).toBe('sub-demo');
    expect(envoi.currentPlanCode).toBe('fc_club_tier_1_yearly');
    expect(envoi.clubDocumentId).toBe(DEMO);
  });
});
