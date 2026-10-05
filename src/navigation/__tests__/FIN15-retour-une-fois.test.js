import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createElement } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { commonOptions } from '@/navigation/commonOptions';

// 🎨 FINITIONS15 point 9c (tournée T14, relevés uiautomator sur 5 pages d'événement) — « RETOUR »
// N'EST LU QU'UNE FOIS. Le relevé donnait deux nœuds pour un seul bouton : `Go back` puis `Retour`.
// La flèche de l'en-tête (`headerBackImage`) est NOTRE bouton (atome HeaderBackButton, libellé
// « Retour »), dessiné DANS le bouton de react-navigation (libellé par défaut « Go back ») : deux
// éléments accessibles imbriqués. La planche (Statistiques P1 : `aria-label="Retour"`, un bouton)
// n'en montre qu'un.
// Règle retenue, sans rien changer à la mise en page : le bouton de react-navigation porte
// « Retour » sur toutes les piles (`headerBackAccessibilityLabel` des options communes), et la
// flèche qu'il contient est décorative. Ce témoin monte la VRAIE pile avec les options de toute
// l'app, SANS l'option par écran qu'EventDetails ajoutait. ROUGE avant le lot.

// Le paquet de gestes est publie en TypeScript brut, que ce depot ne transpile pas
// (jest.config.js) : la pile n'en lit que le glisser-retour, sans objet ici.
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: ({ children }) => children,
    State: {
      ACTIVE: 4, BEGAN: 2, CANCELLED: 3, END: 5, FAILED: 1, UNDETERMINED: 0,
    },
  };
});

// Un telephone sans encoche (meme doublure que SearchStack.enTeteRetour.test.js).
jest.mock('react-native-safe-area-context', () => {
  const reactActuel = jest.requireActual('react');
  const zero = {
    bottom: 0, left: 0, right: 0, top: 0,
  };
  const cadre = {
    height: 812, width: 375, x: 0, y: 0,
  };
  const SafeAreaInsetsContext = reactActuel.createContext(zero);
  const SafeAreaFrameContext = reactActuel.createContext(cadre);
  return {
    initialWindowMetrics: { frame: cadre, insets: zero },
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaFrame: () => cadre,
    useSafeAreaInsets: () => zero,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : clef
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  const theme = {
    Alignments,
    ApplicationStyle: genererStyle(Colors),
    Colors,
    Fonts: genererPolices(Colors),
    Images: { arrowLeft: 1 },
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

// `commonOptions` tire le verre depoli et le bouton d'onglet anime (modules natifs) :
// ils ne servent qu'a la barre d'onglets, jamais a l'en-tete mesure ici.
jest.mock('@/components/atoms/glassSurface/GlassSurface', () => 'GlassSurface');
jest.mock(
  '@/components/atoms/animatedTabBarButton/AnimatedTabBarButton',
  () => 'AnimatedTabBarButton',
);

const Pile = createStackNavigator();

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Un écran doublure.
 * @returns {import('react').ReactElement} le contenu
 */
function Depart() {
  return createElement(Text, null, 'contenu:depart');
}

/**
 * Un écran doublure, ouvert depuis le départ : il a une flèche « Retour ».
 * @returns {import('react').ReactElement} le contenu
 */
function Suite() {
  return createElement(Text, null, 'contenu:suite');
}

afterEach(() => {
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
  conteneur = null;
});

describe('FINITIONS15 point 9c — le bouton Retour de l en-tête est lu une seule fois', () => {
  test('aucun « Go back », un seul élément accessible « Retour »', () => {
    act(() => {
      arbre = renderer.create(createElement(
        NavigationContainer,
        { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
        createElement(
          Pile.Navigator,
          { screenOptions: commonOptions },
          createElement(Pile.Screen, { component: Depart, name: 'Depart' }),
          createElement(Pile.Screen, { component: Suite, name: 'Suite' }),
        ),
      ));
    });
    act(() => { conteneur.navigate('Suite'); });

    const etiquetes = (/** @type {string} */ libelle) => arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type === 'string'
        && noeud.props.accessibilityLabel === libelle
        && noeud.props.accessible !== false,
    );
    expect(etiquetes('Go back')).toHaveLength(0);
    expect(etiquetes('Retour')).toHaveLength(1);
  });
});
