import { HeaderHeightContext } from '@react-navigation/elements';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FormScreenContainer from '../FormScreenContainer';
import ScreenContainer from '../ScreenContainer';

// D23 — defaut ① de la recette du 2026-08-07 : « le clavier masque le bouton
// Continuer » (capture d'Adel, ecran 7/13 « taille et poids »).
//
// Ce que ces tests figent, et pourquoi AUCUN test ne l'attrapait :
// 1. Sur Android, `behavior` valait `undefined` ⇒ React Native rend un simple
//    <View> et l'ecran n'evitait RIEN. `adjustResize` ne rattrape plus rien
//    depuis qu'Android 15 impose le bord-a-bord (targetSdk 35).
// 2. `keyboardVerticalOffset` doit valoir le decalage haut REEL du conteneur
//    (l'en-tete est transparent, le conteneur pose donc lui-meme `paddingTop`).
//    Trois ecrans le reglaient a la main : 110, 110, 100.

const HEADER_HEIGHT = 96;
const SAFE_AREA_TOP = 59;

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
    '%s : le decalage vaut la marge haute du conteneur, jamais un nombre ecrit a la main',
    (os) => {
      Platform.OS = /** @type {any} */ (os);
      const [keyboardView] = getKeyboardViews(screenContainer({ keyboardAvoiding: true }));

      expect(keyboardView.props.keyboardVerticalOffset).toBe(HEADER_HEIGHT);
    },
  );

  it('sans en-tete, le decalage retombe sur le retrait systeme haut', () => {
    Platform.OS = 'ios';
    const tree = screenContainer({ keyboardAvoiding: true, withHeaderPadding: false });

    // `withHeaderPadding: false` ⇒ le conteneur ne pose plus de `paddingTop`,
    // il n'y a donc plus rien a compenser.
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
    expect(keyboardViews[0].props.keyboardVerticalOffset).toBe(HEADER_HEIGHT);
  });
});

describe('ScreenContainer — le decalage suit la mesure, il ne la devine pas', () => {
  it('sans en-tete natif mesure, il retombe sur le retrait systeme haut', () => {
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

    // Un ecran sans en-tete natif n'a pas de `paddingTop` d'en-tete a rendre :
    // le decalage vaut alors le retrait systeme, toujours mesure.
    expect(getKeyboardViews(tree)[0].props.keyboardVerticalOffset).toBe(SAFE_AREA_TOP);
  });
});
