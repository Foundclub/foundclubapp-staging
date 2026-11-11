/* eslint-disable max-len -- témoin : les doublures et les assertions se lisent mieux sur une ligne */
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  Platform, SafeAreaView, ScrollView, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// DEFILEMENT-LOT2 (11/11/2026, décision d'Adel « 244- A », relevé D03b ligne 6, décision du chef
// « Q1 A » du lot 1). Match terminé, l'écran en entier :
// - le haut : la barre « Match terminé » restait figée (~58 px) ; règle C, elle défile, seule la
//   flèche reste en place, avec son fond (BOUTONS-FLOTTANTS, essai `useEnteteFlottant` du 03/11) ;
// - le SafeAreaView : le cadre garde déjà la barre d'état ; le SafeAreaView l'ajoutait une
//   seconde fois sur iPhone (59 px), et il remettrait la barre du bas (34) dès que le cadre ne la
//   garde plus. Il disparaît ;
// - le bas : règle A, le cadre ne garde rien ; la fin du défilement garde 44 + le retrait commun
//   depuis la pile racine, et la place de la barre d'onglets sous l'onglet League.
// Doublures recopiées de PastMatchDetails.BH10.test.js.

/** @type {any[]} */
const mockCadres = [];

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockCadres.push(props);
      return <View>{props.children}</View>;
    },
  };
});
// La barre du téléphone d'un iPhone (34) : le retrait commun, sans marge du cadre.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({ __esModule: true, default: () => 34 }));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const reactActuel = jest.requireActual('react');
  const { TouchableOpacity } = jest.requireActual('react-native');
  return (/** @type {any} */ props) => reactActuel.createElement(TouchableOpacity, {
    onPress: props.onPress, style: props.style, testID: 'fleche-de-retour',
  });
});
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true, default: () => ({ sceneBottomInset: 134 }), useBottomDockLayout: () => ({ sceneBottomInset: 134 }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { matchId: 'match-1', myTeamId: 'team-b' } }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true, default: () => ({ userData: { documentId: 'u-b' } }),
}));
const mockGetMatch = jest.fn();
jest.mock('@/services/league/leagueMatchService', () => ({
  getMatch: (...args) => mockGetMatch(...args),
}));
jest.mock('@/components/atoms/teamShield/TeamShield', () => {
  const reactActuel = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return (/** @type {any} */ props) => reactActuel.createElement(View, { testID: `blason-${props.imageUrl}` });
});

const PastMatchDetails = require('../PastMatchDetails').default;

const MATCH = {
  documentId: 'match-1',
  score_a: 1,
  score_b: 2,
  status: 'completed',
  team_a: { documentId: 'team-a', name: 'Equipe A' },
  team_b: { documentId: 'team-b', name: 'Equipe B' },
};

const texteDe = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(texteDe).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  return String(enfants);
};
const parTexte = (/** @type {any} */ racine, /** @type {string} */ texte) => racine
  .findAll((/** @type {any} */ n) => n.type === Text && texteDe(n.props.children) === texte)[0];
// Un composant et sa vue portent le même testID : on garde le plus profond (la vue).
const parId = (/** @type {any} */ racine, /** @type {string} */ id) => racine
  .findAll((/** @type {any} */ n) => n.props?.testID === id).at(-1);
const sous = (/** @type {any} */ noeud, /** @type {any} */ parent) => {
  if (!noeud || !parent) throw new Error('élément introuvable à l écran');
  let n = noeud?.parent;
  while (n) {
    if (n === parent) return true;
    n = n.parent;
  }
  return false;
};

const monter = async (/** @type {number} */ hauteurDeLaBarre = 0) => {
  mockCadres.length = 0;
  mockGetMatch.mockResolvedValue(MATCH);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <BottomTabBarHeightContext.Provider value={hauteurDeLaBarre}>
        <PastMatchDetails />
      </BottomTabBarHeightContext.Provider>,
    );
  });
  await act(async () => {});
  return { defilement: arbre.root.findByType(ScrollView), racine: arbre.root };
};

describe('DEFILEMENT-LOT2 — PastMatchDetails : tout défile, sauf la flèche', () => {
  const osAvant = Platform.OS;
  afterEach(() => { Platform.OS = osAvant; });

  test('plus de SafeAreaView : la barre d état n est comptée qu une fois (par le cadre)', async () => {
    const { racine } = await monter();
    expect(racine.findAllByType(SafeAreaView)).toHaveLength(0);
  });

  test('C : la barre « Match terminé » défile avec le match', async () => {
    const { defilement, racine } = await monter();
    expect(sous(parTexte(racine, 'Match terminé'), defilement)).toBe(true);
  });

  test('la flèche de retour reste hors du défilement, avec son fond', async () => {
    const { defilement, racine } = await monter();
    const fleche = parId(racine, 'fleche-de-retour');
    expect(sous(fleche, defilement)).toBe(false);
    expect(sous(fleche, parId(racine, 'past-match-retour'))).toBe(true);
    expect(StyleSheet.flatten(fleche.props.style).backgroundColor).toBeTruthy();
  });

  test('A : depuis la pile racine, le cadre ne garde rien ; la fin garde 44 + le retrait', async () => {
    const { defilement } = await monter(0);
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(StyleSheet.flatten(defilement.props.contentContainerStyle).paddingBottom).toBe(44 + 34);
  });

  test('A : sous l onglet League, la fin garde la place de la barre d onglets', async () => {
    const { defilement } = await monter(82);
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(StyleSheet.flatten(defilement.props.contentContainerStyle).paddingBottom).toBe(134);
  });

  test('pendant le chargement, ni SafeAreaView ni bande en bas', async () => {
    mockCadres.length = 0;
    mockGetMatch.mockReturnValue(new Promise(() => {}));
    /** @type {any} */
    let arbre;
    await act(async () => { arbre = renderer.create(<PastMatchDetails />); });
    expect(arbre.root.findAllByType(SafeAreaView)).toHaveLength(0);
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
  });
});
