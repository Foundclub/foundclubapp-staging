import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';
import { createElement } from 'react';
import {
  DeviceEventEmitter, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '../WizardStepLayout';

// 🤖 ANDROIDBAR-6 — LE « SUIVANT » DES ASSISTANTS PASSAIT SOUS LE CLAVIER.
//
// MESURÉ à l'émulateur le 14/10/2026 (séance clavier, doute D2, planche P08) : « Créer une
// équipe », étape 1/8, Pixel 9, Android 16, navigation à 3 boutons. Bas du bouton « Suivant » :
// 2267 px clavier fermé, 1683 px clavier OUVERT, 2267 px refermé — alors que le haut du clavier
// est à 1541 px. 142 px = 54 dp SOUS le clavier : le bouton est entièrement caché.
//
// La cause se lit (D23, ScreenContainer.js) : le décalage d'un KeyboardAvoidingView vaut la
// position ÉCRAN de son PARENT. Celui du gabarit vivait DANS le contenu du ScreenContainer,
// posé sous la barre d'état (54 dp, Pixel 9) ou sous l'en-tête ; son décalage 0 le croyait en
// haut de l'écran. Même erreur sur iPhone : 59 pt sous le clavier (iPhone 15), 20 (iPhone SE).
//
// Ce témoin monte le VRAI gabarit, le VRAI ScreenContainer et le VRAI KeyboardAvoidingView de
// React Native 0.81, et joue les charges qu'Android et iOS envoient réellement — géométrie
// MESURÉE à l'émulateur (haut du clavier 1541 px, Gboard avec sa barre de suggestions). Jest
// n'a pas de moteur de mise en page : chaque vue de la chaîne part du haut de son parent et en
// remplit la hauteur (la règle des écrans visés : fond plein écran, en-tête masqué), sauf si
// l'évitement lui impose une hauteur. Le rendu réel se constate à l'émulateur et sur l'iPhone.
//
// Deuxième partie : les 51 assistants rendent ce gabarit EN RACINE, sans évitement à eux — ce
// qui est prouvé ici pour le gabarit vaut donc pour eux (dont un d'événement, un d'équipe et un
// de club, nommés plus bas).

const RACINE = path.resolve(__dirname, '..', '..', '..', '..', '..');

const DENSITE = 2.625;
const ECRAN_PIXEL_9 = 2424 / DENSITE;
// Mesuré le 14/10 : `ime frame=[0,1541][1080,2424]` (Gboard affiche sa barre de suggestions).
const HAUT_DU_CLAVIER_PIXEL_9 = 1541 / DENSITE;
const BARRE_ETAT_PIXEL_9 = 142 / DENSITE;
// Clavier SANS la barre de navigation (3 boutons, 48 dp) : ce qu'Android envoie à l'ouverture.
const CLAVIER_PIXEL_9 = ECRAN_PIXEL_9 - HAUT_DU_CLAVIER_PIXEL_9 - 48;
// L'écart que le gabarit garde sous son bouton (D53), au-dessus de la barre système.
const ECART_SOUS_LE_BOUTON = 12;

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 0, left: 0, right: 0, top: 0,
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le VRAI thème, sans le contexte React qui le porte (motif de WizardStepLayout.test.js).
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
      Images: {
        arrowLeft: 1, bg1: 1, bg2: 2, bg3: 3, close: 2,
      },
      Spaces: espaces,
    }),
  };
});

// Le bouton : une vue pressable qui porte son libellé, repérable par `testID`.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { accessibilityRole: 'button', onPress: props.onPress, testID: 'bouton-suivant' },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

// ─── Les téléphones ──────────────────────────────────────────────────────────

/**
 * @typedef {object} Telephone
 * @property {string} nom
 * @property {'ios' | 'android'} os
 * @property {number | string} version `Platform.Version`.
 * @property {number} haut `insets.top` (barre d'état).
 * @property {number} bas `insets.bottom` (barre du bas).
 * @property {number} fenetre Hauteur de la fenêtre, clavier fermé.
 * @property {number} fenetreClavierOuvert Hauteur de la fenêtre, clavier ouvert (Android ≤ 14 :
 *   `adjustResize` la rétrécit ; ailleurs elle ne bouge pas).
 * @property {number} hautDuClavier Haut du clavier dans les coordonnées de la vue racine.
 * @property {any} ouverture La charge de l'événement d'ouverture.
 * @property {any} fermeture La charge de l'événement de fermeture.
 */

/**
 * Android 15/16, bord à bord : la fenêtre couvre tout l'écran.
 * @param {string} nom
 * @param {number} version
 * @param {number} barreDEtat
 * @param {number} barreDuBas
 * @returns {Telephone}
 */
