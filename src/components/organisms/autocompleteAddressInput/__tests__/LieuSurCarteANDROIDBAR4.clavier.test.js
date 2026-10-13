import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DeviceEventEmitter, Platform, StyleSheet, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import LieuSurCarte from '../LieuSurCarte';

// 🤖 ANDROIDBAR-4 — « Placer le lieu sur la carte » : la fenêtre est une `<Modal
// statusBarTranslucent>` plein écran, le champ « Nom du lieu » et « Placer ici » vivent dans le
// panneau posé SOUS la carte. Sur Android 15 et 16 (bord à bord imposé), rien ne remonte une
// fenêtre translucide au-dessus du clavier (pas de `fitsSystemWindows`, ReactModalHostView.kt ;
// mesuré par ANDROIDBAR-2 : elle descend sous la barre d'Android) : le clavier recouvrait le
// champ qu'on est en train de remplir, et le bouton.
//
// Charges réelles d'Android (ReactRootView.java), géométrie mesurée à l'émulateur par
// ANDROIDBAR-3 (Pixel 9, Android 16).

const DENSITE = 2.625;
const ECRAN = 2424 / DENSITE;
const BARRE_ETAT = 142 / DENSITE;
const HAUT_DU_CLAVIER = 1657 / DENSITE;

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
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/services/places/placesService', () => ({
  createLieu: jest.fn(() => Promise.resolve({ place: {} })),
  getPlacesFromCoordinates: jest.fn(() => Promise.resolve(null)),
  searchPlaces: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/platform/maps', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      readCurrentLocationIfGranted: () => Promise.resolve(null),
      renderPinMap: () => <VueRN testID="carte-a-epingle" />,
    },
  };
});

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

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <SaisieRN onChangeText={proprietes.onChangeText} value={proprietes.value} />
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <Pressable onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Pressable>
    ),
  };
});

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Joue un téléphone : son système, sa version et sa barre du bas.
 * @param {'ios' | 'android'} systeme
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 * @param {number} barreDuBas `insets.bottom` (48 = 3 boutons, 24 = gestes, 34 = iPhone).
 */
const telephone = (systeme, version, barreDuBas) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockInsets.bottom = barreDuBas;
};

afterEach(() => {
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockInsets.bottom = 48;
});

const ouvrirLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: (ECRAN - HAUT_DU_CLAVIER) - mockInsets.bottom,
      screenX: 0,
      screenY: HAUT_DU_CLAVIER,
      width: 411,
    },
  });
});

const refermerLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidHide', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: 0, screenX: 0, screenY: ECRAN - mockInsets.bottom - BARRE_ETAT, width: 411,
    },
  });
});

/** @type {Array<() => void>} */
const demontages = [];
afterEach(() => {
  demontages.splice(0).forEach((demonter) => demonter());
});

const ouvrirLaCarte = () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <LieuSurCarte
          onFermer={jest.fn()}
          onLieuPose={jest.fn()}
          premierResultat={{ lat: 43.2321, lng: 5.4352 }}
          visible
        />
      </QueryClientProvider>,
    );
  });
  demontages.push(() => {
    act(() => arbre.unmount());
    client.clear();
  });
  return arbre;
};

/**
 * Où s'arrête, à l'écran, le bouton « Placer ici » : le bas de la fenêtre, moins ce que la
 * racine laisse en bas, moins la marge basse du panneau.
 * @param {any} arbre
 * @returns {number} y (dp).
 */
const basDuBouton = (arbre) => {
  const [placer] = arbre.root.findAllByType(TouchableOpacity).filter(
    (/** @type {any} */ n) => n.findAllByType(Text)
      .some((/** @type {any} */ texte) => texte.props.children === 'Placer ici'),
  );
  let panneau = placer.parent;
  while (typeof panneau.type !== 'string') panneau = panneau.parent;
  let racine = panneau.parent;
  while (typeof racine.type !== 'string') racine = racine.parent;
  const styleDeLaRacine = StyleSheet.flatten(racine.props.style) || {};
  const styleDuPanneau = StyleSheet.flatten(panneau.props.style) || {};
  return ECRAN - (styleDeLaRacine.paddingBottom || 0) - (styleDuPanneau.paddingBottom || 0);
};

describe('ANDROIDBAR-4 — lieu sur la carte : Android 15 et 16, clavier ouvert', () => {
  it.each([
    [35, 48, '3 boutons'],
    [36, 48, '3 boutons'],
    [36, 24, 'gestes'],
  ])('API %s, barre %s dp (%s) : « Placer ici » reste au-dessus du clavier', async (api, barre) => {
    telephone('android', api, barre);
    const arbre = ouvrirLaCarte();
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);

    await ouvrirLeClavier();

    const bas = basDuBouton(arbre);
    expect(bas).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
    // Pas d'autre trou que la marge que le panneau garde sous le bouton (16 dp).
    expect(bas).toBeGreaterThanOrEqual(HAUT_DU_CLAVIER - 16.01);
  });

  it('API 36 : clavier REFERMÉ, le panneau revient en bas (aucun vide)', async () => {
    telephone('android', 36, 48);
    const arbre = ouvrirLaCarte();
    await ouvrirLeClavier();
    await refermerLeClavier();

    expect(basDuBouton(arbre)).toBeCloseTo(ECRAN - 48 - 16, 5);
  });
});

describe('ANDROIDBAR-4 — caractérisation : iPhone et Android ≤ 14 ne bougent pas', () => {
  it('iPhone : le panneau ne bouge pas (barre + 16)', async () => {
    telephone('ios', '18.0', 34);
    const arbre = ouvrirLaCarte();
    await act(async () => {
      DeviceEventEmitter.emit('keyboardWillShow', {
        duration: 0,
        easing: 'keyboard',
        endCoordinates: {
          height: 336, screenX: 0, screenY: 852 - 336, width: 393,
        },
      });
    });

    expect(basDuBouton(arbre)).toBeCloseTo(ECRAN - 34 - 16, 5);
  });

  it.each([30, 34])('Android API %s : le panneau ne bouge pas (fenêtre rétrécie)', async (api) => {
    telephone('android', api, 0);
    const arbre = ouvrirLaCarte();
    await ouvrirLeClavier();

    expect(basDuBouton(arbre)).toBeCloseTo(ECRAN - 16, 5);
  });
});
