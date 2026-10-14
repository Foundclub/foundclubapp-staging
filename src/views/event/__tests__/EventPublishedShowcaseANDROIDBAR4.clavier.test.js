import {
  DeviceEventEmitter, KeyboardAvoidingView, Platform, StyleSheet, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// 🤖 ANDROIDBAR-4 — « Ton événement est en ligne » : l'écran est enregistré
// `headerShown: false`, son évitement du clavier est sa RACINE, posée à l'écran 0. Le décalage
// calculé (D23, ScreenContainer.js) vaut donc 0 ; il valait 100, écrit en dur :
// - iPhone : 100 dp perdus au-dessus du clavier ;
// - Android ≤ 14 : 76 dp perdus clavier ouvert, 100 dp de vide une fois refermé ;
// - Android 15/16 (bord à bord) : 100 dp perdus clavier ouvert, et clavier REFERMÉ Android envoie
//   la hauteur VISIBLE comme haut du clavier (ReactRootView.java) ⇒ barre du bas + barre
//   d'état + 100 = 202 dp de vide sous l'écran (Pixel 9, 3 boutons).
// Charges réelles d'Android et d'iOS, géométrie mesurée à l'émulateur par ANDROIDBAR-3.

const DENSITE = 2.625;
const ECRAN = 2424 / DENSITE;
const BARRE_ETAT = 142 / DENSITE;
const HAUT_DU_CLAVIER = 1657 / DENSITE;
const CLAVIER = ECRAN - HAUT_DU_CLAVIER - 48;

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 48, left: 0, right: 0, top: BARRE_ETAT,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: { hitSlop: makeRamp() },
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/platform/visualRender', () => ({
  downloadAndShareRender: jest.fn(() => Promise.resolve({ opened: true, outcome: 'shareSheet' })),
  fetchRenderBase64: jest.fn(() => Promise.resolve({ base64: 'QUJD', contentType: 'image/png' })),
}));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn() },
  share: jest.fn(),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: { data: null } })) },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: () => 'https://api.test.foundclub/api',
  getPublicApiOrigin: () => 'https://test.foundclub',
}));

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
  },
);

jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() {
  return null;
});

jest.setTimeout(20000);

/**
 * @typedef {object} Telephone
 * @property {'ios' | 'android'} os
 * @property {number | string} version
 * @property {number} haut
 * @property {number} bas
 * @property {number} fenetre Hauteur de la fenêtre, clavier fermé.
 * @property {number} fenetreClavierOuvert Android ≤ 14 : `adjustResize` la rétrécit.
 * @property {number} hautDuClavier Haut du clavier, coordonnées de la vue racine.
 * @property {any} ouverture
 * @property {any} fermeture
 */

/**
 * Android 15/16, bord à bord.
 * @param {number} version
 * @param {number} barreDuBas
 * @returns {Telephone}
 */
const androidBordABord = (version, barreDuBas) => ({
  bas: barreDuBas,
  fenetre: ECRAN,
  fenetreClavierOuvert: ECRAN,
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN - barreDuBas - BARRE_ETAT, width: 411,
  },
  haut: BARRE_ETAT,
  hautDuClavier: ECRAN - CLAVIER - barreDuBas,
  os: 'android',
  ouverture: {
    height: CLAVIER, screenX: 0, screenY: ECRAN - CLAVIER - barreDuBas, width: 411,
  },
  version,
});

/** Android ≤ 14 : barre d'état opaque (24 dp), 3 boutons, `adjustResize`. */
const ANDROID_14 = /** @type {Telephone} */ ({
  bas: 0,
  fenetre: ECRAN - 24 - 48,
  fenetreClavierOuvert: HAUT_DU_CLAVIER - 24,
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN - 24 - 48, width: 411,
  },
  haut: 0,
  hautDuClavier: HAUT_DU_CLAVIER - 24,
  os: 'android',
  ouverture: {
    height: CLAVIER, screenX: 0, screenY: HAUT_DU_CLAVIER, width: 411,
  },
  version: 34,
});

