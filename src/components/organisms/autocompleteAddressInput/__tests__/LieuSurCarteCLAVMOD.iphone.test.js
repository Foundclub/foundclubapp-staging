import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DeviceEventEmitter, Platform, StyleSheet, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import LieuSurCarte from '../LieuSurCarte';

// 📱 CLAVIER-MODALES — « Placer le lieu sur la carte » est une `<Modal>` plein écran : le champ
// « Nom du lieu » et « Placer ici » vivent dans le panneau posé SOUS la carte. Sur iPhone, une
// fenêtre `<Modal>` n'évite RIEN : le clavier recouvrait le champ qu'on remplit, et le bouton —
// même famille que la convocation, où Adel a vu le bouton caché (TestFlight 2.6.75).
//
// Charges réelles d'iOS (RCTKeyboardObserver) : `keyboardWillShow` / `keyboardWillHide`, hauteur
// barre d'accueil COMPRISE. Géométrie : iPhone 15 (852 pt, clavier 336, barre 34) et iPhone SE
// (667 pt, clavier 260, pas de barre).

const IPHONES = [
  {
    barre: 34, clavier: 336, ecran: 852, nom: 'iPhone 15',
  },
  {
    barre: 0, clavier: 260, ecran: 667, nom: 'iPhone SE',
  },
];

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
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
 * Joue un iPhone : iOS et sa barre d'accueil.
 * @param {number} barreDuBas `insets.bottom`.
 */
const iPhone = (barreDuBas) => {
  Platform.OS = 'ios';
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => '18.0' });
  mockInsets.bottom = barreDuBas;
};

/** @type {Array<() => void>} */
const demontages = [];
afterEach(() => {
  demontages.splice(0).forEach((demonter) => demonter());
  act(() => {
    DeviceEventEmitter.emit('keyboardWillHide');
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockInsets.bottom = 34;
});

/**
 * La charge d'iOS : le cadre FINAL du clavier, annoncé avant son mouvement.
 * @param {{ clavier: number, ecran: number }} telephone
 * @param {boolean} ouvert
 * @returns {any}
 */
const chargeIOS = (telephone, ouvert) => ({
  duration: 250,
  easing: 'keyboard',
  endCoordinates: {
    height: telephone.clavier,
    screenX: 0,
    screenY: ouvert ? telephone.ecran - telephone.clavier : telephone.ecran,
    width: 393,
  },
});

const ouvrirLeClavier = async (/** @type {any} */ telephone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillShow', chargeIOS(telephone, true));
  DeviceEventEmitter.emit('keyboardDidShow', chargeIOS(telephone, true));
});

const refermerLeClavier = async (/** @type {any} */ telephone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillHide', chargeIOS(telephone, false));
  DeviceEventEmitter.emit('keyboardDidHide', chargeIOS(telephone, false));
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
 * @param {number} ecran Hauteur de l'écran (pt).
 * @returns {number} y (pt).
 */
const basDuBouton = (arbre, ecran) => {
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
  return ecran - (styleDeLaRacine.paddingBottom || 0) - (styleDuPanneau.paddingBottom || 0);
};

describe('CLAVIER-MODALES — lieu sur la carte, iPhone', () => {
  it.each(IPHONES)('$nom : clavier ouvert, « Placer ici » reste au-dessus', async (telephone) => {
    iPhone(telephone.barre);
    const arbre = ouvrirLaCarte();
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);

    await ouvrirLeClavier(telephone);

    const hautDuClavier = telephone.ecran - telephone.clavier;
    const bas = basDuBouton(arbre, telephone.ecran);
    expect(bas).toBeLessThanOrEqual(hautDuClavier + 0.01);
    // Pas d'autre trou que la marge que le panneau garde sous le bouton (16 pt).
    expect(bas).toBeGreaterThanOrEqual(hautDuClavier - 16.01);
  });

  it.each(IPHONES)('$nom : clavier refermé, le panneau revient (0 pt)', async (telephone) => {
    iPhone(telephone.barre);
    const arbre = ouvrirLaCarte();
    await ouvrirLeClavier(telephone);
    await refermerLeClavier(telephone);

    expect(basDuBouton(arbre, telephone.ecran)).toBe(telephone.ecran - telephone.barre - 16);
  });

  it('clavier jamais ouvert : rien ne bouge (0 pt)', () => {
    iPhone(34);
    const arbre = ouvrirLaCarte();

    expect(basDuBouton(arbre, 852)).toBe(852 - 34 - 16);
  });
});
