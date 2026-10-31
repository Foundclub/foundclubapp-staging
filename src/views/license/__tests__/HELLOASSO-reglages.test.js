// HELLOASSO-TEST (30/10/2026) — la feuille « Réglages du club — HelloAsso ».
// 1. « Environnement » etait un champ libre prerempli « production » : une faute de frappe
//    envoyait le club vers le serveur HelloAsso de production. Deux pastilles, rien d autre.
// 2. Un echec disait seulement « Vérifie le slug organisation et les droits API », meme quand
//    HelloAsso donnait la vraie raison (le 30/10 : `metadata` mal forme, bug de NOTRE serveur).
//    La raison renvoyee par le serveur (`lastError`) est maintenant affichee.
// Meme harnais que ClubLicenses.test.js, sauf BottomModal qui rend ses enfants.
// I18N-1 : le code teste lit ses textes par i18next / t() (replis, interpolation) ;
// ce temoin initialise le VRAI i18next en francais (fr.js + replis), sans rien
// changer a ce qu'il affirme.
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

// D18 (E6) : `ClubLicenses.js` fait 2 138 lignes et n'avait AUCUN test. Ce
// fichier decrit ce que le DIRIGEANT LIT sur le hub des cotisations, juste
// AVANT sa refonte (capture de design `00-hub`).
//
// Il est pilote par le TEXTE VISIBLE, jamais par la forme de l'arbre : aucun
// `testID`, aucune profondeur, aucun pixel. C'est la seule couture qui survive
// au passage de 4 cartes de statistiques a un bloc de synthese.
//
// ⚠️ CE QUE CE FILET NE PEUT PAS VOIR, et il faut le savoir en le lisant :
// l'ecran est monte SANS son navigateur. Le doublon de titre du hub vient
// justement de la : `ClubStack.js:172` declare `headerTitle: 'Cotisations'` ET
// l'ecran rend son propre titre « Cotisations » (`ClubLicenses.js:1356`). Le
// test ne voit que le second. C'est exactement l'angle mort qui avait laisse
// passer les deux fleches de retour empilees du lot D2 : un test qui monte un
// ecran seul est structurellement aveugle a ce que son en-tete ajoute.

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockCampagnesRequete;
/** @type {any} */
let mockCampagneCouranteRequete;
/** @type {any} */
let mockCampagneParIdRequete;
/** @type {any} */
let mockTableauDeBordRequete;

const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutationFigee,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockAuthContexte,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockDonneesAuth,
}));

// `authUseCases` tire le magasin de session et la navigation : on le double
// entierement plutot que de faire dependre ce filet de la couche de stockage.
jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nomDeRole) => (
    String(nomDeRole || '').toLowerCase().includes('dirigeant') ? 'president' : 'new'
  ),
}));

// Le VRAI theme, sans le contexte React qui le porte : un Proxy rendrait les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseQueries', () => ({
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  useCurrentLicenseCampaign: () => mockCampagneCouranteRequete,
  useLicenseAssignments: () => mockRequeteVide,
  useLicenseCampaign: () => mockCampagneParIdRequete,
  useLicenseCampaigns: () => mockCampagnesRequete,
  useLicenseDashboard: () => mockTableauDeBordRequete,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({
  switchManagedClub: jest.fn(),
}));

// D26 : le hub porte desormais la feuille « Réglages du club — HelloAsso ».
// ⛔ Meme regle que partout : jamais `requireActual` sur un service. Celui-ci
// tire `celebrationRuntime`, qui lit un catalogue au chargement du module et
// fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children }) { return children; },
);

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});

jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() { return null; },
);

jest.mock('../MyLicenses', () => function MyLicensesMock() {
  return null;
});

