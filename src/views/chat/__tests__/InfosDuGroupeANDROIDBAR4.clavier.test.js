import {
  DeviceEventEmitter, Platform, StyleSheet, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InfosDuGroupe from '../InfosDuGroupe';

// 🤖 ANDROIDBAR-4 — « Infos du groupe » est une `<Modal statusBarTranslucent>` plein écran :
// sur Android 15 et 16 (bord à bord imposé), rien ne la remonte au-dessus du clavier (pas de
// `fitsSystemWindows` sur une fenêtre translucide, ReactModalHostView.kt ; mesuré par
// ANDROIDBAR-2 : elle descend sous la barre d'Android). Son défilement continuait SOUS le
// clavier : le champ « Nom du groupe » est en haut, mais ses boutons « Annuler / Enregistrer »
// et tout ce qu'on fait défiler pouvaient finir dessous (petit écran, paysage, grande police).
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
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

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

/**
 * Ouvre « Infos du groupe » en admin et passe le nom en modification (champ, clavier sorti).
 * @returns {any} L'arbre rendu.
 */
const renommer = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <InfosDuGroupe
        adminIds={['moi']}
        chat={{
          groupName: 'Covoit U15',
          participants: [
            { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
            { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
          ],
        }}
        estAdmin
        meId="moi"
        onAjouter={jest.fn()}
        onBasculerAdmin={jest.fn()}
        onClose={jest.fn()}
        onEnvoyerUnMessage={jest.fn()}
        onRenommer={jest.fn(() => Promise.resolve())}
        onRetirer={jest.fn()}
        onSignaler={jest.fn()}
        visible
      />,
    );
  });
  const [nom] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'infos-du-groupe-nom'
      && n.type === TouchableOpacity,
  );
  act(() => { nom.props.onPress(); });
  const [champ] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'infos-du-groupe-champ-nom'
      && n.type === TextInput,
  );
  expect(champ.props.autoFocus).toBe(true);
  return arbre;
};

/**
 * Où s'arrête, à l'écran, la zone qui défile : le bas de la fenêtre moins ce que la page laisse
 * en bas.
 * @param {any} arbre
 * @returns {number} y (dp).
 */
const basDuDefilement = (arbre) => {
  const [page] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'infos-du-groupe' && typeof n.type === 'string',
  );
  return ECRAN - ((StyleSheet.flatten(page.props.style) || {}).paddingBottom || 0);
};

describe('ANDROIDBAR-4 — infos du groupe : Android 15 et 16, clavier ouvert', () => {
  it.each([
    [35, 48, '3 boutons'],
    [36, 48, '3 boutons'],
    [36, 24, 'gestes'],
  ])('API %s, barre %s dp (%s) : le défilement s arrête au clavier', async (api, barre) => {
    telephone('android', api, barre);
    const arbre = renommer();

    await ouvrirLeClavier();

    expect(basDuDefilement(arbre)).toBeCloseTo(HAUT_DU_CLAVIER, 5);
  });

  it('API 36 : clavier REFERMÉ, la page revient en bas (aucun vide)', async () => {
    telephone('android', 36, 48);
    const arbre = renommer();
    await ouvrirLeClavier();
    await refermerLeClavier();

    expect(basDuDefilement(arbre)).toBeCloseTo(ECRAN, 5);
  });
});

// 📱 CLAVIER-MODALES (13/10) — l'iPhone ne fait plus partie de cette caractérisation : le
// défilement y passait aussi sous le clavier, la page le suit désormais. Témoin :
// InfosDuGroupeCLAVMOD.iphone.test.js.
describe('ANDROIDBAR-4 — caractérisation : Android ≤ 14 ne bouge pas', () => {
  it.each([30, 34])('Android API %s : la page ne bouge pas (fenêtre rétrécie)', async (api) => {
    telephone('android', api, 0);
    const arbre = renommer();
    await ouvrirLeClavier();

    expect(basDuDefilement(arbre)).toBeCloseTo(ECRAN, 5);
  });
});