const androidBordABord = (nom, version, barreDEtat, barreDuBas) => ({
  bas: barreDuBas,
  fenetre: ECRAN_PIXEL_9,
  fenetreClavierOuvert: ECRAN_PIXEL_9,
  // Charges de ReactRootView.java : clavier SANS la barre système ; à la fermeture, la
  // hauteur VISIBLE (écran − barres) en guise de haut du clavier.
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN_PIXEL_9 - barreDuBas - barreDEtat, width: 411,
  },
  haut: barreDEtat,
  hautDuClavier: ECRAN_PIXEL_9 - CLAVIER_PIXEL_9 - barreDuBas,
  nom,
  os: 'android',
  ouverture: {
    height: CLAVIER_PIXEL_9,
    screenX: 0,
    screenY: ECRAN_PIXEL_9 - CLAVIER_PIXEL_9 - barreDuBas,
    width: 411,
  },
  version,
});

/** Android ≤ 14 : barre d'état opaque (24 dp), 3 boutons, fenêtre rétrécie par `adjustResize`. */
const ANDROID_14 = /** @type {Telephone} */ ({
  bas: 0,
  fenetre: ECRAN_PIXEL_9 - 24 - 48,
  fenetreClavierOuvert: HAUT_DU_CLAVIER_PIXEL_9 - 24,
  // L'événement porte des coordonnées d'ÉCRAN ; la vue racine commence sous la barre d'état.
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN_PIXEL_9 - 24 - 48, width: 411,
  },
  haut: 0,
  hautDuClavier: HAUT_DU_CLAVIER_PIXEL_9 - 24,
  nom: 'Android 14, 3 boutons',
  os: 'android',
  ouverture: {
    height: CLAVIER_PIXEL_9, screenX: 0, screenY: HAUT_DU_CLAVIER_PIXEL_9, width: 411,
  },
  version: 34,
});

/**
 * iPhone : la fenêtre couvre l'écran, la barre du bas est sous le clavier.
 * @param {string} nom
 * @param {number} ecran
 * @param {number} barreDEtat
 * @param {number} barreDuBas
 * @param {number} clavier Hauteur du clavier (avec la zone du bas).
 * @returns {Telephone}
 */
const iphone = (nom, ecran, barreDEtat, barreDuBas, clavier) => ({
  bas: barreDuBas,
  fenetre: ecran,
  fenetreClavierOuvert: ecran,
  fermeture: {
    height: 0, screenX: 0, screenY: ecran, width: 393,
  },
  haut: barreDEtat,
  hautDuClavier: ecran - clavier,
  nom,
  os: 'ios',
  ouverture: {
    height: clavier, screenX: 0, screenY: ecran - clavier, width: 393,
  },
  version: '18.0',
});

const TELEPHONES = [
  androidBordABord('Android 16, Pixel 9, 3 boutons', 36, BARRE_ETAT_PIXEL_9, 48),
  androidBordABord('Android 15, Pixel 9, gestes', 35, BARRE_ETAT_PIXEL_9, 24),
  androidBordABord('Android 15, barre d état 24 dp, 3 boutons', 35, 24, 48),
  ANDROID_14,
  iphone('iPhone 15', 852, 59, 34, 336),
  iphone('iPhone SE', 667, 20, 0, 260),
];

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

// ─── La mesure ───────────────────────────────────────────────────────────────

const lire = (/** @type {any} */ style, /** @type {'Top' | 'Bottom'} */ cote) => {
  const s = StyleSheet.flatten(style) || {};
  return s[`padding${cote}`] ?? s.paddingVertical ?? s.padding ?? 0;
};

/**
 * Monte le gabarit sur un téléphone, clavier fermé, ouvert, refermé.
 * @param {Telephone} tel
 * @param {{ showSkip?: boolean }} props Props de l'étape.
 * @returns {Promise<{ ferme: number, ouvert: number, referme: number }>} y (dp, coordonnées de
 *   la vue racine) du bas du bloc d'actions — le bas du bouton « Suivant » sans « Passer ».
 */
