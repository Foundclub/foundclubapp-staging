import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserSection from '../UserSection';

// FILET E6 — l'ecran n'avait AUCUN test avant ce lot (D56).
//
// Les trois premiers cas DECRIVENT LE COMPORTEMENT ACTUEL (caracterisation) :
// la liste, le bouton mort tant que rien n'est choisi, l'enregistrement.
// Le quatrieme est le DEFAUT : l'etape Section est facultative comme toutes
// les autres du tunnel, mais elle n'offrait aucun moyen de la passer — un
// utilisateur sans section restait coince, bouton grise, sans issue.
//
// Les tests visent des COMPORTEMENTS, pas des libelles.

const mockGetNextOnboardingRoute = jest.fn();
const mockUpdateMe = jest.fn();
const mockUseGetSections = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUserData = {
  current: /** @type {any} */ ({ documentId: 'user-1' }),
};

jest.mock('@tanstack/react-query', () => ({
  // Doublure minimale : `mutate` appelle vraiment `mutationFn` puis `onSuccess`.
  // Sans ca, le test ne prouverait que le rendu, jamais l'enregistrement.
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data))
      .catch((error) => options.onError?.(error)),
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
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
    refetchUserData: jest.fn(),
    userData: mockUserData.current,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => mockUseGetSections(),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ payload) => mockUpdateMe(payload),
}));

// Doublures d'affichage : un pressable qui PORTE son titre. Les tests peuvent
// alors viser le texte visible plutot que la forme de l'arbre.
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
  return {
    __esModule: true,
    default: ({ children }) => <RNView>{children}</RNView>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => <RNView>{children}</RNView>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ title }) => <RNText>{title}</RNText>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress }) => (
      <RNTouchable accessibilityRole="button" onPress={onPress}>
        <RNText>Passer cette étape</RNText>
      </RNTouchable>
    ),
  };
});

const SECTIONS = [
  { documentId: 'sec-1', name: 'Masculine' },
  { documentId: 'sec-2', name: 'Féminine' },
];

const sectionsQuery = (/** @type {any[]} */ sections) => ({
  data: sections,
  error: null,
  isLoading: false,
  refetch: jest.fn(),
});

const rendre = () => {
  const navigation = {
    getState: () => ({ routeNames: ['UserSection', 'UserAddress', 'UserAvatar'] }),
    navigate: jest.fn(),
  };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <UserSection
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({})}
      />,
    );
  });
  const tree = /** @type {any} */ (arbre);
  return { navigation, tree };
};

// Tous les textes rendus, a plat — le test lit ce que l'utilisateur lit.
const textes = (/** @type {any} */ tree) => tree.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => node.props.children)
  .flat()
  .filter((/** @type {any} */ value) => typeof value === 'string');

// Le pressable dont le libelle commence par `debut`.
const pressableIntitule = (/** @type {any} */ tree, /** @type {string} */ debut) => tree.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => {
    const contenu = node.findAllByType(Text)
      .map((/** @type {any} */ noeud) => noeud.props.children)
      .flat();
    return contenu.some((/** @type {any} */ v) => typeof v === 'string' && v.startsWith(debut));
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData.current = { documentId: 'user-1' };
  mockUseGetSections.mockReturnValue(sectionsQuery(SECTIONS));
  mockUpdateMe.mockResolvedValue({ documentId: 'user-1' });
  mockGetNextOnboardingRoute.mockReturnValue('UserAddress');
});

describe('UserSection — l etape « Ta section » (caracterisation D56)', () => {
  it('liste les sections disponibles', () => {
    const { tree } = rendre();

    expect(textes(tree)).toEqual(expect.arrayContaining(['Masculine', 'Féminine']));
  });

  it('le bouton d enregistrement est mort tant qu aucune section n est choisie', () => {
    const { tree } = rendre();

    expect(pressableIntitule(tree, 'profile.actions.save').props.disabled).toBe(true);
  });

  it('choisir puis enregistrer envoie la section et suit la machine a etapes', async () => {
    const { navigation, tree } = rendre();

    const rangee = pressableIntitule(tree, 'Féminine');
    await act(async () => { rangee.props.onPress(); });
    await act(async () => { pressableIntitule(tree, 'profile.actions.save').props.onPress(); });

    expect(mockUpdateMe).toHaveBeenCalledWith({ section: 'sec-2' });
    expect(navigation.navigate).toHaveBeenCalledWith('UserAddress');
  });
});

describe('UserSection — on peut PASSER l etape sans choisir (D56, trou n4)', () => {
  it('depuis l etape Section, on peut passer sans choisir', async () => {
    const { navigation, tree } = rendre();

    const passer = pressableIntitule(tree, 'Passer cette étape');
    expect(passer).toBeDefined();

    await act(async () => { passer.props.onPress(); });

    expect(mockGetNextOnboardingRoute).toHaveBeenCalledWith('UserSection');
    expect(navigation.navigate).toHaveBeenCalledWith('UserAddress');
    // Passer n ENREGISTRE rien : c est ce qui distingue le saut du choix.
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('« Passer » sort par la machine a etapes, pas par une route ecrite en dur', async () => {
    mockGetNextOnboardingRoute.mockReturnValue('UserAvatar');
    const { navigation, tree } = rendre();

    await act(async () => { pressableIntitule(tree, 'Passer cette étape').props.onPress(); });

    expect(navigation.navigate).toHaveBeenCalledWith('UserAvatar');
  });
});