/** iPhone 15 : écran 852, clavier 336. */
const IPHONE_15 = /** @type {Telephone} */ ({
  bas: 34,
  fenetre: 852,
  fenetreClavierOuvert: 852,
  fermeture: {
    height: 0, screenX: 0, screenY: 852, width: 393,
  },
  haut: 59,
  hautDuClavier: 852 - 336,
  os: 'ios',
  ouverture: {
    height: 336, screenX: 0, screenY: 852 - 336, width: 393,
  },
  version: '18.0',
});

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

afterEach(() => {
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
    DeviceEventEmitter.emit('keyboardWillHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
});

/**
 * Monte l'écran sur un téléphone, joue ouverture puis fermeture du clavier.
 * @param {Telephone} tel
 * @returns {Promise<{ ferme: number, ouvert: number, referme: number }>} y (dp) du bas de la
 *   zone de l'écran (son défilement), coordonnées de la vue racine.
 */
const jouer = async (tel) => {
  Platform.OS = /** @type {any} */ (tel.os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => tel.version });
  mockInsets.top = tel.haut;
  mockInsets.bottom = tel.bas;
  let { fenetre } = tel;

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <EventPublishedShowcase
        navigation={/** @type {any} */ ({ goBack: jest.fn(), navigate: jest.fn() })}
        route={/** @type {any} */ ({ params: { eventId: 'evt-1' } })}
      />,
    );
  });

  // La racine de l'écran : la 1re vue hôte rendue.
  const racine = () => arbre.root.findAllByType(View)[0];
  const basDeLEcran = () => {
    const style = StyleSheet.flatten(racine().props.style) || {};
    const bas = style.height === undefined ? fenetre : style.height;
    return bas - (style.paddingBottom || 0);
  };

  const vider = () => act(async () => {
    await new Promise((fin) => { setImmediate(fin); });
  });

  // L'appareil renvoie une mesure à chaque changement de hauteur : on la rejoue à
  // l'évitement (posé à l'écran 0, l'écran n'a pas d'en-tête).
  const mesurer = async () => {
    const [evitement] = arbre.root.findAllByType(KeyboardAvoidingView);
    if (evitement) {
      const style = StyleSheet.flatten(racine().props.style) || {};
      await act(async () => {
        // eslint-disable-next-line no-underscore-dangle
        await evitement.instance._onLayout({
          nativeEvent: {
            layout: {
              height: style.height === undefined ? fenetre : style.height, width: 411, x: 0, y: 0,
            },
          },
          persist: () => {},
        });
      });
    }
    await vider();
  };

  const evenement = async (/** @type {'Show' | 'Hide'} */ sens, /** @type {any} */ charge) => {
    await act(async () => {
      DeviceEventEmitter.emit(`keyboard${tel.os === 'ios' ? 'Will' : 'Did'}${sens}`, {
        duration: 0,
        easing: 'keyboard',
        endCoordinates: charge,
      });
    });
    await vider();
  };

  await mesurer();
  const ferme = basDeLEcran();

  fenetre = tel.fenetreClavierOuvert;
  await mesurer();
  await evenement('Show', tel.ouverture);
  await mesurer();
  await mesurer();
  const ouvert = basDeLEcran();

  fenetre = tel.fenetre;
  await mesurer();
  await evenement('Hide', tel.fermeture);
  await mesurer();
  await mesurer();
  const referme = basDeLEcran();

  act(() => arbre.unmount());
  return { ferme, ouvert, referme };
};

describe('ANDROIDBAR-4 — affiche publiée : le bas de l écran s arrête au haut du clavier', () => {
  it.each([
    ['Android 16, 3 boutons', androidBordABord(36, 48)],
    ['Android 15, gestes', androidBordABord(35, 24)],
    ['Android 14, 3 boutons', ANDROID_14],
    ['iPhone 15', IPHONE_15],
  ])('%s : ouvert, pile au clavier ; refermé, aucun vide', async (_nom, tel) => {
    const mesure = await jouer(/** @type {Telephone} */ (tel));

    expect(mesure.ferme).toBeCloseTo(tel.fenetre, 5);
    expect(mesure.ouvert).toBeLessThanOrEqual(tel.hautDuClavier + 0.01);
    expect(mesure.ouvert).toBeGreaterThanOrEqual(tel.hautDuClavier - 0.01);
    expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
  });
});