const jouer = async (tel, props) => {
  Platform.OS = /** @type {any} */ (tel.os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => tel.version });
  mockInsets.top = tel.haut;
  mockInsets.bottom = tel.bas;
  let { fenetre } = tel;

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      WizardStepLayout,
      {
        onNext: () => {},
        onSkip: () => {},
        stepCount: 8,
        stepIndex: 1,
        title: "Nom de l'équipe",
        ...props,
      },
      createElement(TextInput, { placeholder: 'Nom' }),
    ));
  });

  // Les vues hôtes du fond de l'écran jusqu'à `cible`, de l'extérieur vers l'intérieur.
  const chemin = (/** @type {any} */ cible) => {
    const vues = [];
    let noeud = cible;
    while (noeud && noeud.type !== ImageBackground) {
      if (typeof noeud.type === 'string') vues.unshift(noeud);
      noeud = noeud.parent;
    }
    return vues;
  };

  // La boîte de `cible` : chaque vue part du haut du contenu de son parent et en remplit la
  // hauteur, sauf si l'évitement lui impose une hauteur.
  const boite = (/** @type {any} */ cible) => {
    let hautDuParent = 0;
    let hautDuContenu = 0;
    let basDuContenu = fenetre;
    /** @type {{ bas: number, basDuContenu: number, haut: number, y: number }} */
    let derniere = {
      bas: fenetre, basDuContenu: fenetre, haut: 0, y: 0,
    };
    chemin(cible).forEach((vue) => {
      const style = StyleSheet.flatten(vue.props.style) || {};
      const haut = hautDuContenu;
      const bas = style.height !== undefined ? haut + style.height : basDuContenu;
      derniere = {
        bas, basDuContenu: bas - lire(style, 'Bottom'), haut, y: haut - hautDuParent,
      };
      hautDuParent = haut;
      hautDuContenu = haut + lire(style, 'Top');
      basDuContenu = derniere.basDuContenu;
    });
    return derniere;
  };

  // Le bloc d'actions est le DERNIER enfant de l'évitement du gabarit, sous une zone en
  // `flex: 1` : son bas est le bas du contenu de cet évitement.
  const basDesActions = () => {
    const [bouton] = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === 'bouton-suivant',
    );
    let blocDActions = bouton.parent;
    while (typeof blocDActions.type !== 'string') blocDActions = blocDActions.parent;
    let evitement = blocDActions.parent;
    while (typeof evitement.type !== 'string') evitement = evitement.parent;
    return boite(evitement).basDuContenu;
  };

  const vider = () => act(async () => {
    await new Promise((fin) => { setImmediate(fin); });
  });

  // L'appareil renvoie une mesure à chaque changement de hauteur : on la rejoue pour chaque
  // KeyboardAvoidingView (le seul qui la lise), avec son cadre DANS SON PARENT.
  const mesurer = async () => {
    const evitements = arbre.root.findAllByType(KeyboardAvoidingView);
    // eslint-disable-next-line no-restricted-syntax
    for (const evitement of evitements) {
      const [vueHote] = evitement.findAll((/** @type {any} */ n) => typeof n.type === 'string');
      const cadre = boite(vueHote);
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        // eslint-disable-next-line no-underscore-dangle
        await evitement.instance._onLayout({
          nativeEvent: {
            layout: {
              height: cadre.bas - cadre.haut, width: 411, x: 0, y: cadre.y,
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
  const ferme = basDesActions();

  // Android ≤ 14 : la fenêtre rétrécit AVANT que l'événement arrive (ANDROIDBAR-1).
  fenetre = tel.fenetreClavierOuvert;
  await mesurer();
  await evenement('Show', tel.ouverture);
  await mesurer();
  await mesurer();
  const ouvert = basDesActions();

  fenetre = tel.fenetre;
  await mesurer();
  await evenement('Hide', tel.fermeture);
  await mesurer();
  await mesurer();
  const referme = basDesActions();

  act(() => arbre.unmount());
  return { ferme, ouvert, referme };
};

/** @type {any[]} */
const releves = [];

afterAll(() => {
  // Banc : `ANDROIDBAR6_BANC=<fichier>` écrit les mesures (aucun effet en porte).
  if (process.env.ANDROIDBAR6_BANC) {
    fs.writeFileSync(process.env.ANDROIDBAR6_BANC, JSON.stringify(releves, null, 2));
  }
});

describe.each([
  ['sans « Passer cette étape »', { showSkip: false }],
  ['avec « Passer cette étape »', { showSkip: true }],
])('ANDROIDBAR-6 — WizardStepLayout, %s', (variante, props) => {
  it.each(TELEPHONES.map((tel) => [tel.nom, tel]))(
    '%s : fermé comme avant ; ouvert, les actions au-dessus du clavier ; refermé, aucun vide',
    async (_nom, tel) => {
      const mesure = await jouer(tel, props);
      releves.push({
        clavier: tel.hautDuClavier, telephone: tel.nom, variante, ...mesure,
      });

      // Clavier fermé : 0 px de différence — le bloc reste à la barre système + 12 (D53).
      expect(mesure.ferme).toBeCloseTo(tel.fenetre - tel.bas - ECART_SOUS_LE_BOUTON, 5);
      // Clavier ouvert : rien sous le clavier…
      expect(mesure.ouvert).toBeLessThanOrEqual(tel.hautDuClavier + 0.01);
      // … et pas d'autre trou que la marge basse que le gabarit garde déjà.
      expect(tel.hautDuClavier - mesure.ouvert)
        .toBeLessThanOrEqual(tel.bas + ECART_SOUS_LE_BOUTON + 0.01);
      // Refermé : l'écran d'avant, au dp près.
      expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
    },
  );
});

// ─── Les 52 assistants : ce gabarit en racine, aucun évitement à eux ─────────
// COLL-R-DEPLACER (14/10, COL-013) : 51 → 52, « Déplacer la séance »
// (src/views/event/deplacer/DeplacerLaSeance.js) rend le gabarit en racine, sans évitement.

const ASSISTANTS_NOMMES = [
  'src/views/event/wizard/EventWizardDescription.js',
  'src/views/team/wizard/TeamWizardName.js',
  'src/views/club/wizard/ClubWizardName.js',
];

// Ce qui peut entourer le gabarit sans rien changer à sa géométrie : un fragment, ou la borne
// du tutoriel (TutorialFlowBoundary.js : fragment + calque en surimpression).
const ENVELOPPES_NEUTRES = new Set(['<>', 'TutorialFlowBoundary']);

const CLES_IGNOREES = new Set([
  'comments', 'end', 'extra', 'innerComments', 'leadingComments', 'loc', 'start',
  'trailingComments',
]);

/**
 * Les ancêtres JSX de chaque `<WizardStepLayout>` d'un fichier, et ses évitements à lui.
 * @param {string} relatif
 * @returns {{ ancetres: string[][], evitements: number }}
 */
const lireLAssistant = (relatif) => {
  const arbre = parse(fs.readFileSync(path.join(RACINE, relatif), 'utf8'), {
    plugins: ['jsx'],
    sourceType: 'module',
  });
  /** @type {string[][]} */
  const ancetres = [];
  let evitements = 0;
  const parcourir = (/** @type {any} */ noeud, /** @type {string[]} */ pile) => {
    if (!noeud || typeof noeud.type !== 'string') return;
    let suite = pile;
    if (noeud.type === 'JSXFragment') suite = [...pile, '<>'];
    if (noeud.type === 'JSXElement') {
      const nom = noeud.openingElement.name.name || '?';
      if (nom === 'WizardStepLayout') ancetres.push(pile);
      if (nom === 'KeyboardAvoidingView') evitements += 1;
      suite = [...pile, nom];
    }
    Object.keys(noeud).forEach((cle) => {
      if (CLES_IGNOREES.has(cle)) return;
      const valeur = noeud[cle];
      if (Array.isArray(valeur)) valeur.forEach((enfant) => parcourir(enfant, suite));
      else if (valeur && typeof valeur === 'object') parcourir(valeur, suite);
    });
  };
  parcourir(arbre, []);
  return { ancetres, evitements };
};

/**
 * Tous les fichiers de `src/views` (hors témoins) qui importent le gabarit.
 * @returns {string[]}
 */
const assistants = () => {
  /** @type {string[]} */
  const trouves = [];
  const fouiller = (/** @type {string} */ dossier) => {
    fs.readdirSync(path.join(RACINE, dossier), { withFileTypes: true }).forEach((entree) => {
      const relatif = `${dossier}/${entree.name}`;
      if (entree.isDirectory()) {
        if (entree.name !== '__tests__') fouiller(relatif);
      } else if (/\.js$/.test(entree.name) && !/\.test\.js$/.test(entree.name)
        && /wizardStepLayout\/WizardStepLayout'/.test(
          fs.readFileSync(path.join(RACINE, relatif), 'utf8'),
        )) {
        trouves.push(relatif);
      }
    });
  };
  fouiller('src/views');
  return trouves.sort();
};

describe('ANDROIDBAR-6 — les assistants rendent le gabarit en racine, sans évitement à eux', () => {
  const fichiers = assistants();

  it('52 assistants, dont un d événement, un d équipe et un de club', () => {
    expect(fichiers).toHaveLength(52);
    expect(fichiers).toEqual(expect.arrayContaining(ASSISTANTS_NOMMES));
  });

  it.each(fichiers.map((relatif) => [relatif]))('%s', (relatif) => {
    const { ancetres, evitements } = lireLAssistant(relatif);
    expect(ancetres.length).toBeGreaterThan(0);
    ancetres.forEach((pile) => {
      expect(pile.filter((nom) => !ENVELOPPES_NEUTRES.has(nom))).toEqual([]);
    });
    expect(evitements).toBe(0);
  });
});
