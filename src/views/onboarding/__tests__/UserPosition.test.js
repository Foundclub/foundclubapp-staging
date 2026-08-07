import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import UserPosition from '../UserPosition';

// D23 — moitie « ecran » du defaut (2). L'ecran Poste porte desormais deux
// responsabilites, et aucune n'etait testee :
//   1. il lit le sport RECU EN PARAMETRE (`route.params.selectedSport`).
//      Cette plomberie existait deja mais personne ne s'en servait : l'ecran
//      attendait que `get-me` soit rafraichi, ce qui n'arrive pas dans le meme
//      tour de rendu que la navigation.
//   2. il SE RETIRE quand il n'a rien a montrer (sport sans postes, ou aucun
//      sport). C'est ce garde-fou qui autorise l'etape a rester au programme
//      tant que le sport n'est pas repondu — la condition pour que
//      `PrivateNavigator` la monte.
//
// Le repli « liste du football » a ete supprime : il montrait des postes de
// football a un rugbyman, et il masquait le cas « aucun sport ».

const mockGetNextOnboardingRoute = jest.fn();
const mockUserData = { current: /** @type {any} */ ({ documentId: 'user-d23' }) };

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data)),
  }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: mockGetNextOnboardingRoute,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    refetchUserData: jest.fn(),
    userData: mockUserData.current,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn(() => Promise.resolve({})) }));

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ disabled, onPress, title }) => (
      <RNTouchable accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <RNText>{title}</RNText>
      </RNTouchable>
    ),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }) => <RNText>{title}</RNText> };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress }) => (
      <RNTouchable accessibilityRole="button" onPress={onPress}>
        <RNText>Passer</RNText>
      </RNTouchable>
    ),
  };
});

const rendre = (params) => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <UserPosition
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params })}
      />,
    );
  });
  return { navigation, tree: /** @type {any} */ (arbre) };
};

const textes = (tree) => tree.root
  .findAllByType(Text)
  .map((node) => node.props.children)
  .flat()
  .filter((value) => typeof value === 'string');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNextOnboardingRoute.mockReturnValue(RouteNames.UserPhysique);
  mockUserData.current = { documentId: 'user-d23' };
});

describe('UserPosition — le sport arrive en parametre (D23 (2))', () => {
  it('Rugby en parametre : les postes de rugby, pas ceux du football', () => {
    const { navigation, tree } = rendre({ selectedSport: 'Rugby' });

    expect(textes(tree)).toEqual(expect.arrayContaining(['Pilier', 'Talonneur', 'Demi de mêlée']));
    expect(textes(tree)).not.toContain('Avant-centre');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('sans parametre, le sport du profil fait foi', () => {
    mockUserData.current = { documentId: 'user-d23', preferredSport: 'Basketball' };
    const { tree } = rendre(undefined);

    expect(textes(tree)).toEqual(expect.arrayContaining(['Meneur', 'Pivot']));
  });
});

describe('UserPosition — l`ecran se retire quand il n`a rien a montrer (D23 (2))', () => {
  it('aucun sport : il repart par la machine a etapes, sans rien afficher', () => {
    const { navigation, tree } = rendre(undefined);

    // C'ETAIT LE TROU : sans sport, l'ecran affichait la liste du FOOTBALL.
    expect(textes(tree)).not.toContain('Avant-centre');
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserPhysique);
  });

  it('sport sans postes : meme sortie', () => {
    const { navigation } = rendre({ selectedSport: 'Tennis' });

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserPhysique);
  });

  it('en fin de parcours, il retombe sur l`accueil plutot que nulle part', () => {
    mockGetNextOnboardingRoute.mockReturnValue(undefined);
    const { navigation } = rendre(undefined);

    expect(navigation.navigate).toHaveBeenCalledWith('HomeTab');
  });
});
