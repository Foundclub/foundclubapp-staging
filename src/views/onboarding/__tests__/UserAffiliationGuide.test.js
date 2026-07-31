import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import UserAffiliationGuide, { AFFILIATION_TEST_IDS } from '../UserAffiliationGuide';

// FILET E6 — écrit AVANT la refonte L05 (« Trouve ton club », design 6b).
// Le fichier faisait 1 274 lignes et n'avait AUCUN test : sur une base à 5 424
// erreurs de type gelées, rien n'aurait dit qu'une branche retirée servait.
//
// Ces tests visent des COMPORTEMENTS qui doivent survivre au redesign, pas des
// libellés :
//   1. le titre de l'étape club,
//   2. sauter l'étape passe par getNextOnboardingRoute (« Continuer plus tard »
//      hier, « Passer » dans le header aujourd'hui),
//   3. la saisie arrive filtrée dans la requête clubs après le debounce,
//   4. liste vide => zéro club affiché, mais le chemin « je ne trouve pas mon
//      club » reste offert,
//   5. le joueur ayant choisi un club bascule sur l'étape ÉQUIPE (le redesign
//      ne couvre que l'étape club : cette branche ne doit pas disparaître).

const mockGetNextOnboardingRoute = jest.fn();
const mockUseGetClubs = jest.fn();
const mockUseGetTeams = jest.fn();
const mockRoleKey = { current: 'player' };

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // i18next rend le 2e argument chaîne comme defaultValue et interpole {{x}} :
    // le mock fait pareil, sinon les libellés a11y porteraient « {{name}} ».
    t: (
      /** @type {string} */ key,
      /** @type {any} */ fallback,
      /** @type {any} */ options,
    ) => {
      const template = typeof fallback === 'string' ? fallback : key;
      const values = typeof fallback === 'object' && fallback !== null ? fallback : options;
      if (!values) return template;
      return template.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ whole, /** @type {string} */ name) => (
          values[name] === undefined ? whole : String(values[name])
        ),
      );
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: () => mockRoleKey.current,
  markOnboardingComplete: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: mockGetNextOnboardingRoute,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    onboardingViews: { totalViews: 4, views: [{ index: 3, route: 'UserAffiliationGuide' }] },
    refetchUserData: jest.fn(),
    userData: { documentId: 'user-1', preferredSport: 'Football', role: { name: 'Joueur' } },
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubFiltersNumber: () => 0 }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ clubFilters: {} }, jest.fn()],
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseGetClubs(params, options)
  ),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseGetTeams(params, options)
  ),
}));

jest.mock('@/services/clubRequest/clubRequestService', () => ({
  createClubRequest: jest.fn(),
}));

