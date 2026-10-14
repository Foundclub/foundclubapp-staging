import {
  DeviceEventEmitter, Modal, Platform, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchApplySheet from '../FriendlyMatchApplySheet';

// 📱 CLAVIER-AMICAUX-IOS — « Proposer un match » (fiche d'une annonce de match amical) : une
// `<Modal transparent>` posée en bas de l'écran ; le champ « Un mot (facultatif) » est son dernier
// champ, juste au-dessus de « Envoyer ma proposition », et rien n'y évite le clavier.
//
// - iPhone : une `<Modal>` n'évite RIEN, le clavier se pose par-dessus le champ et le bouton —
//   même famille que la convocation, où Adel a vu le bouton caché (TestFlight 2.6.75). Charges
//   réelles d'iOS (`keyboardWillShow` / `keyboardWillHide`, hauteur barre d'accueil COMPRISE),
//   géométrie du banc CLAVIER-MODALES : iPhone 15 (852 pt, clavier 336, barre 34), iPhone SE
//   (667, 260, 0).
// - Android 15/16 : la fenêtre n'est PAS translucide, Android la remonte lui-même — MESURÉ sur
//   CETTE feuille (séance émulateur, Pixel 9, Android 16, 14/10 00:47) : bouton du bas 2127 px
//   clavier fermé, 1370 px clavier ouvert (haut du clavier 1541), 2127 refermé. Un retrait de
//   plus la remonterait deux fois : GARDE, aucun retrait.

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

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
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

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));

const IPHONES = [
  {
    barre: 34, clavier: 336, ecran: 852, nom: 'iPhone 15',
  },
  {
    barre: 0, clavier: 260, ecran: 667, nom: 'iPhone SE',
  },
];

const BOUTON = 'Envoyer ma proposition';

const ANNONCE = {
  candidateDates: [{ date: '2099-05-15', end: '20:00', start: '18:00' }],
  documentId: 'annonce-1',
  hostingPreference: 'EITHER',
  team: { documentId: 'equipe-annonceur', name: 'FC Annonceur U15' },
};

const MES_EQUIPES = [{ documentId: 'equipe-candidate', name: 'AS Candidate U15' }];

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
 * La feuille ouverte, et le doigt dans le champ du message.
 * @returns {Promise<any>} L'arbre rendu.
 */
const ouvrirLaFeuille = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FriendlyMatchApplySheet
        ad={ANNONCE}
        managedTeams={MES_EQUIPES}
        onClose={jest.fn()}
        onSubmitted={jest.fn()}
        visible
      />,
    );
  });
  demontages.push(() => act(() => arbre.unmount()));
  const [champ] = arbre.root.findAll(
    (/** @type {any} */ n) => n.type === TextInput
      && n.props?.accessibilityLabel === 'Message pour le staff de l’annonce',
  );
  expect(champ).toBeTruthy();
  await act(async () => { champ.props.onChangeText('Bonjour, notre U15 est disponible.'); });
  return arbre;
};

/**
 * Le voile (il pose la feuille en bas) et la feuille, en vues natives.
 * @param {any} arbre
 * @returns {{ feuille: any, voile: any }}
 */
const voileEtFeuille = (arbre) => {
  const [fenetre] = arbre.root.findAllByType(Modal);
  const [voile, feuille] = fenetre.findAll((/** @type {any} */ n) => n.type === 'View');
  // La feuille : le premier enfant du voile, aux coins hauts arrondis.
  expect(StyleSheet.flatten(feuille.props.style).borderTopLeftRadius).toBe(24);
  return { feuille, voile };
};

/**
 * Où s'arrête, à l'écran, le bas de « Envoyer ma proposition » : le DERNIER enfant de la
 * feuille, posée au bas du voile ; sous lui, seule la marge basse de la feuille.
 * @param {any} arbre
 * @param {number} ecran Hauteur de l'écran (pt).
 * @returns {number} y (pt).
 */
const basDuBouton = (arbre, ecran) => {
  const { feuille, voile } = voileEtFeuille(arbre);
  const enfants = [].concat(feuille.props.children).filter(Boolean);
  expect(/** @type {any} */ (enfants[enfants.length - 1]).props.title).toBe(BOUTON);
  const retraitDuVoile = StyleSheet.flatten(voile.props.style).paddingBottom || 0;
  const margeDeLaFeuille = StyleSheet.flatten(feuille.props.style).paddingBottom || 0;
  return ecran - retraitDuVoile - margeDeLaFeuille;
};

/**
 * Le retrait bas du voile (ce que le clavier lui rend), `undefined` s'il n'en a aucun.
 * @param {any} arbre
 * @returns {number | undefined}
 */
const retraitDuVoile = (arbre) => (
  StyleSheet.flatten(voileEtFeuille(arbre).voile.props.style).paddingBottom
);

describe('CLAVIER-AMICAUX-IOS — « Proposer un match », iPhone', () => {
  it.each(IPHONES)('$nom : clavier ouvert, le bouton au-dessus du clavier', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = await ouvrirLaFeuille();

    await ouvrirLeClavierIOS(iphone);

    const hautDuClavier = iphone.ecran - iphone.clavier;
    expect(basDuBouton(arbre, iphone.ecran)).toBeLessThanOrEqual(hautDuClavier);
    // La marge de la feuille (16 pt) au-dessus du clavier ; sa réserve de barre d'accueil passe
    // sous le clavier, qui la compte déjà.
    expect(basDuBouton(arbre, iphone.ecran)).toBe(hautDuClavier - 16);
  });

  it.each(IPHONES)('$nom : clavier refermé, la feuille revient en bas (0 pt)', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = await ouvrirLaFeuille();
    await ouvrirLeClavierIOS(iphone);
    await refermerLeClavierIOS(iphone);

    expect(retraitDuVoile(arbre)).toBeUndefined();
    expect(basDuBouton(arbre, iphone.ecran)).toBe(iphone.ecran - iphone.barre - 16);
  });

  it('clavier jamais ouvert : le voile n a AUCUN retrait bas (0 pt)', async () => {
    telephone('ios', '18.0', 34);
    const arbre = await ouvrirLaFeuille();

    expect(retraitDuVoile(arbre)).toBeUndefined();
  });
});

describe('CLAVIER-AMICAUX-IOS — garde Android : remontée par Android, pas deux fois', () => {
  it.each([34, 35, 36])('API %s : clavier ouvert, aucun retrait ajouté', async (api) => {
    telephone('android', api, 48);
    const arbre = await ouvrirLaFeuille();

    await ouvrirLeClavierAndroid();

    expect(retraitDuVoile(arbre)).toBeUndefined();
    expect(basDuBouton(arbre, 2424 / 2.625)).toBe(2424 / 2.625 - 48 - 16);
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
