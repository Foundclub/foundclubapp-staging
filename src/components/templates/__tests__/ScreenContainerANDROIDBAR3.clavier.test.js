import {
  DeviceEventEmitter, KeyboardAvoidingView, Platform, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainer from '../ScreenContainer';

// 🤖 ANDROIDBAR-3 — sur Android 15 et 16 (bord à bord imposé), l'évitement du clavier de
// `ScreenContainer` laissait un VIDE sous l'écran une fois le clavier refermé.
//
// MESURÉ à l'émulateur le 13/10/2026 (Pixel 9, Android 16, 3 boutons, écran « Log in ») :
// bas du contenu à 2235 px clavier jamais ouvert, 1594 px clavier ouvert (haut du clavier
// 1657 − 63 de marge : exact), 2093 px clavier REFERMÉ — 142 px = 54 dp, la barre d'état.
// La cause est dans React Native (ReactRootView.java) : à la fermeture, Android envoie la
// hauteur VISIBLE (écran − barre de navigation − barre d'état) comme haut du clavier, et le
// `KeyboardAvoidingView` en déduit qu'il reste 54 dp à éviter.
//
// Les témoins D23 / D31 voisins ne le voyaient pas : ils referment le clavier SANS charge
// (`emit('keyboardDidHide')`), ce qu'Android ne fait jamais. Ici, chaque événement porte la
// charge qu'Android envoie réellement, avec la géométrie mesurée.

const DENSITE = 2.625;
const ECRAN = 2424 / DENSITE;
const BARRE_NAV = 48;
const BARRE_ETAT = 142 / DENSITE;
const ENTETE = 96;
const HAUT_DU_CLAVIER = 1657 / DENSITE;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 48, left: 0, right: 0, top: 142 / 2.625,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Alignments: { fill: { flex: 1 }, grow1: { flexGrow: 1 } },
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

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Joue un téléphone : son système et sa version.
 * @param {'ios' | 'android'} systeme
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 */
const telephone = (systeme, version) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};

afterEach(() => {
  // Le clavier de React Native retient son dernier état : on le referme entre deux témoins.
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
});

/**
 * Monte l'écran et rend de quoi jouer la séquence de l'appareil.
 * @param {{ bottomInsetExtra?: number, bottomInsetMode?: any }} [props] Props du conteneur.
 * @param {number} [margeBasse] La marge basse que pose le conteneur (mode `none` : la barre).
 * @returns {{ arbre: any, mesurer: () => Promise<void>, retrait: () => number }}
 */
const monter = (props = {}, margeBasse = BARRE_NAV) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ScreenContainer
        bottomInsetExtra={props.bottomInsetExtra}
        bottomInsetMode={props.bottomInsetMode}
        keyboardAvoiding
      >
        <Text>contenu</Text>
      </ScreenContainer>,
    );
  });
  // Hauteur du conteneur d'évitement, clavier jamais ouvert.
  const h0 = ECRAN - ENTETE - margeBasse;

  // La vue qui porte l'évitement : la 2ᵉ vue native au-dessus du contenu (la 1ʳᵉ est la
  // vue du contenu). Qu'elle vienne d'un KeyboardAvoidingView ou d'autre chose, on lit ce
  // qu'elle RETIRE au contenu : une hauteur imposée, ou une marge basse.
  const vueDEvitement = () => {
    let noeud = arbre.root.findByType(Text).parent;
    const vues = [];
    while (noeud && vues.length < 2) {
      if (noeud.type === 'View') vues.push(noeud);
      noeud = noeud.parent;
    }
    return vues[1];
  };
  const retrait = () => {
    const style = StyleSheet.flatten(vueDEvitement().props.style) || {};
    const parLaHauteur = style.height === undefined ? 0 : h0 - style.height;
    return parLaHauteur + (style.paddingBottom || 0);
  };

  // L'appareil renvoie une mesure à chaque changement de hauteur : on la rejoue pour le
  // KeyboardAvoidingView de React Native, le seul qui la lise.
  const mesurer = async () => {
    const [evitement] = arbre.root.findAllByType(KeyboardAvoidingView);
    if (!evitement) return;
    const style = StyleSheet.flatten(vueDEvitement().props.style) || {};
    await act(async () => {
      // eslint-disable-next-line no-underscore-dangle
      await evitement.instance._onLayout({
        nativeEvent: {
          layout: {
            height: style.height === undefined ? h0 : style.height, width: 411, x: 0, y: ENTETE,
          },
        },
        persist: () => {},
      });
    });
  };

  return { arbre, mesurer, retrait };
};

/**
 * Clavier ouvert : la charge d'Android 11+ (clavier SANS la barre système).
 * @returns {Promise<void>}
 */
const ouvrirLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: (ECRAN - HAUT_DU_CLAVIER) - BARRE_NAV,
      screenX: 0,
      screenY: HAUT_DU_CLAVIER,
      width: 411,
    },
  });
});

/**
 * Clavier refermé : Android envoie la hauteur VISIBLE comme haut du clavier.
 * @returns {Promise<void>}
 */
const refermerLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidHide', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: 0, screenX: 0, screenY: ECRAN - BARRE_NAV - BARRE_ETAT, width: 411,
    },
  });
});

describe('ANDROIDBAR-3 — Android 15 et 16 : le clavier refermé ne laisse plus de vide', () => {
  it.each([35, 36])('API %s : clavier ouvert, le contenu s arrête au clavier', async (api) => {
    telephone('android', api);
    const ecran = monter();
    await ecran.mesurer();
    await ouvrirLeClavier();
    await ecran.mesurer();

    // Bas du conteneur (écran − barre de navigation) moins le haut du clavier mesuré.
    expect(ecran.retrait()).toBeCloseTo((ECRAN - BARRE_NAV) - HAUT_DU_CLAVIER, 1);
  });

  it.each([35, 36])('API %s : clavier REFERMÉ, plus aucun retrait (était 54 dp)', async (api) => {
    telephone('android', api);
    const ecran = monter();
    await ecran.mesurer();
    await ouvrirLeClavier();
    await ecran.mesurer();
    await refermerLeClavier();
    await ecran.mesurer();

    expect(ecran.retrait()).toBe(0);
  });

  it('Android 15 : refermé puis rouvert, le retrait ne s accumule pas', async () => {
    telephone('android', 35);
    const ecran = monter();
    await ecran.mesurer();
    await ouvrirLeClavier();
    await ecran.mesurer();
    await refermerLeClavier();
    await ecran.mesurer();
    await ouvrirLeClavier();
    await ecran.mesurer();

    expect(ecran.retrait()).toBeCloseTo((ECRAN - BARRE_NAV) - HAUT_DU_CLAVIER, 1);
  });

  it('Android 15, mode screen : la marge du bas reste au-dessus du clavier', async () => {
    telephone('android', 35);
    const ecran = monter({ bottomInsetExtra: 12, bottomInsetMode: 'screen' }, BARRE_NAV + 12);
    await ecran.mesurer();
    await ouvrirLeClavier();
    await ecran.mesurer();

    // Comme le KeyboardAvoidingView : bas du conteneur (écran − barre − 12) − haut du clavier.
    expect(ecran.retrait()).toBeCloseTo((ECRAN - BARRE_NAV - 12) - HAUT_DU_CLAVIER, 1);
  });

  it('Android 15, mode edge-to-edge : tout le clavier est évité', async () => {
    telephone('android', 35);
    const ecran = monter({ bottomInsetMode: 'edge-to-edge' }, 0);
    await ecran.mesurer();
    await ouvrirLeClavier();
    await ecran.mesurer();

    expect(ecran.retrait()).toBeCloseTo(ECRAN - HAUT_DU_CLAVIER, 1);
  });

  it('Android 15 : clavier DÉJÀ ouvert à l arrivée, évité dès le montage', async () => {
    telephone('android', 35);
    await ouvrirLeClavier();
    const ecran = monter();
    await ecran.mesurer();

    expect(ecran.retrait()).toBeCloseTo((ECRAN - BARRE_NAV) - HAUT_DU_CLAVIER, 1);
  });

  it('Android 15 : sans keyboardAvoiding, l écran ne bouge pas (opt-in inchangé)', async () => {
    telephone('android', 35);
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <ScreenContainer>
          <Text>contenu</Text>
        </ScreenContainer>,
      );
    });
    const avant = arbre.toJSON();
    await ouvrirLeClavier();

    expect(arbre.toJSON()).toEqual(avant);
  });
});

describe('ANDROIDBAR-3 — caractérisation : iPhone et Android ≤ 14 ne bougent pas', () => {
  it('iPhone : le KeyboardAvoidingView de React Native, `padding`, décalage 0', () => {
    telephone('ios', '18.0');
    const { arbre } = monter({}, 34);
    const [evitement] = arbre.root.findAllByType(KeyboardAvoidingView);

    expect(evitement.props.behavior).toBe('padding');
    expect(evitement.props.keyboardVerticalOffset).toBe(0);
  });

  it.each([30, 34])('Android API %s : KeyboardAvoidingView `height`, décalage 0', (api) => {
    telephone('android', api);
    const { arbre } = monter();
    const [evitement] = arbre.root.findAllByType(KeyboardAvoidingView);

    expect(evitement.props.behavior).toBe('height');
    expect(evitement.props.keyboardVerticalOffset).toBe(0);
  });
});
