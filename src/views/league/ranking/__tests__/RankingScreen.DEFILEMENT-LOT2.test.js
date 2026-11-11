/* eslint-disable max-len -- témoin : les doublures et les assertions se lisent mieux sur une ligne */
import {
  FlatList, ScrollView, StyleSheet, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getRanking } from '@/services/leagueTeam/leagueTeamService';

import RankingScreen from '../RankingScreen';

// DEFILEMENT-LOT2 (11/11/2026, décision d'Adel « 244- A », relevé D03b ligne 5). League >
// Classement : le titre « CLASSEMENT », la ligne « DIVISION » et l'en-tête des colonnes restaient
// figés en haut (~210 px sur iPhone) ; seule la liste défilait, dans sa carte.
// Règle C (T3-BANDEAU-HAUT : tout défile sauf la flèche) : titre, divisions, colonnes et lignes
// défilent ensemble ; la flèche de retour reste en place et porte son fond (BOUTONS-FLOTTANTS),
// comme l'essai `useEnteteFlottant` du 03/11. Le bas ne change pas (barre d'onglets présente).
// Doublures recopiées de RankingScreen.caracterisation.test.js.

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;

// `useFocusEffect` execute son rappel via `useEffect`, et le rejoue quand le
// rappel change (comme l'ecran reste au premier plan), jamais en boucle.
jest.mock('@react-navigation/native', () => {
  const reactActuel = jest.requireActual('react');
  return {
    useFocusEffect: (/** @type {() => any} */ rappel) => {
      reactActuel.useEffect(() => rappel(), [rappel]);
    },
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
  };
});

jest.mock('@tanstack/react-query', () => {
  const clientRequetes = {};
  return { useQueryClient: () => clientRequetes };
});

// Traduction : ce que l'app affiche en francais (texte de fr.js, sinon le repli).
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 134 }),
  useBottomDockLayout: () => ({ sceneBottomInset: 134 }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1' } }),
}));

jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  loadLeagueTeamContextWithCache: jest.fn(() => Promise.resolve(null)),
}));

// Service double ENTIEREMENT : il importe le client HTTP.
jest.mock('@/services/leagueTeam/leagueTeamService', () => ({
  getRanking: jest.fn(),
}));

jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title || ''),
    );
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    return props.children;
  },
);

// L'etat chargement / erreur : son titre, sa description, et son bouton d'action.
jest.mock('@/views/league/components/LeagueStateView', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: VueRN,
  } = jest.requireActual('react-native');
  return function LeagueStateViewMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(TexteRN, null, props.title),
      reactActuel.createElement(TexteRN, null, props.description),
      props.actionLabel
        ? reactActuel.createElement(
          PressableRN,
          { onPress: props.onAction },
          reactActuel.createElement(TexteRN, null, props.actionLabel),
        )
        : null,
    );
  };
});

const EQUIPES = [
  {
    division_points: 42, documentId: 'eq-a', name: 'Les Aigles', wins: 3,
  },
  {
    division_points: 7, documentId: 'eq-b', name: 'Les Bisons', wins: 0,
  },
];

const texteDe = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(texteDe).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return texteDe(enfants?.props?.children);
  return String(enfants);
};
const parTexte = (/** @type {any} */ racine, /** @type {string} */ texte) => racine
  .findAll((/** @type {any} */ n) => n.type === Text && texteDe(n.props.children) === texte)[0];
const sous = (/** @type {any} */ noeud, /** @type {any} */ parent) => {
  if (!noeud || !parent) throw new Error('élément introuvable à l écran');
  let n = noeud?.parent;
  while (n) {
    if (n === parent) return true;
    n = n.parent;
  }
  return false;
};
// Ce qui défile : la liste (FlatList) ou le ScrollView, le plus haut dans l'arbre.
const defilementDe = (/** @type {any} */ racine) => racine
  .findAll((/** @type {any} */ n) => n.type === ScrollView || n.type === FlatList)[0];

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<RankingScreen />); });
  await act(async () => { await Promise.resolve(); });
  return arbre.root;
};

beforeEach(() => {
  mockNavigation = { goBack: jest.fn() };
  mockRoute = { params: { division: 3 } };
  /** @type {any} */ (getRanking).mockResolvedValue(EQUIPES);
});

describe('DEFILEMENT-LOT2 — RankingScreen : tout défile, sauf la flèche', () => {
  test('C : le titre, la ligne « DIVISION » et les en-têtes de colonnes défilent avec les lignes', async () => {
    const racine = await monter();
    const defilement = defilementDe(racine);
    expect(sous(parTexte(racine, 'CLASSEMENT'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'DIVISION 3'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'Équipe'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'Les Aigles'), defilement)).toBe(true);
  });

  test('la flèche de retour reste hors du défilement, avec son fond', async () => {
    const racine = await monter();
    const retour = racine.findAll((/** @type {any} */ n) => n.type === TouchableOpacity
      && n.props.testID === 'ranking-retour')[0];
    expect(sous(retour, defilementDe(racine))).toBe(false);
    expect(StyleSheet.flatten(retour.props.style).backgroundColor).toBeTruthy();
    act(() => { retour.props.onPress(); });
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  test('le bas ne bouge pas : la fin du défilement garde la place de la barre d onglets', async () => {
    const racine = await monter();
    const fin = StyleSheet.flatten(defilementDe(racine).props.contentContainerStyle);
    expect(fin.paddingBottom).toBe(134);
  });
});
