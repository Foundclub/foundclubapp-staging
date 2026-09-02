import { HeaderHeightContext } from '@react-navigation/elements';
import {
  DeviceEventEmitter, Dimensions, KeyboardAvoidingView, Platform, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FormScreenContainer from '../FormScreenContainer';
import ScreenContainer from '../ScreenContainer';

// D23 — defaut ① de la recette du 2026-08-07 : « le clavier masque le bouton
// Continuer » (capture d'Adel, ecran 7/13 « taille et poids »).
// D31 — defaut ④ de la recette du 2026-08-07 au soir : sur l'ecran de
// connexion, « un padding se rajoute au-dessus, l'ecran est tres reduit ».
//
// Ce que ces tests figent, et pourquoi AUCUN test ne l'attrapait :
// 1. Sur Android, `behavior` valait `undefined` ⇒ React Native rend un simple
//    <View> et l'ecran n'evitait RIEN. `adjustResize` ne rattrape plus rien
//    depuis qu'Android 15 impose le bord-a-bord (targetSdk 35).
// 2. `keyboardVerticalOffset` doit valoir la position ECRAN DU PARENT de la
//    vue d'evitement — ici ZERO. D23 y avait mis la marge haute du conteneur,
//    qui est deja comprise dans `frame.y` : le contenu se retractait donc de
//    cette hauteur EN TROP.
//
// 🧨 LA LECON DE D31 : les tests de D23 ne lisaient QUE des props. Ils sont
// passes au vert sur un decalage FAUX, parce qu'aucun d'eux n'ouvrait de
// clavier. Les tests « geometrie reelle » plus bas ouvrent un vrai clavier et
// mesurent la hauteur qui RESTE, en points.

const HEADER_HEIGHT = 96;
const SAFE_AREA_TOP = 59;
const SAFE_AREA_BOTTOM = 34;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Alignments: { fill: {}, grow1: {} },
    Images: { bg1: 1, bg2: 2, bg3: 3 },
  }),
}));

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(96),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

const originalOS = Platform.OS;

afterEach(() => {
  // Le clavier de React Native retient son dernier etat dans un singleton :
  // sans ce rideau, un test laisse le clavier « ouvert » pour le suivant.
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  Platform.OS = originalOS;
});

/**
 * Monte un element deja construit et rend l'arbre, pour que les assertions
 * lisent les props reelles du KeyboardAvoidingView.
 * @param {any} element L'element a monter.
 * @returns {any} L'arbre rendu.
 */
const render = (element) => {
  let tree;
  act(() => {
    tree = renderer.create(element);
  });
  return tree;
};

const screenContainer = (props) => render(
  <ScreenContainer
    keyboardAvoiding={props?.keyboardAvoiding}
    withHeaderPadding={props?.withHeaderPadding}
  >
    <Text>contenu</Text>
  </ScreenContainer>,
);

const getKeyboardViews = (tree) => tree.root.findAllByType(KeyboardAvoidingView);

describe('ScreenContainer — evitement du clavier (D23 ①)', () => {
  it('Android recoit un comportement actif, pas `undefined`', () => {
    Platform.OS = 'android';
    const [keyboardView] = getKeyboardViews(screenContainer({ keyboardAvoiding: true }));

    // C'ETAIT LE DEFAUT : `undefined` = React Native rend un <View> inerte.
    expect(keyboardView.props.behavior).toBeDefined();
    expect(keyboardView.props.behavior).toBe('height');
  });

  it('iOS garde `padding`, le comportement historique', () => {
    Platform.OS = 'ios';
    const [keyboardView] = getKeyboardViews(screenContainer({ keyboardAvoiding: true }));

    expect(keyboardView.props.behavior).toBe('padding');
  });

  it.each(['ios', 'android'])(
    '%s : le decalage vaut ZERO — le parent est plein ecran, sa marge est deja dans `frame.y`',
    (os) => {
      Platform.OS = /** @type {any} */ (os);
      const [keyboardView] = getKeyboardViews(screenContainer({ keyboardAvoiding: true }));

      // D31 ④ : y mettre `paddingTop` retranchait cette hauteur une 2e fois.
      expect(keyboardView.props.keyboardVerticalOffset).toBe(0);
    },
  );

  it('le decalage reste nul meme sans en-tete : rien a compenser dans les deux cas', () => {
    Platform.OS = 'ios';
    const tree = screenContainer({ keyboardAvoiding: true, withHeaderPadding: false });

    expect(getKeyboardViews(tree)[0].props.keyboardVerticalOffset).toBe(0);
  });

  it('sans `keyboardAvoiding`, aucun evitement n`est monte', () => {
    expect(getKeyboardViews(screenContainer())).toHaveLength(0);
  });
});

