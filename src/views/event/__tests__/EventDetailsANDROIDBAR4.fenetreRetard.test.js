import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';
import {
  DeviceEventEmitter, KeyboardAvoidingView, Platform, StyleSheet, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import useRetraitDuClavierAndroid from '@/hooks/useRetraitDuClavierAndroid';

// 🤖 ANDROIDBAR-4 — la fenêtre « retard » d'EventDetails (minutes de retard, note du staff) :
// `<Modal statusBarTranslucent transparent>`, carte CENTRÉE dans un KeyboardAvoidingView posé à
// l'écran 0. Clavier ouvert, il évite pile. Mais sur Android 15/16 (bord à bord), à la
// FERMETURE du clavier Android lui envoie la hauteur VISIBLE comme haut du clavier
// (ReactRootView.java, mesuré par ANDROIDBAR-3) : il gardait barre du bas + barre d'état
// (102 dp sur un Pixel 9) de retrait, et la carte restait 51 dp trop haut.
//
// EventDetails fait 10 000 lignes et n'ouvre cette fenêtre qu'après un pointage moqué de bout
// en bout : ce témoin LIT la configuration de son évitement dans le code (décalage, écoute du
// clavier Android) et la rejoue avec le VRAI KeyboardAvoidingView et le VRAI crochet partagé,
// charges réelles d'Android et d'iOS.

const SOURCE = path.resolve(__dirname, '..', 'EventDetails.js');

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

// ─── Lecture du code ─────────────────────────────────────────────────────────

const CLES_IGNOREES = new Set([
  'comments', 'end', 'extra', 'innerComments', 'leadingComments', 'loc', 'start',
  'trailingComments',
]);

const parcourir = (/** @type {any} */ noeud, /** @type {(n: any) => void} */ visiter) => {
  if (!noeud || typeof noeud.type !== 'string') return;
  visiter(noeud);
  Object.keys(noeud).forEach((cle) => {
    if (CLES_IGNOREES.has(cle)) return;
    const valeur = noeud[cle];
    if (Array.isArray(valeur)) valeur.forEach((enfant) => parcourir(enfant, visiter));
    else if (valeur && typeof valeur === 'object') parcourir(valeur, visiter);
  });
};

const attribut = (/** @type {any} */ element, /** @type {string} */ nom) => element
  .openingElement.attributes.find((/** @type {any} */ a) => a.name && a.name.name === nom);

/**
 * La configuration de l'évitement de la fenêtre « retard », telle qu'EventDetails l'écrit.
 * @returns {{ decalageIos: number, decalageAndroid: number, ecoute: null | { reserve: number } }}
 */
const lireLaFenetreRetard = () => {
  const arbre = parse(fs.readFileSync(SOURCE, 'utf8'), { plugins: ['jsx'], sourceType: 'module' });

  /** @type {any[]} */
  const fenetres = [];
  /** @type {Record<string, number>} */
  const crochets = {};
  parcourir(arbre, (noeud) => {
    if (noeud.type === 'JSXElement' && noeud.openingElement.name.name === 'Modal') {
      const visible = attribut(noeud, 'visible');
      if (visible && visible.value.expression.name === 'isLateModalVisible') fenetres.push(noeud);
    }
    // const x = useRetraitDuClavierAndroid(<nombre>)
    if (noeud.type === 'VariableDeclarator' && noeud.id.type === 'Identifier'
      && noeud.init && noeud.init.type === 'CallExpression'
      && noeud.init.callee.name === 'useRetraitDuClavierAndroid') {
      const [reserve] = noeud.init.arguments;
      crochets[noeud.id.name] = reserve ? reserve.value : 0;
    }
  });
  if (fenetres.length !== 1) throw new Error(`fenêtre « retard » trouvée ${fenetres.length} fois`);

  /** @type {any[]} */
  const evitements = [];
  parcourir(fenetres[0], (noeud) => {
    if (noeud.type === 'JSXElement' && noeud.openingElement.name.name === 'KeyboardAvoidingView') {
      evitements.push(noeud);
    }
  });
  if (evitements.length !== 1) throw new Error(`${evitements.length} évitements dans la fenêtre`);
  const [evitement] = evitements;

  // keyboardVerticalOffset={Platform.OS === 'ios' ? A : B}
  const decalage = attribut(evitement, 'keyboardVerticalOffset').value.expression;
  if (decalage.type !== 'ConditionalExpression') throw new Error('décalage non lisible');

  // enabled={!x.ecoute} et { paddingBottom: x.retrait } dans le style : l'écoute partagée.
  const active = attribut(evitement, 'enabled');
  let ecoute = null;
  const expression = active && active.value && active.value.expression;
  if (expression && expression.type === 'UnaryExpression' && expression.operator === '!'
    && expression.argument.type === 'MemberExpression'
    && expression.argument.property.name === 'ecoute') {
    const nom = expression.argument.object.name;
    let retraitPose = false;
    parcourir(attribut(evitement, 'style'), (noeud) => {
      if (noeud.type === 'ObjectProperty' && noeud.key.name === 'paddingBottom'
        && noeud.value.type === 'MemberExpression' && noeud.value.object.name === nom
        && noeud.value.property.name === 'retrait') retraitPose = true;
    });
    if (!(nom in crochets) || !retraitPose) throw new Error('écoute du clavier incomplète');
    ecoute = { reserve: crochets[nom] };
  }

  return {
    decalageAndroid: decalage.alternate.value,
    decalageIos: decalage.consequent.value,
    ecoute,
  };
};

// ─── La fenêtre rejouée ──────────────────────────────────────────────────────

/**
 * L'évitement de la fenêtre, tel que le code l'écrit.
 * @param {{ construction: ReturnType<typeof lireLaFenetreRetard> }} props
 * @returns {import('react').ReactElement}
 */
function FenetreRetard({ construction }) {
  const clavierAndroid = useRetraitDuClavierAndroid(construction.ecoute?.reserve ?? 0);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={construction.ecoute ? !clavierAndroid.ecoute : true}
      keyboardVerticalOffset={Platform.OS === 'ios'
        ? construction.decalageIos
        : construction.decalageAndroid}
      style={[
        { flex: 1, justifyContent: 'center' },
        construction.ecoute ? { paddingBottom: clavierAndroid.retrait } : null,
      ]}
    >
      <Text>carte</Text>
    </KeyboardAvoidingView>
  );
}

