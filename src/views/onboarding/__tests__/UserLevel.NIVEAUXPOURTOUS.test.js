import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserLevel from '../UserLevel';

// INSCRIPTION-PARCOURS-2 (18/11/2026, D257, Q1 d'Adel) — l'étape « Ton meilleur niveau ? » :
// Débutant, Amateur, Confirmé, Expert pour TOUS les sports, d'abord ; puis les niveaux de
// compétition si le sport en a (niveaux reliés à son sport). La spéléo n'a que les 4.
// Données : la forme que rend le serveur de NIVEAUX-PAR-SPORT (rank + activities
// {documentId, name}).

const mockUserData = { current: /** @type {any} */ ({ documentId: 'user-1' }) };
const mockNiveaux = { current: /** @type {any[]} */ ([]) };

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
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

jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({
    data: [...mockNiveaux.current]
      .sort(jest.requireActual('@/services/level/levelService').compareLevels),
    error: null,
    isLoading: false,
    refetch: jest.fn(),
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

const SPORTS_CO = [
  { documentId: 'a-foot', name: 'Football' },
  { documentId: 'a-volleyball', name: 'Volleyball' },
];
const QUATRE = ['1 - Débutant', '2 - Amateur', '3 - Confirmé', '4 - Expert'];
const COMPETITION = ['Départemental', 'Régional', 'National'];

/** Ce que rend le serveur après le script niveaux-pour-tous (l'ordre du serveur : name:asc). */
const APRES_LE_SCRIPT = [
  ...QUATRE.map((name, i) => ({
    activities: [], documentId: `q-${i}`, name, rank: i + 1,
  })),
  ...COMPETITION.map((name, i) => ({
    activities: SPORTS_CO, documentId: `c-${i}`, name, rank: null,
  })),
].sort((a, b) => a.name.localeCompare(b.name));

const choix = () => {
  let arbre;
  act(() => { arbre = renderer.create(<UserLevel navigation={{ navigate: jest.fn() }} />); });
  return /** @type {any} */ (arbre).root.findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ n) => n.props.accessibilityRole === 'radio')
    .map((/** @type {any} */ n) => n.findByType(Text).props.children);
};

beforeEach(() => {
  mockNiveaux.current = APRES_LE_SCRIPT;
  mockUserData.current = { documentId: 'user-1' };
});

describe('INSCRIPTION-PARCOURS-2 — l étape Niveau selon le sport choisi', () => {
  it('Football : les 4 d abord, puis les niveaux de compétition', () => {
    mockUserData.current = { documentId: 'user-1', preferredSport: 'Football' };
    expect(choix()).toEqual([...QUATRE, ...COMPETITION]);
  });

  it('« Volley » (le doublon de Volleyball) : reconnu, la compétition aussi', () => {
    mockUserData.current = { documentId: 'user-1', preferredSport: 'Volley' };
    expect(choix()).toEqual([...QUATRE, ...COMPETITION]);
  });

  it('Spéléologie : les 4 seulement', () => {
    mockUserData.current = { documentId: 'user-1', preferredSport: 'Spéléologie' };
    expect(choix()).toEqual(QUATRE);
  });

  it('sans sport choisi (étape Sport passée) : les 4 seulement', () => {
    expect(choix()).toEqual(QUATRE);
  });

  it('un niveau déjà enregistré hors de la liste du sport reste affiché, coché', () => {
    mockUserData.current = {
      bestLevel: 'Régional', documentId: 'user-1', preferredSport: 'Spéléologie',
    };
    expect(choix()).toEqual([...QUATRE, '[x] Régional']);
  });

  it('serveur ancien (aucun champ activities) : tous les niveaux, rien ne disparaît', () => {
    mockNiveaux.current = COMPETITION.map((name, i) => ({ documentId: `v-${i}`, name }));
    mockUserData.current = { documentId: 'user-1', preferredSport: 'Spéléologie' };
    expect(choix()).toEqual(COMPETITION);
  });
});
