import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DeviceEventEmitter, Modal, Platform, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OffreFoundclubClub from '../OffreFoundclubClub';

// 📱 CLAVIER-MODALES — « Offrir l’abonnement » (console SuperAdmin, fiche d'un club) : la feuille
// est une ConsoleSheet, une `<Modal transparent>` posée en bas de l'écran ; le champ « Motif
// (facultatif) » est son DERNIER champ, juste au-dessus de « Offrir » / « Annuler ». Laissé PAS
// FAIT par ANDROIDBAR-5.
//
// - iPhone : une `<Modal>` n'évite RIEN, le clavier recouvrait le motif et les deux boutons —
//   même famille que la convocation, où Adel a vu le bouton caché (TestFlight 2.6.75).
//   Charges réelles d'iOS (`keyboardWillShow` / `keyboardWillHide`, hauteur barre d'accueil
//   COMPRISE) ; iPhone 15 (852 pt, clavier 336, barre 34), iPhone SE (667, 260, 0).
// - Android 15/16 : la ConsoleSheet n'est PAS translucide. Android la remonte lui-même (cadre
//   `fitsSystemWindows` + `adjustResize`, ReactModalHostView.kt:327 et :353-355 ; pour la barre,
//   MESURÉ par ANDROIDBAR-2, garde G de ANDROIDBAR2.feuillesEtBarre.test.js). Un retrait de plus
//   la remonterait deux fois : GARDE, aucun retrait. MESURÉ sur la fenêtre JUMELLE « Proposer un
//   match » (même <Modal transparent> non translucide, aucun évitement dans son code ; séance
//   émulateur, Pixel 9, Android 16, 14/10 00:47) : bouton du bas 2127 px clavier fermé, 1370 px
//   clavier ouvert (haut du clavier 1541), 2127 refermé — Android la remonte, 0 px de vide.

jest.setTimeout(30000);

const IPHONES = [
  {
    barre: 34, clavier: 336, ecran: 852, nom: 'iPhone 15',
  },
  {
    barre: 0, clavier: 260, ecran: 667, nom: 'iPhone SE',
  },
];

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: jest.fn(),
  },
}));

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
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

jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => () => null);

const ROUTE = '/admin-dashboard/subscription-ops/clubs/club-A/foundclub-offer';

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Joue un téléphone : son système, sa version et sa barre du bas.
 * @param {'ios' | 'android'} systeme
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 * @param {number} barreDuBas `insets.bottom`.
 */
const telephone = (systeme, version, barreDuBas) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockInsets.bottom = barreDuBas;
};

/** @type {Array<() => void>} */
const demontages = [];

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ route) => {
    if (route !== ROUTE) throw new Error(`GET inattendu ${route}`);
    return {
      data: {
        data: {
          collectivite: false,
          kind: 'none',
          reason: null,
          since: null,
          subscriptionDocumentId: null,
          until: null,
        },
      },
    };
  });
});

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
 * @param {{ clavier: number, ecran: number }} iphone
 * @param {boolean} ouvert
 * @returns {any}
 */
const chargeIOS = (iphone, ouvert) => ({
  duration: 250,
  easing: 'keyboard',
  endCoordinates: {
    height: iphone.clavier,
    screenX: 0,
    screenY: ouvert ? iphone.ecran - iphone.clavier : iphone.ecran,
    width: 393,
  },
});

const ouvrirLeClavierIOS = async (/** @type {any} */ iphone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillShow', chargeIOS(iphone, true));
  DeviceEventEmitter.emit('keyboardDidShow', chargeIOS(iphone, true));
});

const refermerLeClavierIOS = async (/** @type {any} */ iphone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillHide', chargeIOS(iphone, false));
  DeviceEventEmitter.emit('keyboardDidHide', chargeIOS(iphone, false));
});

/**
 * Android 11+ (Pixel 9, Android 16, 3 boutons, géométrie d'ANDROIDBAR-3) : le clavier SANS la
 * barre système.
 * @returns {Promise<void>}
 */
