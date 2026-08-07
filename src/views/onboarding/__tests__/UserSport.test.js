import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getOnboardingViews } from '@/domains/auth/authUseCases';

import { RouteNames } from '@/navigation/routeNames';

import UserSport from '../UserSport';

// D23 — defaut (2) : « choisir Rugby puis avancer, l'etape Poste ne s'affiche
// pas ». Ce filet reproduit la chaine COMPLETE, y compris le maillon qui
// manquait a tous les tests precedents : `PrivateNavigator` ne monte que les
// ecrans dont `canShow` est vrai, donc `navigation.getState().routeNames` ne
// contient QUE ceux-la. `UserSport` filtre sa destination sur cette liste
// (`resolveAvailableRoute`) : une etape non montee est silencieusement
// remplacee par la suivante.
//
// Avant le correctif : sport encore vide ⇒ `UserPosition.canShow` faux ⇒ pas
// dans `routeNames` ⇒ le joueur atterrissait sur « Physique ». Pour les 5
// sports a postes, pas seulement le rugby.

const mockUserData = { current: /** @type {any} */ (null) };
const mockUpdateMe = jest.fn(() => Promise.resolve({}));
const mockActivities = { current: /** @type {any[]} */ ([]) };

jest.mock('../../../store/appContext', () => ({
  storage: {
    getBoolean: () => false,
    getString: () => null,
    set: () => {},
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data))
      .catch((error) => options.onError?.(error)),
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

// La VRAIE machine a etapes, pas une doublure : c'est elle qu'on met en cause.
jest.mock('@/domains/auth/useAuth', () => {
  const { getOnboardingViews: build } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      getNextOnboardingRoute: (/** @type {string} */ current) => {
        const { views } = build(mockUserData.current);
        const currentIndex = views.find((view) => view.route === current)?.index || 0;
        return views.find((view) => view.canShow && view.index > currentIndex)?.route;
      },
      getPostOnboardingHomeRoute: () => 'HomeTab',
      refetchUserData: jest.fn(),
      userData: mockUserData.current,
      userDataError: null,
      userDataLoading: false,
    }),
  };
});

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: mockActivities.current,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ payload) => mockUpdateMe(payload),
}));

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

const SPORTS = [
  { documentId: 'act-foot', name: 'Football' },
  { documentId: 'act-rugby', name: 'Rugby' },
  { documentId: 'act-basket', name: 'Basketball' },
  { documentId: 'act-hand', name: 'Handball' },
  { documentId: 'act-volley', name: 'Volleyball' },
  { documentId: 'act-tennis', name: 'Tennis' },
];

const joueur = () => ({
  birthdate: '2000-01-01',
  documentId: 'user-d23',
  firstname: 'Ada',
  lastname: 'Test',
  role: { name: 'Joueur' },
});

// LE MAILLON MANQUANT : `PrivateNavigator` monte ses ecrans sur `canShow`.
// `routeNames` reproduit donc exactement ce que le navigateur contient.
const routeNamesMontes = () => getOnboardingViews(mockUserData.current)
  .views
  .filter((view) => view.canShow)
  .map((view) => view.route);

const rendre = () => {
  const navigation = {
    getState: () => ({ routeNames: routeNamesMontes() }),
    navigate: jest.fn(),
  };
  let arbre;
  act(() => {
    arbre = renderer.create(<UserSport navigation={/** @type {any} */ (navigation)} />);
  });
  return { navigation, tree: /** @type {any} */ (arbre) };
};

const pressable = (tree, libelle) => tree.root
  .findAllByType(TouchableOpacity)
  .find((node) => node.findAllByType(Text)
    .some((texte) => String(texte.props.children) === libelle));

const choisirPuisContinuer = async (tree, sport) => {
  await act(async () => { pressable(tree, sport).props.onPress(); });
  await act(async () => { pressable(tree, 'Continuer').props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockActivities.current = SPORTS;
  mockUserData.current = joueur();
});

describe('UserSport — le sport choisi conduit a l`etape Poste (D23 (2))', () => {
  it.each(['Rugby', 'Football', 'Basketball', 'Handball', 'Volleyball'])(
    '%s : la suite est l`etape Poste, pas Physique',
    async (sport) => {
      const { navigation, tree } = rendre();
      await choisirPuisContinuer(tree, sport);

      expect(mockUpdateMe).toHaveBeenCalledWith({ preferredSport: sport });
      expect(navigation.navigate).toHaveBeenCalledWith(
        RouteNames.UserPosition,
        { selectedSport: sport },
      );
    },
  );

  it('le sport voyage en parametre : l`ecran Poste n`attend pas le rafraichissement', async () => {
    const { navigation, tree } = rendre();
    await choisirPuisContinuer(tree, 'Rugby');

    // `get-me` n'est pas encore revenu quand on navigue : sans ce parametre,
    // l'ecran Poste ne saurait pas quel sport afficher.
    expect(navigation.navigate.mock.calls[0][1]).toEqual({ selectedSport: 'Rugby' });
  });

  it('un sport sans postes va directement a l`etape Physique', async () => {
    const { navigation, tree } = rendre();
    await choisirPuisContinuer(tree, 'Tennis');

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserPhysique, undefined);
  });
});

describe('UserSport — « Passer » saute aussi l`etape Poste (D23 (2))', () => {
  it('sans sport, on ne traverse pas l`ecran Poste : on va a Physique', async () => {
    const { navigation, tree } = rendre();
    await act(async () => { pressable(tree, 'Passer').props.onPress(); });

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserPhysique);
  });
});
