/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 📐 COLL-C2B-BIS (03/10) — planche 21 : SUR ORDINATEUR, le « … » d une installation ouvre un
// PETIT MENU ancré au bouton (design HY521H1, P4-ordi état A : « Voir le planning », « Modifier
// l installation », « Ouvrir dans le GPS »), pas une feuille du bas. Le téléphone garde sa feuille
// (témoin C2B « villeRestylee », inchangé). Harnais repris de ce témoin, passé sur ordinateur.
// ROUGE avant le lot : sur ordinateur aussi, le « … » ouvrait la feuille du bas (une fenêtre).

/** @type {any[]} */
const mockFeuillesOuvertes = [];
// R17-SIGNALER-1 : la carte et l accueil lisent le resume des signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useCollectiviteFacilityReportsSummary: () => ({ data: null }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => true }));

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockCollectiviteInstallations;
/** @type {any} */
let mockFacilityContext;
/** @type {any} */
let mockSemaines;
/** @type {any[]} */
const mockSemainesDemandees = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'as-montrivage' } } }),
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
      Images: { calendar: 3, edit: 2, pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => mockFacilityContext,
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage' }],
  }),
}));

jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: (/** @type {any[]} */ installations) => {
    mockSemainesDemandees.push(installations);
    return mockSemaines;
  },
}));

// COLL-C4B-BIS (03/10) : la carte d une installation de la Ville lit sa fermeture (bandeau).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations) => (
    Array.isArray(installations) && installations.length ? [{ data: installations, title: '' }] : []
  ),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 24 }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, 'ROUE');
});
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => function EmptyStateMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  if (isVisible) mockFeuillesOuvertes.push(true);
  return isVisible ? children : null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);

const GYMNASE = {
  address: { description: '12 rue des Tilleuls, Montrivage' },
  capacityConflictMode: 'pending_validation',
  closingTime: '22:00:00.000',
  documentId: 'gym-tilleuls',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  openingTime: '08:00:00.000',
  type: 'Gymnase',
};
const DOJO = {
  capacityConflictMode: 'allow_and_notify',
  closingTime: '22:00:00.000',
  documentId: 'dojo',
  maxSlots: 1,
  name: 'Dojo municipal',
  openingTime: '08:00:00.000',
  type: 'Dojo',
};

/** @type {any[]} */
const arbresMontes = [];
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<FacilityList />); });
  arbresMontes.push(arbre);
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.props?.onPress === 'function')[0];
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
  .find((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle));

beforeEach(() => {
  mockSemainesDemandees.length = 0;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
  mockCollectiviteInstallations = {
    data: [GYMNASE, DOJO], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
  mockFacilityContext = {
    data: { allFacilities: [], cmId: null },
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  };
  mockSemaines = {
    dojo: { count: 0, full: null },
    'gym-tilleuls': {
      count: 9,
      full: { end: new Date(2026, 9, 1, 19, 30), start: new Date(2026, 9, 1, 18, 0) },
    },
  };
});

afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

// Sur le banc, la vue native ne se mesure pas (une doublure) : on lui donne la place du bouton,
// x 1000, y 300, 44 x 44, comme le ferait le site.
const ancrerLesBoutons = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.collapsable === false && noeud.instance)
  .forEach((/** @type {any} */ noeud) => {
    // eslint-disable-next-line no-param-reassign
    noeud.instance.measureInWindow = (/** @type {Function} */ rappel) => rappel(1000, 300, 44, 44);
  });
const menu = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'menu-plus-dactions' && noeud.props?.accessibilityRole === 'menu')[0];

describe('COLL-C2B-BIS — planche 21 : le « … » ouvre un petit menu ancré, sur ordinateur', () => {
  beforeEach(() => { mockFeuillesOuvertes.length = 0; });

  it('un menu (pas une feuille du bas), ancré sous le bouton, avec ses trois gestes', () => {
    const arbre = rendre();
    ancrerLesBoutons(arbre);
    expect(menu(arbre)).toBeUndefined();
    act(() => { parLibelle(arbre, 'Plus d’actions pour Gymnase des Tilleuls').props.onPress(); });
    const ouvert = menu(arbre);
    expect(ouvert).toBeDefined();
    expect(mockFeuillesOuvertes).toHaveLength(0);
    const lus = ouvert.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());
    expect(lus).toEqual(['Voir le planning', 'Modifier l’installation', 'Ouvrir dans le GPS']);
    // Le bouton est en x 1000, y 300, 44 x 44 : le menu s ouvre 4 points dessous, son bord droit
    // aligné sur celui du bouton.
    const style = [].concat(ouvert.props.style).reduce((tout, part) => ({ ...tout, ...(part || {}) }), {});
    expect(style.top).toBe(348);
    expect(style.left + style.width).toBe(1044);
    // Chaque geste est un « menuitem » qui se touche.
    const gestes = ouvert.findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'menuitem' && typeof n.props?.onPress === 'function');
    const libelles = new Set(gestes.map((/** @type {any} */ n) => n.findAllByType(Text).map((/** @type {any} */ t) => aplatir(t.props.children).trim()).join('')));
    expect([...libelles]).toEqual(['Voir le planning', 'Modifier l’installation', 'Ouvrir dans le GPS']);
  });

  it('un geste ferme le menu et part ; toucher à côté le ferme', () => {
    const arbre = rendre();
    act(() => { parLibelle(arbre, 'Plus d’actions pour Gymnase des Tilleuls').props.onPress(); });
    act(() => { parTexte(arbre, 'Voir le planning').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PlanningWeekFullscreen', {
      contextDetailLabel: 'Gymnase des Tilleuls',
      facilityId: 'gym-tilleuls',
      // FINITIONS16 18 : le site garde le menu de la Ville sur ce planning.
      espace: 'ville',
      sourceType: 'facility',
    });
    expect(menu(arbre)).toBeUndefined();

    act(() => { parLibelle(arbre, 'Plus d’actions pour Gymnase des Tilleuls').props.onPress(); });
    expect(menu(arbre)).toBeDefined();
    act(() => { parLibelle(arbre, 'Fermer le menu').props.onPress(); });
    expect(menu(arbre)).toBeUndefined();
    expect(mockFeuillesOuvertes).toHaveLength(0);
  });

  it('sans adresse, le menu ne propose pas le GPS', () => {
    const arbre = rendre();
    act(() => { parLibelle(arbre, 'Plus d’actions pour Dojo municipal').props.onPress(); });
    const lus = menu(arbre).findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());
    expect(lus).toEqual(['Voir le planning', 'Modifier l’installation']);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// R17-PLANNING (20/10) : la section « Planning de toutes les installations » a son propre témoin
// (PlanningDesInstallations.R17PLAN.test.js) ; ici elle est doublée.
jest.mock(
  '@/components/organisms/planning/PlanningDesInstallations',
  () => function PlanningDesInstallationsDouble() { return null; },
);