// ScreenContainer tire @react-navigation/elements, publié en ESM : hors sujet ici.
jest.mock('@/components/templates/FormScreenContainer', () => {
  /* eslint-disable global-require */
  const React = require('react');
  const { View } = require('react-native');
  /* eslint-enable global-require */
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => React.createElement(View, null, children),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/onboardingOverlay/OnboardingOverlay', () => () => null);
jest.mock(
  '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint',
  () => () => null,
);

const emptyQuery = {
  data: { pages: [{ data: [] }] },
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isRefetching: false,
  refetch: jest.fn(),
};

const queryWith = (/** @type {any[]} */ data) => ({ ...emptyQuery, data: { pages: [{ data }] } });

const CLUBS = [
  {
    address: { label: '22 Boulevard des dames 13002 Marseille', lat: 43.3, lng: 5.37 },
    addressDetails: '22 Boulevard des dames 13002 Marseille',
    documentId: 'club-1',
    id: 1,
    name: 'FC Fuveau',
  },
  {
    addressDetails: '75001 Paris',
    documentId: 'club-2',
    id: 2,
    name: 'Paris Sportif',
  },
];

/**
 * Rend l'écran avec une navigation espionne.
 * Le header est posé par le navigateur : ses éléments (stepper, « Passer »)
 * ne vivent pas dans l'arbre de l'écran mais dans les options. On les capture
 * pour pouvoir les inspecter comme le reste.
 * @returns {{ tree: any, navigation: any, headerNodes: () => any[] }}
 */
const renderScreen = () => {
  /** @type {Record<string, any>} */
  const headerOptions = {};
  const navigation = {
    navigate: jest.fn(),
    reset: jest.fn(),
    setOptions: (/** @type {Record<string, any>} */ options) => Object.assign(
      headerOptions,
      options,
    ),
  };

  let tree;
  act(() => {
    tree = renderer.create(<UserAffiliationGuide navigation={navigation} />);
  });

  const headerNodes = () => ['headerTitle', 'headerRight', 'headerLeft']
    .map((slot) => (typeof headerOptions[slot] === 'function' ? headerOptions[slot]() : null))
    .filter(Boolean)
    .map((element) => {
      let headerTree;
      act(() => { headerTree = renderer.create(element); });
      return headerTree;
    });

  return { headerNodes, navigation, tree };
};

/**
 * Cherche une poignée de test dans l'écran, puis dans le header.
 * @param {{ tree: any, headerNodes: () => any[] }} rendered - Rendu de l'écran.
 * @param {string} testID - Poignée recherchée.
 * @returns {any} - Le premier nœud portant la poignée.
 */
const findHandle = (rendered, testID) => {
  const inScreen = rendered.tree.root.findAll((node) => node.props?.testID === testID);
  if (inScreen.length > 0) return inScreen[0];

  const found = rendered.headerNodes()
    .flatMap((headerTree) => headerTree.root.findAll((node) => node.props?.testID === testID));
  return found[0];
};

/**
 * Active la première zone tactile sous une poignée de test.
 * @param {{ tree: any, headerNodes: () => any[] }} rendered - Rendu de l'écran.
 * @param {string} testID - Poignée recherchée.
 * @returns {void}
 */
const pressHandle = (rendered, testID) => {
  const handle = findHandle(rendered, testID);
  expect(handle).toBeDefined();
  const touchable = handle.props?.onPress
    ? handle
    : handle.findAllByType(TouchableOpacity)[0];
  act(() => { touchable.props.onPress(); });
};

const collectTexts = (/** @type {any} */ tree) => tree.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => JSON.stringify(node.props.children))
  .join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockRoleKey.current = 'player';
  mockGetNextOnboardingRoute.mockReturnValue(RouteNames.Welcome);
  mockUseGetClubs.mockReturnValue(queryWith(CLUBS));
  mockUseGetTeams.mockReturnValue(emptyQuery);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('UserAffiliationGuide — étape club de l\'onboarding', () => {
  it('affiche le titre de l\'étape club', () => {
    const rendered = renderScreen();
    expect(collectTexts(rendered.tree)).toContain('Trouve ton club');
  });

  it('sauter l\'étape emmène à la route rendue par getNextOnboardingRoute', () => {
    const rendered = renderScreen();

    pressHandle(rendered, AFFILIATION_TEST_IDS.skip);

    expect(mockGetNextOnboardingRoute)
      .toHaveBeenCalledWith(RouteNames.UserAffiliationGuide);
    expect(rendered.navigation.navigate).toHaveBeenCalledWith(RouteNames.Welcome);
  });

  it('passe la saisie à la requête clubs une fois le debounce écoulé', () => {
    const rendered = renderScreen();
    const input = findHandle(rendered, AFFILIATION_TEST_IDS.search)
      .findAllByType(TextInput)[0];

    act(() => { input.props.onChangeText('  Fuveau  '); });
    act(() => { jest.advanceTimersByTime(400); });

    const lastCall = mockUseGetClubs.mock.calls.at(-1);
    expect(lastCall[0]).toMatchObject({ name: 'Fuveau' });
  });

  it('liste vide : aucune carte club, mais le chemin « club absent » reste offert', () => {
    mockUseGetClubs.mockReturnValue(queryWith([]));
    const rendered = renderScreen();

    const texts = collectTexts(rendered.tree);
    expect(texts).not.toContain('FC Fuveau');
    expect(findHandle(rendered, AFFILIATION_TEST_IDS.notFound)).toBeDefined();
  });

  it('affiche le nom des clubs trouvés', () => {
    const rendered = renderScreen();
    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('FC Fuveau');
    expect(texts).toContain('Paris Sportif');
  });

  it('ouvre la fiche club quand on touche une carte (dirigeant)', () => {
    mockRoleKey.current = 'president';
    const rendered = renderScreen();

    const card = rendered.tree.root
      .findAll((node) => typeof node.props?.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.includes('FC Fuveau')
        && typeof node.props?.onPress === 'function')[0];
    act(() => { card.props.onPress(); });

    expect(rendered.navigation.navigate).toHaveBeenCalledWith(
      RouteNames.ClubStack,
      expect.objectContaining({ screen: RouteNames.Club }),
    );
  });

  it('le joueur qui choisit un club bascule sur l\'étape ÉQUIPE', () => {
    const rendered = renderScreen();

    const card = rendered.tree.root
      .findAll((node) => typeof node.props?.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.includes('FC Fuveau')
        && typeof node.props?.onPress === 'function')[0];
    act(() => { card.props.onPress(); });

    expect(collectTexts(rendered.tree)).toContain('Trouve ton équipe');
    expect(mockUseGetTeams).toHaveBeenCalled();
  });
});
