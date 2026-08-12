import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import SubscriptionOffers from '../SubscriptionOffers';

// D89 — le carrousel d'offres sert desormais DEUX surfaces : le profil
// (« Changer d'offre », inchange) et le SAS DE FIN D'INSCRIPTION. Ce fichier
// mesure ce que la seconde ajoute, et surtout ce qu'elle ne doit jamais faire.
//
// LE RISQUE GRAVE DU LOT, ecrit en toutes lettres dans le prompt : un paywall
// obligatoire a la fin d'une inscription est un CUL-DE-SAC. La personne vient de
// remplir 4 a 8 ecrans ; si elle ne peut pas fermer celui-ci, elle n'entre
// JAMAIS dans l'app. Les trois quarts de ce fichier ne mesurent donc qu'une
// chose : il existe une porte de sortie, elle est VISIBLE, et elle mene a la
// bienvenue.
//
// Le sas se reconnait a UN parametre — `skipRouteName`, la destination de qui
// passe sans acheter. Pas de destination nommee = pas de bouton : une porte
// morte est impossible par construction, pas par precaution.
//
// Pilote par le TEXTE VISIBLE. Theme et traductions : les VRAIS modules.

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
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
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

jest.mock('react-native/Libraries/Alert/Alert', () => ({ alert: jest.fn() }));

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
    displayName: 'Club S',
    featureKeys: ['club.profile'],
    maxTeams: 3,
    planCode: 'fc_club_tier_1_yearly',
    referencePriceEurCents: 19999,
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
  await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');
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

describe('D89 ① — ON DOIT POUVOIR PASSER : le sas n\'est jamais un cul-de-sac', () => {
  it('la porte de sortie est un BOUTON, pas un lien gris en bas de page', async () => {
    const arbre = await rendre(COLIS_DU_SAS);

    const portes = pressablesPortant(arbre, LIBELLE_PASSER);
    expect(portes).toHaveLength(1);
    // `accessibilityRole="button"` est ce que la doublure de `Button` pose :
    // un `Text` cliquable ne le porterait pas.
    expect(portes[0].props.accessibilityRole).toBe('button');
    expect(portes[0].props.accessibilityState?.disabled).toBe(false);
  });

  it('elle mene a la BIENVENUE — jamais en arriere, jamais a l\'accueil', async () => {
    const arbre = await rendre(COLIS_DU_SAS);
    await appuyerSur(arbre, LIBELLE_PASSER);

    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('elle REMPLACE l\'ecran : le paywall ne peut plus revenir par le retour', async () => {
    // C'est le temoin de D81 pour ce lot. `replace` retire le paywall de la
    // pile ; depuis la bienvenue, le retour retombe donc la ou il retombait
    // AVANT ce lot — sur la derniere etape du tunnel, jamais sur l'offre.
    const arbre = await rendre(COLIS_DU_SAS);
    await appuyerSur(arbre, LIBELLE_PASSER);

    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('sans `replace` disponible, on navigue quand meme — aucune porte morte', async () => {
    mockAuthValue = contexteAuth();
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <SubscriptionOffers
          navigation={{ navigate: mockNavigate }}
          route={{ params: COLIS_DU_SAS }}
        />,
      );
    });
    await appuyerSur(arbre, LIBELLE_PASSER);

    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  it('le bouton d\'achat reste la : passer n\'est pas la seule issue', async () => {
    const arbre = await rendre(COLIS_DU_SAS);

    expect(textesDe(arbre).some((texte) => texte.startsWith('Choisir '))).toBe(true);
  });

  it('un role NON SERVI n\'est pas enferme sur une page blanche — il avance', async () => {
    // L'ecran rend `null` pour un joueur. `resolveOnboardingExitRoute` ne l'y
    // envoie jamais, mais la route est desormais montee dans la pile du tunnel,
    // donc joignable : le filet garantit qu'aucun appelant, present ou futur, ne
    // peut fermer la porte sur quelqu'un en fin d'inscription.
    const arbre = await rendre(COLIS_DU_SAS, {
      userData: { documentId: 'user-2', role: { name: 'Joueur', type: 'player' } },
    });

    expect(arbre.toJSON()).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.Welcome, undefined);
  });

  it('hors du sas, un role non servi rend toujours `null` sans naviguer', async () => {
    const arbre = await rendre(undefined, {
      userData: { documentId: 'user-2', role: { name: 'Joueur', type: 'player' } },
    });

    expect(arbre.toJSON()).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('D89 ② — la surface PROFIL ne bouge pas d\'un pixel', () => {
  it('« Changer d\'offre » depuis le profil n\'affiche AUCUNE porte de sortie', async () => {
    const arbre = await rendre();

    expect(pressablesPortant(arbre, LIBELLE_PASSER)).toHaveLength(0);
    expect(textesDe(arbre)).not.toContain(LIBELLE_PASSER);
  });

  it('un mur payant (origine sans destination de passage) n\'en affiche pas non plus', async () => {
    // L40 : `EventDetails` transporte bien un `resumeRouteName`, mais il n'est
    // PAS un sas d'inscription. Le bouton se declenche sur `skipRouteName`, et
    // sur lui seul.
    const arbre = await rendre({
      resumeRouteName: RouteNames.EventStack,
      resumeRouteParams: { screen: 'EventDetails' },
    });

    expect(pressablesPortant(arbre, LIBELLE_PASSER)).toHaveLength(0);
  });

  it('depuis le profil, l\'achat NAVIGUE comme avant — il ne remplace rien', async () => {
    const arbre = await rendre();
    await acheterClub(arbre);

    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.SubscriptionSuccess,
      expect.objectContaining({ resumeMode: 'home' }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('D89 ③ — CELUI QUI ACHETE : ou il arrive, et ce qu\'il lit', () => {
  it('l\'achat mene a l\'ecran de succes, qui vise ensuite la BIENVENUE', async () => {
    const arbre = await rendre(COLIS_DU_SAS);
    await acheterClub(arbre);

    expect(mockReplace).toHaveBeenCalledWith(
      RouteNames.SubscriptionSuccess,
      expect.objectContaining({
        resumeMode: 'route',
        resumeRouteName: RouteNames.Welcome,
      }),
    );
  });

  it('le sas REMPLACE aussi vers le succes : le paywall ne reste pas sous la pile', async () => {
    const arbre = await rendre(COLIS_DU_SAS);
    await acheterClub(arbre);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('le bouton du succes dit « Continuer », pas « Reprendre »', async () => {
    // « Reprendre » promet une tache interrompue (L40). En fin d'inscription il
    // n'y a rien a reprendre : le libelle voyage donc avec le colis. Un libelle
    // qui se trompe de destination est un defaut a part entiere.
    const arbre = await rendre(COLIS_DU_SAS);
    await acheterClub(arbre);

    expect(mockReplace.mock.calls[0][1].resumeCtaLabel).toBe('Continuer');
  });

  it('la portee annoncee vient de l\'ACHAT, jamais du cache d\'abonnement', async () => {
    // Lecon durable de L11/L08 : juste apres l'achat, le cache decrit encore
    // l'ANCIEN etat. Le contexte est ici reste `FREE` — l'ecran de succes doit
    // quand meme annoncer l'offre CLUB qui vient d'etre encaissee.
    const arbre = await rendre(COLIS_DU_SAS);
    await acheterClub(arbre);

    expect(mockReplace.mock.calls[0][1].offerScope).toBe('CLUB');
  });
});
