import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserCategory from '../UserCategory';
import UserLevel from '../UserLevel';

// CORR-INSCRIPTION p17 (recette du site 30/10, décision A + ajout d'Adel) — E6 : aucun témoin ne
// montait UserLevel ni UserCategory.
// - Les niveaux venaient par ordre alphabétique ; ils vont du plus bas au plus haut.
// - La catégorie venait d'une liste écrite dans l'écran (U7 … U23, Senior, Vétéran) ; elle vient du
//   serveur (« U10 (10 ans) », « Sénior (+18 ans) »), comme dans « Modifier mon profil ».
// - Rien n'était présélectionné ; la catégorie de son âge l'est (« Sénior » pour un adulte de 28
// ans).
// Les listes ci-dessous sont celles que la recette rend le 30/10 (GET /levels, GET /categories).

const mockUpdateMe = jest.fn();
const mockUserData = { current: /** @type {any} */ ({ documentId: 'user-1' }) };

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data)),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
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
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: rampe(),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => 'Suite',
    getPostOnboardingHomeRoute: () => 'Accueil',
    refetchUserData: jest.fn(),
    userData: mockUserData.current,
    userDataError: null,
    userDataLoading: false,
  }),
}));

// Les écrans importent les services (niveaux, catégories), qui chargent le client HTTP.
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => mockUpdateMe(charge),
}));

const NIVEAUX = ['Départemental', 'Départemental 1', 'Départemental 2', 'Départemental 3',
  'National', 'National 1', 'National 2', 'National 3', 'Pré-National', 'Pré-régional',
  'Régional', 'Régional 1',
  'Régional 2', 'Régional 3'];
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({
    data: NIVEAUX.map((name, i) => ({ documentId: `lvl-${i}`, name })),
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

// Déjà rangées par `getCategories` (compareCategories), comme le serveur les fait arriver à
// l'écran.
const CATEGORIES_SERVEUR = ['U6 (6 ans)', 'U7 (7 ans)', 'U8 (8 ans)', 'U9 (9 ans)', 'U10 (10 ans)',
  'U11 (11 ans)', 'U12 (12 ans)', 'U13 (13 ans)', 'U14 (14 ans)', 'U15 (15 ans)', 'U16 (16 ans)',
  'U17 (17 ans)', 'U18 (18 ans)', 'U19 (19 ans)', 'U20 (20 ans)', 'U21 (21 ans)',
  'Sénior (+18 ans)'];
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({
    data: CATEGORIES_SERVEUR.map((name, i) => ({ documentId: `cat-${i}`, name })),
  }),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
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
    default: (/** @type {any} */ { children }) => <RNView>{children}</RNView>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <RNView>{children}</RNView>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => () => null);

// Une rangée / une chip = son libellé, et « [x] » quand elle est cochée.
jest.mock('@/views/onboarding/components/OnboardingRadioRow', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { checked, label, onPress }) => (
      <RNTouchable accessibilityRole="radio" onPress={onPress}>
        <RNText>{`${checked ? '[x] ' : ''}${label}`}</RNText>
      </RNTouchable>
    ),
  };
});
jest.mock('@/views/onboarding/components/OnboardingChoiceChip', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { checked, label, onPress }) => (
      <RNTouchable accessibilityRole="checkbox" onPress={onPress}>
        <RNText>{`${checked ? '[x] ' : ''}${label}`}</RNText>
      </RNTouchable>
    ),
  };
});

/**
 * Monte un écran avec une navigation doublée.
 * @param {any} Ecran - L'écran à monter.
 * @returns {any} L'arbre rendu.
 */
const monter = (Ecran) => {
  let arbre;
  act(() => { arbre = renderer.create(<Ecran navigation={{ navigate: jest.fn() }} />); });
  return /** @type {any} */ (arbre);
};

/**
 * Les libellés des choix, dans l'ordre de l'écran.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} role - `radio` ou `checkbox`.
 * @returns {string[]} Les libellés des choix, dans l'ordre de l'écran.
 */
const choix = (arbre, role) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ n) => n.props.accessibilityRole === role)
  .map((/** @type {any} */ n) => n.findByType(Text).props.children);

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMe.mockResolvedValue({});
  mockUserData.current = { documentId: 'user-1' };
});

describe('CORR-INSCRIPTION p17 — niveau', () => {
  it('du plus bas au plus haut', () => {
    expect(choix(monter(UserLevel), 'radio')).toEqual([
      'Départemental', 'Départemental 3', 'Départemental 2', 'Départemental 1',
      'Pré-régional',
      'Régional', 'Régional 3', 'Régional 2', 'Régional 1',
      'Pré-National',
      'National', 'National 3', 'National 2', 'National 1',
    ]);
  });
});

describe('CORR-INSCRIPTION p17 — catégorie', () => {
  it('la liste du serveur, et « Sénior » présélectionné pour un adulte de 28 ans', () => {
    mockUserData.current = { birthdate: '1998-03-12', documentId: 'user-1' };
    const vus = choix(monter(UserCategory), 'checkbox');
    expect(vus).toHaveLength(CATEGORIES_SERVEUR.length);
    expect(vus.filter((libelle) => libelle.startsWith('[x] '))).toEqual(['[x] Sénior (+18 ans)']);
  });

  it('une enfant née en 2016 : U11 présélectionné (saison 2026-2027)', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30) });
    mockUserData.current = { birthdate: '2016-05-02', documentId: 'user-1' };
    const vus = choix(monter(UserCategory), 'checkbox');
    jest.useRealTimers();
    expect(vus.filter((libelle) => libelle.startsWith('[x] '))).toEqual(['[x] U11 (11 ans)']);
  });

  it('une catégorie déjà enregistrée garde la main', () => {
    mockUserData.current = {
      birthdate: '1998-03-12', category: 'U21 (21 ans)', documentId: 'user-1',
    };
    const vus = choix(monter(UserCategory), 'checkbox');
    expect(vus.filter((libelle) => libelle.startsWith('[x] '))).toEqual(['[x] U21 (21 ans)']);
  });

  it('l’ancien format (« Senior », « U11 ») se retrouve coché dans la liste du serveur', () => {
    mockUserData.current = {
      birthdate: '1998-03-12', category: 'Senior, U11', documentId: 'user-1',
    };
    const vus = choix(monter(UserCategory), 'checkbox');
    expect(vus.filter((libelle) => libelle.startsWith('[x] ')))
      .toEqual(['[x] U11 (11 ans)', '[x] Sénior (+18 ans)']);
  });

  it('« Continuer » enregistre le nom du serveur', async () => {
    mockUserData.current = { birthdate: '1998-03-12', documentId: 'user-1' };
    const arbre = monter(UserCategory);
    const continuer = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ n) => n.props.accessibilityRole === 'button');
    await act(async () => { continuer.props.onPress(); });
    expect(mockUpdateMe).toHaveBeenCalledWith({ category: 'Sénior (+18 ans)' });
  });
});
