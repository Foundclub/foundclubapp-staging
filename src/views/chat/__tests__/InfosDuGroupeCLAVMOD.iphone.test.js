import {
  DeviceEventEmitter, LayoutAnimation, Platform, StyleSheet, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InfosDuGroupe from '../InfosDuGroupe';

// 📱 CLAVIER-MODALES — « Infos du groupe » est une `<Modal>` plein écran. Sur iPhone, une fenêtre
// `<Modal>` n'évite RIEN : le clavier se pose par-dessus et la zone qui défile (« Annuler /
// Enregistrer » du nom, les membres) continue dessous — même famille que la convocation, où
// Adel a vu le bouton caché (TestFlight 2.6.75).
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
  // Chaque arbre est démonté : un arbre resté monté écouterait encore le clavier du témoin
  // suivant.
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

const sansEffet = jest.fn();
const renommerLeGroupe = jest.fn(() => Promise.resolve());

/**
 * « Infos du groupe », vue par un admin.
 * @param {boolean} visible
 * @returns {import('react').ReactElement}
 */
const fenetre = (visible) => (
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
    onAjouter={sansEffet}
    onBasculerAdmin={sansEffet}
    onClose={sansEffet}
    onEnvoyerUnMessage={sansEffet}
    onRenommer={renommerLeGroupe}
    onRetirer={sansEffet}
    onSignaler={sansEffet}
    visible={visible}
  />
);

/**
 * Monte la fenêtre ; `basculer` la montre ou la cache (elle reste montée, comme dans le fil).
 * @param {boolean} visible
 * @returns {{ arbre: any, basculer: (v: boolean) => void }}
 */
const monter = (visible) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(fenetre(visible));
  });
  demontages.push(() => act(() => arbre.unmount()));
  const basculer = (/** @type {boolean} */ v) => act(() => {
    arbre.update(fenetre(v));
  });
  return { arbre, basculer };
};

/**
 * Ouvre « Infos du groupe » en admin et passe le nom en modification (champ, clavier sorti).
 * @returns {any} L'arbre rendu.
 */
const renommer = () => {
  const { arbre } = monter(true);
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
 * @param {number} ecran Hauteur de l'écran (pt).
 * @returns {number} y (pt).
 */
const basDuDefilement = (arbre, ecran) => {
  const [page] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'infos-du-groupe' && typeof n.type === 'string',
  );
  return ecran - ((StyleSheet.flatten(page.props.style) || {}).paddingBottom || 0);
};

describe('CLAVIER-MODALES — infos du groupe, renommer, iPhone', () => {
  it.each(IPHONES)('$nom : clavier ouvert, le défilement s arrête au-dessus', async (telephone) => {
    iPhone(telephone.barre);
    const arbre = renommer();

    await ouvrirLeClavier(telephone);

    expect(basDuDefilement(arbre, telephone.ecran)).toBe(telephone.ecran - telephone.clavier);
  });

  it.each(IPHONES)('$nom : clavier refermé, la page revient en bas (0 pt)', async (telephone) => {
    iPhone(telephone.barre);
    const arbre = renommer();
    await ouvrirLeClavier(telephone);
    await refermerLeClavier(telephone);

    expect(basDuDefilement(arbre, telephone.ecran)).toBe(telephone.ecran);
  });

  it('clavier jamais ouvert : rien ne bouge (0 pt)', () => {
    iPhone(34);
    const arbre = renommer();

    expect(basDuDefilement(arbre, 852)).toBe(852);
  });
});

// La fenêtre est montée EN PERMANENCE dans l'écran du fil (Conversation.js, `visible=…`) : le
// clavier de la barre de saisie s'ouvre et se ferme sous elle toute la journée.
describe('CLAVIER-MODALES — infos du groupe FERMÉE, sur iPhone', () => {
  it('le clavier du fil ne la fait pas réagir : aucune animation lancée pour l écran', async () => {
    iPhone(34);
    monter(false);
    const animer = jest.spyOn(LayoutAnimation, 'configureNext');

    await ouvrirLeClavier(IPHONES[0]);
    await refermerLeClavier(IPHONES[0]);

    expect(animer).not.toHaveBeenCalled();
    animer.mockRestore();
  });

  it('refermée clavier ouvert, rouverte clavier fermé : aucun vide (0 pt)', async () => {
    iPhone(34);
    const { arbre, basculer } = monter(true);
    await ouvrirLeClavier(IPHONES[0]);
    expect(basDuDefilement(arbre, 852)).toBe(516);

    basculer(false);
    await refermerLeClavier(IPHONES[0]);
    basculer(true);

    expect(basDuDefilement(arbre, 852)).toBe(852);
  });
});