/**
 * @typedef {object} Telephone
 * @property {'ios' | 'android'} os
 * @property {number | string} version
 * @property {number} bas
 * @property {number} fenetre Hauteur de la fenêtre, clavier fermé.
 * @property {number} fenetreClavierOuvert Android ≤ 14 : `adjustResize` la rétrécit.
 * @property {number} hautDuClavier
 * @property {any} ouverture
 * @property {any} fermeture
 */

/**
 * Android 15/16, bord à bord : la fenêtre translucide couvre l'écran.
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
  hautDuClavier: ECRAN - CLAVIER - barreDuBas,
  os: 'android',
  ouverture: {
    height: CLAVIER, screenX: 0, screenY: ECRAN - CLAVIER - barreDuBas, width: 411,
  },
  version,
});

/**
 * Android ≤ 14 : la fenêtre translucide part du haut de l'écran (barre d'état translucide),
 * s'arrête au-dessus de la barre du bas, et `adjustResize` la rétrécit jusqu'au clavier.
 */
const ANDROID_14 = /** @type {Telephone} */ ({
  bas: 0,
  fenetre: ECRAN - 48,
  fenetreClavierOuvert: HAUT_DU_CLAVIER,
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN - 24 - 48, width: 411,
  },
  hautDuClavier: HAUT_DU_CLAVIER,
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
  mockInsets.bottom = 48;
});

/**
 * Ouvre la fenêtre sur un téléphone, joue ouverture puis fermeture du clavier.
 * @param {Telephone} tel
 * @returns {Promise<{ ferme: number, ouvert: number, referme: number }>} y (dp) du bas de la
 *   zone où la carte se centre.
 */
const jouer = async (tel) => {
  const construction = lireLaFenetreRetard();
  Platform.OS = /** @type {any} */ (tel.os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => tel.version });
  mockInsets.bottom = tel.bas;
  let { fenetre } = tel;

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<FenetreRetard construction={construction} />);
  });

  const vue = () => arbre.root.findAllByType(View)[0];
  const basDeLaZone = () => {
    const style = StyleSheet.flatten(vue().props.style) || {};
    return (style.height === undefined ? fenetre : style.height) - (style.paddingBottom || 0);
  };
  const vider = () => act(async () => {
    await new Promise((fin) => { setImmediate(fin); });
  });
  const mesurer = async () => {
    const [evitement] = arbre.root.findAllByType(KeyboardAvoidingView);
    const style = StyleSheet.flatten(vue().props.style) || {};
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
  const ferme = basDeLaZone();

  fenetre = tel.fenetreClavierOuvert;
  await mesurer();
  await evenement('Show', tel.ouverture);
  await mesurer();
  await mesurer();
  const ouvert = basDeLaZone();

  fenetre = tel.fenetre;
  await mesurer();
  await evenement('Hide', tel.fermeture);
  await mesurer();
  await mesurer();
  const referme = basDeLaZone();

  act(() => arbre.unmount());
  return { ferme, ouvert, referme };
};

describe('ANDROIDBAR-4 — fenêtre « retard » : Android 15 et 16', () => {
  it.each([
    ['Android 16, 3 boutons', androidBordABord(36, 48)],
    ['Android 15, gestes', androidBordABord(35, 24)],
  ])('%s : ouvert, la carte se centre au-dessus du clavier ; refermé, aucun retrait', async (
    _nom,
    tel,
  ) => {
    const mesure = await jouer(/** @type {Telephone} */ (tel));

    expect(mesure.ouvert).toBeCloseTo(tel.hautDuClavier, 5);
    expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
  });
});

describe('ANDROIDBAR-4 — caractérisation : iPhone et Android ≤ 14 ne bougent pas', () => {
  it('iPhone 15 : 24 dp au-dessus du clavier (décalage iOS), refermé comme avant', async () => {
    const mesure = await jouer(IPHONE_15);

    expect(mesure.ouvert).toBeCloseTo(IPHONE_15.hautDuClavier - 24, 5);
    expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
  });

  it('Android 14 : ouvert, au clavier ; refermé, 24 dp restent (inchangé)', async () => {
    const mesure = await jouer(ANDROID_14);

    expect(mesure.ouvert).toBeCloseTo(ANDROID_14.hautDuClavier, 5);
    expect(mesure.ferme - mesure.referme).toBeCloseTo(24, 5);
  });
});
