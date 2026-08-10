import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserClubSearch from '../UserClubSearch';

// FILET E6 — l'ecran « Visibilite de ton profil » n'avait AUCUN test avant ce
// lot (D56), alors que c'est lui qui decide si un joueur est trouvable.
//
// Ce que ces cas verrouillent :
//   1. DEUX PILULES, « Profil visible » et « Profil prive », rien d'autre,
//   2. l'explication SUIT le choix — c'est ce que le pack appelle
//      « explication dynamique »,
//   3. ⛔ aucun pictogramme et aucun jargon de transfert a l'ecran : c'est le
//      defaut nomme par le pack, et un test le tient mieux qu'un grep,
//   4. le reglage enregistre reste `isLookingForClub`, inchange.

const mockGetNextOnboardingRoute = jest.fn();
const mockUpdateMe = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockMarkOnboardingComplete = jest.fn();
const mockUserData = {
  current: /** @type {any} */ ({ documentId: 'user-1' }),
};

jest.mock('@tanstack/react-query', () => ({
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

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: (/** @type {any} */ id) => mockMarkOnboardingComplete(id),
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

const rendre = () => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <UserClubSearch
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({})}
      />,
    );
  });
  const tree = /** @type {any} */ (arbre);
  return { navigation, tree };
};

const textes = (/** @type {any} */ tree) => tree.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => node.props.children)
  .flat()
  .filter((/** @type {any} */ value) => typeof value === 'string');

// Les pilules : les pressables portant le role `radio`.
const pilules = (/** @type {any} */ tree) => tree.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ node) => node.props.accessibilityRole === 'radio');

const piluleIntitulee = (/** @type {any} */ tree, /** @type {string} */ libelle) => pilules(tree)
  .find((/** @type {any} */ node) => node.findAllByType(Text)
    .map((/** @type {any} */ noeud) => noeud.props.children)
    .flat()
    .includes(libelle));

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData.current = { documentId: 'user-1' };
  mockUpdateMe.mockResolvedValue({ documentId: 'user-1' });
  mockGetNextOnboardingRoute.mockReturnValue('UserAffiliationGuide');
});

describe('UserClubSearch — visibilite en PILULES (D56, trou n3)', () => {
  it('deux pilules, « Profil visible » et « Profil prive »', () => {
    const { tree } = rendre();

    expect(pilules(tree)).toHaveLength(2);
    expect(textes(tree)).toEqual(expect.arrayContaining(['Profil visible', 'Profil privé']));
  });

  it('l explication SUIT la pilule choisie', async () => {
    const { tree } = rendre();

    // Rien de choisi : aucune des deux explications n'est affichee.
    expect(textes(tree).join(' ')).not.toContain('peuvent te trouver et te contacter');

    await act(async () => { piluleIntitulee(tree, 'Profil visible').props.onPress(); });
    expect(textes(tree).join(' ')).toContain('peuvent te trouver et te contacter');

    await act(async () => { piluleIntitulee(tree, 'Profil privé').props.onPress(); });
    const apres = textes(tree).join(' ');
    expect(apres).toContain('n\'apparaît dans aucune recherche');
    expect(apres).not.toContain('peuvent te trouver et te contacter');
  });

  it('la pilule choisie s annonce comme cochee, l autre non', async () => {
    const { tree } = rendre();

    await act(async () => { piluleIntitulee(tree, 'Profil privé').props.onPress(); });

    expect(piluleIntitulee(tree, 'Profil privé').props.accessibilityState.checked).toBe(true);
    expect(piluleIntitulee(tree, 'Profil visible').props.accessibilityState.checked).toBe(false);
  });

  it('⛔ aucun pictogramme et aucun jargon de transfert a l ecran', async () => {
    const { tree } = rendre();

    await act(async () => { piluleIntitulee(tree, 'Profil privé').props.onPress(); });

    const rendu = textes(tree).join(' ');
    expect(rendu.toLowerCase()).not.toContain('mercato');
    // Les deux pictogrammes que le pack nomme, plus la coche decorative.
    expect(rendu).not.toContain('👁');
    expect(rendu).not.toContain('🔒');
    expect(rendu).not.toContain('✓');
  });

  it('la ligne « modifiable a tout moment » rassure sans etre un avertissement', () => {
    const { tree } = rendre();

    expect(textes(tree).join(' ')).toContain('Modifiable à tout moment depuis Mon profil.');
  });
});

describe('UserClubSearch — ce que l etape enregistre n a pas bouge (D56)', () => {
  it('le bouton est mort tant qu aucune pilule n est choisie', () => {
    const { tree } = rendre();

    const continuer = tree.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ node) => node.props.accessibilityRole === 'button'
        && node.findAllByType(Text)
          .map((/** @type {any} */ noeud) => noeud.props.children)
          .flat()
          .includes('Continuer'));

    expect(continuer.props.disabled).toBe(true);
  });

  it('valider enregistre `isLookingForClub`, et rien d autre', async () => {
    const { navigation, tree } = rendre();

    await act(async () => { piluleIntitulee(tree, 'Profil visible').props.onPress(); });

    const continuer = tree.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ node) => node.findAllByType(Text)
        .map((/** @type {any} */ noeud) => noeud.props.children)
        .flat()
        .includes('Continuer'));
    await act(async () => { continuer.props.onPress(); });

    expect(mockUpdateMe).toHaveBeenCalledWith({ isLookingForClub: true });
    expect(navigation.navigate).toHaveBeenCalledWith('UserAffiliationGuide');
  });
});