// Le bouton est rendu comme un vrai element pressable PORTANT SON LIBELLE :
// c'est ce qui permet de piloter « le texte », que le libelle soit porte par un
// `Button` (avant la refonte) ou par un `Pressable` (apres).
jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return reactActuel.createElement(
    PressableRN,
    {
      accessibilityLabel: props.accessibilityLabel,
      accessibilityRole: 'button',
      disabled: props.disabled || props.isLoading,
      onPress: props.onPress,
    },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

const CAMPAGNE_OUVERTE = Object.freeze({
  currency: 'EUR',
  defaultAmountCents: 10000,
  documentId: 'camp-hub-1',
  documentRequests: [],
  name: 'Cotisation licences 2026/2027',
  paymentModes: { helloasso: true },
  paymentProviderSnapshot: {
    helloasso: {
      environment: 'sandbox',
      lastError: 'HelloAsso 400 : metadata: Deserialized JSON type is not compatible',
      organizationSlug: 'club-sportif-de-test',
      readiness: 'checkout_failed',
    },
  },
  seasonLabel: 'Saison 2026-2027',
  status: 'active',
  totals: {
    expectedCents: 10000,
    manualReviewCount: 0,
    overdueCount: 0,
    paidCents: 0,
    remainingCents: 10000,
    total: 1,
  },
});

/**
 * Recolte tout le texte reellement affiche, dans l'ordre de lecture.
 * @param {any} noeud
 * @param {string[]} [collecteur]
 * @returns {string[]}
 */
const recolterTextes = (noeud, collecteur = []) => {
  if (noeud === null || noeud === undefined || noeud === false) return collecteur;
  if (typeof noeud === 'string' || typeof noeud === 'number') {
    const texte = String(noeud).trim();
    if (texte) collecteur.push(texte);
    return collecteur;
  }
  if (Array.isArray(noeud)) {
    noeud.forEach((enfant) => recolterTextes(enfant, collecteur));
    return collecteur;
  }
  recolterTextes(noeud.children, collecteur);
  return collecteur;
};

/**
 * Tout le texte de l'ecran.
 * @param {any} arbre
 * @returns {string} Tout le texte de l'ecran, colle bout a bout.
 *
 * Les espaces insecables sont ramenes a des espaces ordinaires : `Intl` en
 * glisse une (U+202F) devant le « € » en francais, invisible a l'oeil mais qui
 * fait echouer une comparaison de chaine ecrite au clavier.
 */
const texteDeLEcran = (arbre) => recolterTextes(arbre.toJSON())
  .join(' | ')
  .replace(/[\u00a0\u202f]/g, ' ');

/**
 * Dernier arbre monte. Il est demonte apres chaque test : la `FlatList` du hub
 * arme un minuteur differe (`Batchinator`) qui, s'il survit a la fin de la
 * suite, fait tomber le processus Jest ENTIER avec un message trompeur
 * (« import after the Jest environment has been torn down »).
 * @type {any}
 */
let arbreCourant = null;

/**
 * Monte le hub des cotisations, vu par un dirigeant.
 * @param {any} [surcharges] - Etat des requetes a simuler.
 * @returns {any} L'arbre rendu du hub, vu par un dirigeant.
 */
const monterHub = (surcharges = {}) => {
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-hub',
    clubs: [{ documentId: 'club-hub', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockCampagneCouranteRequete = surcharges.campagneCourante || {
    data: CAMPAGNE_OUVERTE, isError: false, isLoading: false,
  };
  mockCampagnesRequete = surcharges.campagnes || {
    data: { data: [CAMPAGNE_OUVERTE] }, isError: false, isLoading: false,
  };
  mockCampagneParIdRequete = surcharges.campagneParId || mockRequeteVide;
  mockTableauDeBordRequete = surcharges.tableauDeBord || mockRequeteVide;

  const route = {
    name: surcharges.routeName || 'ClubLicenses',
    params: { clubId: 'club-hub', ...(surcharges.params || {}) },
  };
  const navigation = {
    addListener: () => () => {},
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ClubLicenses navigation={navigation} route={route} />);
  });
  arbreCourant = arbre;
  return arbre;
};

/**
 * Appuie sur le premier element pressable qui porte ce texte.
 * @param {any} arbre
 * @param {string} libelle - texte porte par l element pressable.
 */
const appuyerSur = (arbre, libelle) => {
  const cible = arbre.root.findAll((noeud) => typeof noeud.props?.onPress === 'function'
    && noeud.findAll((enfant) => typeof enfant.props?.children === 'string'
      && enfant.props.children.includes(libelle)).length > 0)[0];
  if (!cible) throw new Error(`rien d appuyable sous « ${libelle} »`);
  act(() => cible.props.onPress());
};

const REPONSE_ECHEC = {
  snapshot: {
    environment: 'sandbox',
    lastError: 'HelloAsso 400 : metadata: Deserialized JSON type is not compatible',
    organizationSlug: 'club-sportif-de-test',
    readiness: 'checkout_failed',
  },
};

describe('HELLOASSO — la feuille des reglages HelloAsso du club', () => {
  const mutateDOrigine = mockMutationFigee.mutate;
  afterEach(() => {
    mockMutationFigee.mutate = mutateDOrigine;
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('apres « Vérifier la connexion », affiche la raison donnee par HelloAsso', () => {
    mockMutationFigee.mutate = jest.fn((_variables, rappels) => rappels.onSuccess(REPONSE_ECHEC));
    const arbre = monterHub();
    appuyerSur(arbre, 'Réglages du club — HelloAsso');
    appuyerSur(arbre, 'Vérifier la connexion');
    expect(texteDeLEcran(arbre)).toContain('metadata: Deserialized JSON type is not compatible');
  });

  // HELLOASSOASSIST (31/10) — sur le hub, aucune campagne n est ouverte (`campaign` vaut null) :
  // la feuille disait « pas encore configurée » pour un compte actif, tant qu on n avait pas
  // rappuye sur « Vérifier la connexion ».
  it('compte du club actif : la feuille le lit sans « Vérifier la connexion »', () => {
    const arbre = monterHub({
      campagnes: {
        data: {
          data: [CAMPAGNE_OUVERTE],
          meta: {
            helloAssoAccounts: {
              multisport: null,
              section: { readiness: 'webhook_pending', scope: 'section', status: 'active' },
            },
          },
        },
        isError: false,
        isLoading: false,
      },
    });
    appuyerSur(arbre, 'Réglages du club — HelloAsso');
    expect(texteDeLEcran(arbre)).toContain('Le premier paiement doit encore confirmer le webhook');
  });

  it('propose l environnement en deux pastilles, plus en champ libre', () => {
    const arbre = monterHub();
    appuyerSur(arbre, 'Réglages du club — HelloAsso');

    const champsLibres = arbre.root.findAll(
      (noeud) => noeud.props?.placeholder === 'production ou sandbox',
    );
    expect(champsLibres).toHaveLength(0);

    const pastille = (libelle) => arbre.root.find((noeud) => (
      noeud.props?.accessibilityLabel === `Environnement : ${libelle}`
      && typeof noeud.props.onPress === 'function'
    ));
    expect(pastille('Production').props.accessibilityState.selected).toBe(true);
    expect(pastille('Bac à sable (sandbox)').props.accessibilityState.selected).toBe(false);

    act(() => pastille('Bac à sable (sandbox)').props.onPress());
    expect(pastille('Bac à sable (sandbox)').props.accessibilityState.selected).toBe(true);
    expect(pastille('Production').props.accessibilityState.selected).toBe(false);
  });
});
