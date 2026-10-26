import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import UserPhysique from '../UserPhysique';

// CHOIX3 (« 11- A », P5-24, 26/10) — L'ETAPE « TON PHYSIQUE » BORNE LA TAILLE ET LE POIDS.
// Avant ce lot, 300 cm ou 999 kg partaient tels quels au serveur, sans un mot.
// Adulte : 100 a 230 cm, 25 a 200 kg ; mineur : 50 a 230 cm, 10 a 200 kg ; age inconnu = adulte.
// E6 : les deux premiers tests decrivent le comportement d'AVANT (verts avant et apres).


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

// Sans repli, la doublure lit le VRAI fr.js : le message affiche est celui de l'app.
jest.mock('react-i18next', () => {
  const fr = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ key, /** @type {any} */ fallback) => {
        if (typeof fallback === 'string') return fallback;
        const lu = key.split('.').reduce((/** @type {any} */ o, k) => o?.[k], fr);
        return typeof lu === 'string' ? lu : key;
      },
    }),
  };
});

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

const rendre = () => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <UserPhysique
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({})}
      />,
    );
  });
  return { navigation, tree: /** @type {any} */ (arbre) };
};

const saisir = (tree, taille, poids) => {
  const [champTaille, champPoids] = tree.root.findAllByType(TextInput);
  act(() => { champTaille.props.onChangeText(taille); });
  act(() => { champPoids.props.onChangeText(poids); });
};

const continuer = (tree) => {
  const bouton = tree.root.findAll((/** @type {any} */ n) => (
    n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function'
  ))[0];
  act(() => { bouton.props.onPress(); });
};

const textes = (tree) => tree.root
  .findAllByType(Text)
  .map((node) => node.props.children)
  .flat()
  .filter((value) => typeof value === 'string');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNextOnboardingRoute.mockReturnValue('UserVisibility');
  mockUserData.current = { birthdate: '1995-04-10', documentId: 'user-choix3' };
});

describe('UserPhysique — ce qui marchait avant (E6)', () => {
  it('180 cm et 75 kg partent au serveur', () => {
    const { tree } = rendre();
    saisir(tree, '180', '75');
    continuer(tree);

    expect(updateMe).toHaveBeenCalledWith({ height: '180', weight: '75' });
  });

  it('la taille seule suffit : le poids reste facultatif', () => {
    const { tree } = rendre();
    saisir(tree, '175', '');
    continuer(tree);

    expect(updateMe).toHaveBeenCalledWith({ height: '175' });
  });
});

describe('UserPhysique — CHOIX3 : les bornes', () => {
  it('🚨 adulte, 300 cm : rien ne part, et l ecran dit la borne', () => {
    const { tree } = rendre();
    saisir(tree, '300', '75');
    continuer(tree);

    expect(updateMe).not.toHaveBeenCalled();
    expect(textes(tree)).toContain('Entre 100 et 230 cm (ex : 182)');
  });

  it('🚨 adulte, 20 kg : rien ne part, et l ecran dit la borne', () => {
    const { tree } = rendre();
    saisir(tree, '180', '20');
    continuer(tree);

    expect(updateMe).not.toHaveBeenCalled();
    expect(textes(tree)).toContain('Entre 25 et 200 kg (ex : 75)');
  });

  it('un enfant de 8 ans, 125 cm et 24 kg : accepte', () => {
    const annee = new Date().getFullYear() - 8;
    mockUserData.current = { birthdate: `${annee}-01-01`, documentId: 'enfant' };
    const { tree } = rendre();
    saisir(tree, '125', '24');
    continuer(tree);

    expect(updateMe).toHaveBeenCalledWith({ height: '125', weight: '24' });
  });

  it('🚨 un enfant, 40 cm : refuse avec la borne des mineurs', () => {
    const annee = new Date().getFullYear() - 8;
    mockUserData.current = { birthdate: `${annee}-01-01`, documentId: 'enfant' };
    const { tree } = rendre();
    saisir(tree, '40', '24');
    continuer(tree);

    expect(updateMe).not.toHaveBeenCalled();
    expect(textes(tree)).toContain('Entre 50 et 230 cm (ex : 140)');
  });
});