const ouvrirLeClavierAndroid = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: (2424 - 1657) / 2.625 - mockInsets.bottom,
      screenX: 0,
      screenY: 1657 / 2.625,
      width: 411,
    },
  });
});

/**
 * La fiche du club (gratuit), puis « Offrir l’abonnement » : la feuille et son champ « Motif ».
 * @returns {Promise<any>} L'arbre rendu.
 */
const ouvrirLaFeuille = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <OffreFoundclubClub clubId="club-A" clubName="AS Offerte" />
      </QueryClientProvider>,
    );
  });
  demontages.push(() => {
    act(() => arbre.unmount());
    client.clear();
  });
  for (let i = 0; i < 80 && !arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'offre-foundclub-etat',
  ).length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
  const [offrir] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'bouton-Offrir l’abonnement'
      && typeof n.props?.onPress === 'function',
  );
  await act(async () => { offrir.props.onPress(); });
  const [motif] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'offre-foundclub-motif' && n.type === TextInput,
  );
  expect(motif).toBeTruthy();
  return arbre;
};

/**
 * Le voile de la fenêtre : il pose la feuille en bas (justifyEnd) ; son retrait bas est ce que
 * le clavier rend.
 * @param {any} arbre
 * @returns {any} Le style aplati du voile.
 */
const styleDuVoile = (arbre) => {
  const [laFeuille] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'offre-foundclub-feuille'
      && n.props?.accessibilityViewIsModal && typeof n.type === 'string',
  );
  let voile = laFeuille.parent;
  while (typeof voile.type !== 'string') voile = voile.parent;
  return StyleSheet.flatten(voile.props.style) || {};
};

/**
 * Où s'arrête, à l'écran, le bas de la feuille (« Annuler », sous « Offrir » et le motif).
 * @param {any} arbre
 * @param {number} ecran Hauteur de l'écran (pt).
 * @returns {number} y (pt).
 */
const basDeLaFeuille = (arbre, ecran) => ecran - (styleDuVoile(arbre).paddingBottom || 0);

describe('CLAVIER-MODALES — « Motif » de « Offrir l’abonnement », iPhone', () => {
  it.each(IPHONES)('$nom : clavier ouvert, la feuille s arrête au clavier', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = await ouvrirLaFeuille();

    await ouvrirLeClavierIOS(iphone);

    expect(basDeLaFeuille(arbre, iphone.ecran)).toBe(iphone.ecran - iphone.clavier);
  });

  it.each(IPHONES)('$nom : clavier refermé, la feuille revient en bas (0 pt)', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = await ouvrirLaFeuille();
    await ouvrirLeClavierIOS(iphone);
    await refermerLeClavierIOS(iphone);

    expect(basDeLaFeuille(arbre, iphone.ecran)).toBe(iphone.ecran);
  });

  it('clavier jamais ouvert : le voile n a AUCUN retrait bas (0 pt)', async () => {
    telephone('ios', '18.0', 34);
    const arbre = await ouvrirLaFeuille();

    expect(styleDuVoile(arbre).paddingBottom).toBeUndefined();
  });
});

describe('CLAVIER-MODALES — garde Android 15/16 : remontée par Android, pas deux fois', () => {
  it.each([35, 36])('API %s : clavier ouvert, aucun retrait ajouté', async (api) => {
    telephone('android', api, 48);
    const arbre = await ouvrirLaFeuille();

    await ouvrirLeClavierAndroid();

    expect(styleDuVoile(arbre).paddingBottom).toBeUndefined();
  });

  it('la fenêtre reste NON translucide (c est ce qui fait qu Android la remonte)', async () => {
    telephone('android', 36, 48);
    const arbre = await ouvrirLaFeuille();
    const [fenetre] = arbre.root.findAllByType(Modal);

    expect(fenetre.props.transparent).toBe(true);
    expect(fenetre.props.statusBarTranslucent).toBeFalsy();
    expect(fenetre.props.navigationBarTranslucent).toBeFalsy();
  });
});