describe('FormScreenContainer — un seul evitement, et il est fourni (D23 ①)', () => {
  it('les ecrans de formulaire recoivent l`evitement sans avoir a le demander', () => {
    Platform.OS = 'android';
    const keyboardViews = getKeyboardViews(render(
      <FormScreenContainer>
        <Text>contenu</Text>
      </FormScreenContainer>,
    ));

    // Le conteneur en monte UN. Tout KeyboardAvoidingView ajoute par un ecran
    // en ferait DEUX, qui se compensent et laissent le bouton sous le clavier.
    expect(keyboardViews).toHaveLength(1);
    expect(keyboardViews[0].props.behavior).toBe('height');
    expect(keyboardViews[0].props.keyboardVerticalOffset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// D31 ④ — LA GEOMETRIE REELLE, CLAVIER OUVERT
//
// Les tests ci-dessous ne lisent plus une prop : ils jouent la sequence que
// React Native joue sur l'appareil (mesure de la vue, puis evenement clavier)
// et lisent la hauteur qui RESTE au contenu. C'est le seul niveau ou le defaut
// d'Adel est visible — un ecran monte sans clavier ne prouve rien.
//
// Le decor, en points, tel qu'un telephone a encoche le rend :
//   ecran 800 · encoche haute 59 · barre gestuelle 34 · en-tete 96
//   ⇒ le conteneur pose paddingTop 96 et paddingBottom 34
//   ⇒ la vue d'evitement est mesuree a y=96, hauteur 800-96-34 = 670
//   ⇒ son bord bas est donc a l'ecran 96+670 = 766
//   clavier de 300 ⇒ son bord haut est a l'ecran 800-300 = 500
//   ⇒ RECOUVREMENT REEL = 766 - 500 = 266
// ---------------------------------------------------------------------------

const SCREEN_HEIGHT = 800;
const KEYBOARD_HEIGHT = 300;
const KEYBOARD_SCREEN_Y = SCREEN_HEIGHT - KEYBOARD_HEIGHT;
const FRAME_Y = HEADER_HEIGHT;
const FRAME_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - SAFE_AREA_BOTTOM;
const REAL_OVERLAP = FRAME_Y + FRAME_HEIGHT - KEYBOARD_SCREEN_Y;

/**
 * Rejoue la mesure de layout que React Native envoie a la vue d'evitement.
 * Yoga place l'enfant DANS la marge du parent : `y` vaut donc `paddingTop`.
 * @param {any} tree L'arbre rendu.
 * @returns {Promise<void>}
 */
const layoutKeyboardView = async (tree) => {
  const { instance } = getKeyboardViews(tree)[0];
  await act(async () => {
    // On appelle la methode interne de React Native a dessein : c'est elle qui
    // recoit la mesure sur l'appareil, et c'est la seule facon de rejouer la
    // geometrie reelle sans moteur de layout dans les tests.
    // eslint-disable-next-line no-underscore-dangle
    await instance._onLayout({
      nativeEvent: {
        layout: {
          height: FRAME_HEIGHT, width: 375, x: 0, y: FRAME_Y,
        },
      },
      persist: () => {},
    });
  });
};

/**
 * Ouvre un vrai clavier de `KEYBOARD_HEIGHT` points.
 * @param {'ios' | 'android'} os La plateforme jouee.
 * @returns {Promise<void>}
 */
const openKeyboard = async (os) => {
  const event = {
    duration: 250,
    easing: 'keyboard',
    endCoordinates: {
      height: KEYBOARD_HEIGHT,
      screenX: 0,
      screenY: KEYBOARD_SCREEN_Y,
      // Jusqu a RN 0.78, iOS ecartait les claviers flottants en comparant cette
      // largeur a celle de la fenetre ; RN 0.79 a retire ce garde-fou. On garde
      // la largeur juste : elle reste vraie, et le test survit aux deux versions.
      width: Dimensions.get('window').width,
    },
  };
  await act(async () => {
    DeviceEventEmitter.emit(
      // RN 0.79 n ecoute PLUS `keyboardWillChangeFrame` sur iOS : le composant
      // s abonne desormais a `keyboardWillShow` / `keyboardWillHide`
      // (KeyboardAvoidingView.js, componentDidMount). Android n a pas bouge.
      os === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      event,
    );
  });
};

/**
 * Le style effectif de la vue rendue par le KeyboardAvoidingView.
 * @param {any} tree L'arbre rendu.
 * @returns {any}
 */
const avoidingViewStyle = (tree) => StyleSheet.flatten(
  getKeyboardViews(tree)[0].findAllByType('View')[0].props.style,
);

describe('D31 ④ — clavier ouvert, le contenu ne se retracte QUE du recouvrement reel', () => {
  it('Android : la hauteur restante vaut exactement `hauteur mesuree - recouvrement`', async () => {
    Platform.OS = 'android';
    const tree = screenContainer({ keyboardAvoiding: true });
    await layoutKeyboardView(tree);
    await openKeyboard('android');

    // 670 - 266 = 404 points de contenu encore visibles.
    expect(avoidingViewStyle(tree).height).toBe(FRAME_HEIGHT - REAL_OVERLAP);
  });

  it('Android : elle ne perd PAS la hauteur de l`en-tete en plus (le defaut d`Adel)', async () => {
    Platform.OS = 'android';
    const tree = screenContainer({ keyboardAvoiding: true });
    await layoutKeyboardView(tree);
    await openKeyboard('android');

    // Avec l'ancien decalage (`paddingTop` = 96), la hauteur tombait a 308 :
    // 96 points de trop, et le logo de l'ecran de connexion disparaissait.
    expect(avoidingViewStyle(tree).height).not.toBe(FRAME_HEIGHT - REAL_OVERLAP - HEADER_HEIGHT);
    expect(avoidingViewStyle(tree).height).toBeGreaterThan(FRAME_HEIGHT - REAL_OVERLAP - 1);
  });

  it('iOS : la marge basse ajoutee vaut exactement le recouvrement, pas davantage', async () => {
    Platform.OS = 'ios';
    const tree = screenContainer({ keyboardAvoiding: true });
    await layoutKeyboardView(tree);
    await openKeyboard('ios');

    expect(avoidingViewStyle(tree).paddingBottom).toBe(REAL_OVERLAP);
  });

  it('clavier referme, le contenu retrouve TOUTE sa hauteur', async () => {
    Platform.OS = 'android';
    const tree = screenContainer({ keyboardAvoiding: true });
    await layoutKeyboardView(tree);
    await openKeyboard('android');
    await act(async () => {
      DeviceEventEmitter.emit('keyboardDidHide');
    });

    // `behavior: 'height'` ne pose de hauteur QUE clavier ouvert.
    expect(avoidingViewStyle(tree).height).toBeUndefined();
  });
});

describe('ScreenContainer — le decalage suit la mesure, il ne la devine pas', () => {
  it('sans en-tete natif mesure, il ne compense toujours rien', () => {
    Platform.OS = 'ios';
    let tree;
    act(() => {
      tree = renderer.create(
        <HeaderHeightContext.Provider value={0}>
          <ScreenContainer keyboardAvoiding>
            <Text>contenu</Text>
          </ScreenContainer>
        </HeaderHeightContext.Provider>,
      );
    });

    // Le conteneur retombe sur `insets.top` pour sa marge haute, mais cette
    // marge est DANS `frame.y` : il n'y a toujours rien a rendre au clavier.
    expect(getKeyboardViews(tree)[0].props.keyboardVerticalOffset).toBe(0);
    expect(SAFE_AREA_TOP).toBe(59);
  });
});
