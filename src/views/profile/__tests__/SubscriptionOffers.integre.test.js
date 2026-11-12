import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import SubscriptionOffers from '../SubscriptionOffers';

// ABONNEMENT-MODELE (12/11, D89, retour d'Adel M1209 ligne 20) — « Mon abonnement » du SITE
// reprend le modele des offres de l'inscription : ce carrousel, POSE DANS la page
// (`integre`), au lieu de sa liste plate d'une carte par offre.
//
// Ce que l'option change, et rien d'autre :
//   - pas de cadre d'ecran (ScreenContainer) : la page du site a deja le sien ;
//   - jamais la sortie du sas d'inscription (« Continuer gratuitement ») : « Mon abonnement »
//     n'est pas la fin d'une inscription, meme si un colis de sas trainait dans la route.
// Ce qui ne change pas (temoins « inchange ») : les trois cartes, le bouton d'achat, l'achat
// lui-meme ; et SANS l'option, l'ecran est celui d'avant (telephone, /profile/subscription/offers).
//
// Doublures reprises de `SubscriptionOffers.onboarding.test.js` (memes raisons, ecrites la-bas).

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogQueryState;
/** @type {any} */
let mockStorePricesQueryState;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockPerformPurchase = jest.fn();
const mockPerformPlanChange = jest.fn();

// R07 point 6 — l'ecran lit desormais le retrait bas du telephone pour le
// confier au panneau du CTA. Sans ce double, `useSafeAreaInsets` cherche un
// fournisseur absent et la suite entiere tombe AVANT le premier rendu.
// 🧨 C'est le defaut « deux lots verts, une recolte rouge » : ce fichier-ci et
// `SubscriptionOffers.test.js` montent le MEME ecran, et seul le second avait
// ete relance apres le correctif.
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
      ? mockStorePricesQueryState
      : mockCatalogQueryState
  ),
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

// Le repli de `t()` est ce qui porte la copy de ce lot : `fr.js` n'est PAS
// touche. La doublure rend donc le repli, exactement comme le ferait i18next
// devant une cle absente.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      // I18N-1 : repli a {{jetons}} ou pluriel -> le vrai i18next (fr.js), comme l'app.
      if (
        (typeof repli === 'string' && valeurs)
        || (repli && typeof repli === 'object' && 'defaultValue_one' in repli)
      ) {
        return jest.requireActual('i18next').t(cle, repli, valeurs);
      }
      return typeof repli === 'string' ? repli : cle;
    },
  }),
}));

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
  SUBSCRIPTION_PURCHASE_RAILS: {
    NATIVE_STORE: 'NATIVE_STORE',
    TRUSTED_TEST: 'TRUSTED_TEST',
  },
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: jest.fn(),
  scheduleSubscriptionStateRefresh: jest.fn(),
}));

// Le theme est monte avec les VRAIS modules : un Proxy rendrait les echecs Jest
// illisibles, et la rampe `Spaces` a des trous qu'une doublure masquerait.
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
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
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
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>Prix TTC.</TexteRN>,
  };
});

// La doublure de `Button` rend un pressable qui PORTE SON TITRE : c'est ce qui
// permet de piloter par le texte visible sans monter le vrai atome.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      disabled, onPress, title, variant,
    }) => (
      <PressableRN
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={onPress}
        testID={`bouton-${variant}`}
      >
        <TexteRN>{title}</TexteRN>
      </PressableRN>
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
  const mockModule = { alert: jest.fn() };
  // RN 0.79 lit `require(module).default` la ou 0.78 lisait le module entier :
  // le mock sert les DEUX formes, pour survivre aux deux versions.
  return { ...mockModule, default: mockModule };
});

// Un catalogue MINIMAL : ce fichier ne mesure pas les prix (c'est le travail de
// `SubscriptionOffers.test.js`), seulement les portes de sortie.
const CATALOG_ENTRIES = [
  {
    billingPeriod: 'yearly',
    displayName: 'Équipe · 1 équipe',
    featureKeys: ['composition'],
    planCode: 'fc_team_1_yearly',
    referencePriceEurCents: 5999,
    scopeType: 'TEAM',
    slotCount: 1,
  },
  {
    billingPeriod: 'yearly',
    displayName: 'Club 100',
    featureKeys: ['club.profile'],
    licenseeCap: 100,
    maxTeams: null,
    planCode: 'fc_club_tier_1_yearly',
    referencePriceEurCents: 24999,
    scopeType: 'CLUB',
    slotCount: null,
  },
];

// Le colis que le sas d'inscription pose sur l'ecran (PrivateNavigator, via
// `initialParams`). C'est la seule chose qui distingue les deux surfaces.
const COLIS_DU_SAS = {
  resumeCtaLabel: 'Continuer',
  resumeRouteName: RouteNames.Welcome,
  skipRouteName: RouteNames.Welcome,
};

const contexteAuth = (surcharges = {}) => ({
  allMyTeams: [{ club: { name: 'AS Test' }, documentId: 'team-1', name: 'U15' }],
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  freeUsageSummary: [],
  subscriptionAccessLevel: 'FREE',
  subscriptionSummary: { activePlanCodes: [], payerSubscriptionIds: [] },
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
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tous les textes visibles de l'arbre.
 * @param {any} arbre
 * @returns {string[]}
 */
const textesDe = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).trim());

/**
 * Les pressables portant ce libelle exact.
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
 * Appuie sur le premier pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const candidats = pressablesPortant(arbre, libelle);
  if (candidats.length === 0) {
    throw new Error(`Aucun pressable ne porte le libelle « ${libelle} »`);
  }
  await act(async () => {
    candidats[0].props.onPress();
  });
};

/**
 * Fait defiler le carrousel jusqu'a la carte demandee (1 = Equipe, 2 = Club).
 * L'ouverture se fait sur Equipe : sans ce geste, le CTA d'achat CLUB — le seul
 * qui encaisse sans passer par la feuille de choix des equipes — n'est pas rendu.
 * @param {any} arbre
 * @param {number} index
 * @returns {Promise<void>}
 */
const allerALaCarte = async (arbre, index) => {
  const libelle = `Carte ${index + 1} sur 3`;
  const point = arbre.root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);
  await act(async () => {
    point.props.onPress();
  });
};

/**
 * Achete l'offre Club — le chemin d'achat le plus court de cet ecran.
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const acheterClub = async (arbre) => {
  await allerALaCarte(arbre, 2);
  await appuyerSur(arbre, 'Choisir Club 100 · 249,99 €/an');
};

/**
 * Monte le carrousel. `parametres` absent = la surface PROFIL, telle qu'elle
 * etait avant ce lot.
 * @param {Record<string, any> | undefined} [parametres]
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = undefined, surcharges = {}) => {
  mockAuthValue = contexteAuth(surcharges);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOffers
        navigation={{ navigate: mockNavigate, replace: mockReplace }}
        route={parametres ? { params: parametres } : undefined}
      />,
    );
  });
  return arbre;
};

// Le libelle de la porte de sortie, en un seul endroit : le test dit CE QUI EST
// A L'ECRAN, il ne recopie pas une constante du code teste.
const LIBELLE_PASSER = 'Continuer gratuitement';

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  mockStorePricesQueryState = { data: undefined, error: null, isLoading: false };
  mockPerformPurchase.mockResolvedValue({ ok: true });
});

/**
 * Monte le carrousel en mode « integre » (page « Mon abonnement » du site).
 * @param {Record<string, any> | undefined} [parametres]
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>}
 */
const rendreIntegre = async (parametres = undefined, surcharges = {}) => {
  mockAuthValue = contexteAuth(surcharges);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOffers
        integre
        navigation={{ navigate: mockNavigate, replace: mockReplace }}
        route={parametres ? { params: parametres } : undefined}
      />,
    );
  });
  return arbre;
};

describe('ABONNEMENT-MODELE — le modele pose dans « Mon abonnement » (integre)', () => {
  it('integre : pas de cadre d\'ecran, la page du site a deja le sien', async () => {
    const arbre = await rendreIntegre();
    expect(arbre.root.findAllByType(ScreenContainer).length).toBe(0);
  });

  it('integre : jamais la sortie du sas, meme avec un colis de sas', async () => {
    const arbre = await rendreIntegre(COLIS_DU_SAS);
    expect(pressablesPortant(arbre, LIBELLE_PASSER).length).toBe(0);
  });

  it('inchange : integre, trois cartes, Mensuel / Annuel et bouton d\'achat', async () => {
    const arbre = await rendreIntegre();
    const textes = textesDe(arbre);
    expect(textes).toEqual(expect.arrayContaining([
      'Mensuel',
      'Annuel',
      'Pour découvrir FoundClub',
      'Pour les coachs — ta ou tes équipes',
    ]));
    const dirigeants = 'Pour les dirigeants — équipes illimitées';
    expect(textes.some((texte) => texte.startsWith(dirigeants))).toBe(true);
    expect(pressablesPortant(arbre, 'Choisir Club 100 · 249,99 €/an')).toHaveLength(1);
  });

  it('inchange : integre, le bouton d\'achat achete comme avant', async () => {
    const arbre = await rendreIntegre();
    await acheterClub(arbre);
    expect(mockPerformPurchase).toHaveBeenCalledTimes(1);
    const [achat] = mockPerformPurchase.mock.calls[0];
    expect(achat.catalogEntry.planCode).toBe('fc_club_tier_1_yearly');
  });

  it('inchange : SANS l\'option, cadre d\'ecran et sortie du sas sont la', async () => {
    const arbre = await rendre(COLIS_DU_SAS);
    expect(arbre.root.findAllByType(ScreenContainer).length).toBe(1);
    expect(pressablesPortant(arbre, LIBELLE_PASSER).length).toBe(1);
  });
});
