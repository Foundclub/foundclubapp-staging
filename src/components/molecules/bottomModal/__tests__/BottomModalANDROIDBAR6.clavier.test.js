import fs from 'fs';
import path from 'path';

import { createElement } from 'react';
import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// 🤖 ANDROIDBAR-6 — LES FEUILLES DU BAS NE REMONTAIENT PAS AU-DESSUS DU CLAVIER (Android 15/16).
//
// MESURÉ à l'émulateur le 14/10/2026 (séance clavier, doute D1, planche P05), Pixel 9, Android 16,
// navigation à 3 boutons, haut du clavier à 1541 px :
// - « Nouvelle tâche » (EventTasksEditor) : feuille 685-2424 px IMMOBILE ; « Nombre de personnes »
//   1668-1810 et « Annuler / Ajouter » 2035-2158 SOUS le clavier ;
// - « Adresse » (AutocompleteSelect) : feuille 507-2424 px IMMOBILE ; « Sélectionner » 2102-2225
//   SOUS le clavier.
//
// LA CAUSE se lit dans `@gorhom/bottom-sheet` 5.2.4 : sur Android en mode `adjustResize`, la
// bibliothèque NE DÉPLACE PAS la feuille — elle fait confiance à Android pour rétrécir la fenêtre.
// Or Android 15 impose le bord à bord (targetSdk 35) : la fenêtre ne rétrécit plus. Et
// `BottomModal` passait `adjustResize` par défaut à 135 feuilles sur 136.
//
// ⚠️ CE QUE CE TÉMOIN NE PROUVE PAS : Jest ne fait tourner ni la mise en page ni les animations de
// la bibliothèque (Reanimated). Il prouve (1) le réglage que `BottomModal` donne RÉELLEMENT à la
// bibliothèque sur chaque téléphone, (2) que les trois règles de la bibliothèque qu'il recopie sont
// toujours dans son code, et (3) où ces règles posent les deux feuilles mesurées. Le rendu se
// constate à l'émulateur (2ᵉ séance : `.tmp/portes/ANDROIDBAR/LOT6/gestes-emulateur.md`).

const DENSITE = 2.625;
const px = (/** @type {number} */ valeur) => valeur / DENSITE;
const ECRAN = px(2424);
const BARRE_ETAT = px(142);
const BARRE_NAV = 48;
const HAUT_DU_CLAVIER = px(1541);

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 0, left: 0, right: 0, top: 0,
};
/** Les réglages reçus par la bibliothèque, dans l'ordre des rendus. */
const mockRecus = /** @type {any[]} */ ([]);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

// La feuille de la bibliothèque est doublée : elle enregistre ce qu'elle reçoit.
jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      mockRecus.push(props);
      reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
      return reactActuel.createElement(VueRN, null, props.children);
    }),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
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
      Images: { close: 1 },
      Spaces: espaces,
    }),
  };
});

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Monte une feuille sur un téléphone et rend les réglages reçus par la bibliothèque.
 * @param {'ios' | 'android'} os
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 * @param {any} [props] Props de la feuille.
 * @returns {any} Les props reçues par `BottomSheetModal`.
 */
const reglagesRecus = (os, version, props = {}) => {
  Platform.OS = /** @type {any} */ (os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockRecus.length = 0;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      { close: () => {}, isVisible: true, ...props },
      createElement(Text, null, 'contenu'),
    ));
  });
  const recus = mockRecus[mockRecus.length - 1];
  act(() => arbre.unmount());
  return recus;
};

afterEach(() => {
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
});

// ─── (2) Les règles de la bibliothèque, lues dans son code ───────────────────

const BIBLIOTHEQUE = path.dirname(require.resolve('@gorhom/bottom-sheet/package.json'));
const lireLaBibliotheque = (/** @type {string} */ relatif) => fs.readFileSync(
  path.join(BIBLIOTHEQUE, 'lib', 'commonjs', relatif),
  'utf8',
);

describe('ANDROIDBAR-6 — les règles de @gorhom/bottom-sheet que ce témoin recopie', () => {
  // Témoin de la BIBLIOTHÈQUE, vert avant comme après. S'il rougit (montée de version), le modèle
  // ci-dessous est à refaire, et le réglage par défaut de BottomModal à remesurer.
  it('5.2.4 : sur Android en `adjustResize`, la feuille ne bouge pas au clavier', () => {
    expect(JSON.parse(lireLaBibliotheque('../../package.json')).version).toBe('5.2.4');
    const feuille = lireLaBibliotheque('components/bottomSheet/BottomSheet.js');
    // Position : la remontée « interactive » est sautée sur Android en adjustResize…
    expect(feuille).toContain(
      "!(_reactNative.Platform.OS === 'android' && android_keyboardInputMode === 'adjustResize')",
    );
    // … et la hauteur du clavier dans le conteneur y est forcée à 0.
    expect(feuille).toMatch(/Platform\.OS === 'android' && android_keyboardInputMode === _constants\.KEYBOARD_INPUT_MODE\.adjustResize\) \{\s+heightWithinContainer = 0;/);
  });

  it('ailleurs, elle remonte de la hauteur du clavier dans son conteneur, bornée en haut', () => {
    const feuille = lireLaBibliotheque('components/bottomSheet/BottomSheet.js');
    expect(feuille).toContain(
      'return Math.max(0, highestDetentPosition - keyboardHeightInContainer);',
    );
    expect(feuille).toContain(
      'Math.abs(height - Math.abs(bottomInset - containerOffset.bottom))',
    );
    // Hauteur du clavier : du bas de l'écran au haut du clavier (barre de navigation comprise).
    expect(lireLaBibliotheque('hooks/useAnimatedKeyboard.js')).toContain(
      '_constants.SCREEN_HEIGHT - event.endCoordinates.height - event.endCoordinates.screenY',
    );
    // Trop haute pour tenir au-dessus du clavier : sa zone visible s'arrête au clavier.
    expect(lireLaBibliotheque('components/bottomSheet/BottomSheetContent.js')).toContain(
      'contentHeight = containerHeight - keyboardHeightWithinContainer - handleHeight;',
    );
  });
});

// ─── (3) Les deux feuilles mesurées, clavier ouvert ──────────────────────────

/**
 * Où la bibliothèque pose une feuille clavier ouvert (comportement « interactive »), selon ses
 * règles lues plus haut. Tout en dp, coordonnées de l'écran.
 * Hypothèse (SUPPOSÉ, à voir à l'émulateur) : le conteneur des feuilles couvre l'écran (bord à
 * bord), donc son décalage bas vaut 0 et la hauteur du clavier dans le conteneur est celle du
 * clavier, barre de navigation comprise.
 * @param {{ os: string, mode: string, topInset: number, bottomInset: number }} recus
 * @param {number} hautDeLaFeuille Haut de la feuille, clavier fermé.
 * @returns {{ decalage: number, basVisible: number }} `decalage` : de combien la feuille
 *   remonte ; `basVisible` : où s'arrête ce qu'elle montre.
 */
const feuilleClavierOuvert = (recus, hautDeLaFeuille) => {
  if (recus.os === 'android' && recus.mode === 'adjustResize') {
    return { basVisible: ECRAN, decalage: 0 };
  }
  const hauteurDuConteneur = ECRAN - recus.topInset - recus.bottomInset;
  const clavierDansLeConteneur = Math.abs((ECRAN - HAUT_DU_CLAVIER) - recus.bottomInset);
  const hauteurDeLaFeuille = ECRAN - recus.bottomInset - hautDeLaFeuille;
  const position = Math.max(
    0,
    (hautDeLaFeuille - recus.topInset) - clavierDansLeConteneur,
  );
  const nouveauHaut = recus.topInset + position;
  const hauteurVisible = clavierDansLeConteneur + hauteurDeLaFeuille > hauteurDuConteneur
    ? hauteurDuConteneur - clavierDansLeConteneur
    : hauteurDeLaFeuille;
  return {
    basVisible: nouveauHaut + hauteurVisible,
    decalage: hautDeLaFeuille - nouveauHaut,
  };
};

/**
 * @typedef {object} FeuilleMesuree
 * @property {string} nom
 * @property {any} props Les props que l'écran donne à BottomModal.
 * @property {number} haut Haut de la feuille, clavier fermé (dp).
 * @property {[number, number]} champ Le champ qui prend la main (dp, clavier fermé).
 * @property {[number, number]} action Le bouton d'action (dp, clavier fermé).
 * @property {boolean} actionDansLePied Le bouton est dans le pied de BottomModal (collé au bas
 *   de ce que la feuille montre) ; sinon il suit le contenu.
 */

/** @type {FeuilleMesuree[]} */
const FEUILLES = [
  {
    action: [px(2035), px(2158)],
    actionDansLePied: false,
    champ: [px(1668), px(1810)],
    haut: px(685),
    nom: '« Nouvelle tâche » (EventTasksEditor.js:240)',
    props: { scrollable: false, snapPoints: ['78%'] },
  },
  {
    action: [px(2102), px(2225)],
    actionDansLePied: true,
    champ: [px(686), px(802)],
    haut: px(507),
    nom: '« Adresse » (AutocompleteSelect.js:593)',
    props: { footerComponent: createElement(Text, null, 'Sélectionner'), snapPoints: ['90%'] },
  },
];

const ANDROID_15_16 = [
  ['Android 16, Pixel 9, 3 boutons', 36],
  ['Android 15, Pixel 9, 3 boutons', 35],
];

const TITRE_FEUILLE = '%s : la feuille remonte, le champ est au-dessus du clavier, '
  + 'rien n est dessiné dessous';

/** @type {any[]} */
const releves = [];

afterAll(() => {
  // Banc : `ANDROIDBAR6_BANC_FEUILLES=<fichier>` écrit les positions (aucun effet en porte).
  if (process.env.ANDROIDBAR6_BANC_FEUILLES) {
    fs.writeFileSync(process.env.ANDROIDBAR6_BANC_FEUILLES, JSON.stringify(releves, null, 2));
  }
});

describe.each(FEUILLES.map((feuille) => [feuille.nom, feuille]))(
  'ANDROIDBAR-6 — %s, clavier ouvert (haut du clavier 1541 px)',
  (_nom, /** @type {any} */ feuille) => {
    it.each(ANDROID_15_16)(TITRE_FEUILLE, (telephone, version) => {
      mockInsets.top = BARRE_ETAT;
      mockInsets.bottom = BARRE_NAV;
      const recus = reglagesRecus('android', version, feuille.props);
      const pose = feuilleClavierOuvert({
        bottomInset: recus.bottomInset,
        mode: recus.android_keyboardInputMode,
        os: 'android',
        topInset: recus.topInset,
      }, feuille.haut);
      const champ = feuille.champ.map((y) => y - pose.decalage);
      const basDeLAction = feuille.actionDansLePied
        ? pose.basVisible - (ECRAN - feuille.action[1])
        : feuille.action[1] - pose.decalage;
      releves.push({
        actionVisible: basDeLAction <= Math.min(pose.basVisible, HAUT_DU_CLAVIER) + 0.01,
        basDeLAction: basDeLAction * DENSITE,
        basVisible: pose.basVisible * DENSITE,
        champ: champ.map((y) => y * DENSITE),
        clavier: 1541,
        feuille: feuille.nom,
        mode: recus.android_keyboardInputMode,
        telephone,
      });

      expect(recus.keyboardBehavior).toBe('interactive');
      // La feuille ne dessine plus rien sous le clavier…
      expect(pose.basVisible).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
      // … et le champ qui prend la main est au-dessus.
      expect(champ[1]).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
      if (feuille.actionDansLePied) {
        // Le pied suit le bas de la feuille : le bouton d'action est au-dessus du clavier.
        expect(basDeLAction).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
      }
    });
  },
);

// ─── (1) Le réglage reçu par la bibliothèque, téléphone par téléphone ────────

// Ce que la bibliothèque recevait AVANT ce lot (relevé le 14/10 sur e68d8843), clavier compris.
const AVANT = {
  android_keyboardInputMode: 'adjustResize',
  bottomInset: 0,
  keyboardBehavior: 'interactive',
  keyboardBlurBehavior: 'restore',
};

describe('ANDROIDBAR-6 — ce qui ne bouge pas', () => {
  it.each([
    ['iPhone 15', 'ios', '18.0', 59, 34],
    ['iPhone SE', 'ios', '18.0', 20, 0],
    ['Android 14, 3 boutons', 'android', 34, 0, 0],
  ])('%s : la bibliothèque reçoit les réglages d avant, au mot près', (_n, os, ver, haut, bas) => {
    mockInsets.top = /** @type {number} */ (haut);
    mockInsets.bottom = /** @type {number} */ (bas);
    const recus = reglagesRecus(/** @type {any} */ (os), ver);
    expect(recus).toMatchObject({ ...AVANT, topInset: /** @type {number} */ (haut) + 20 });
  });

  it.each([
    ['adjustResize'],
    ['adjustPan'],
  ])('une feuille qui fixe son réglage (%s) le garde sur Android 16', (mode) => {
    mockInsets.top = BARRE_ETAT;
    mockInsets.bottom = BARRE_NAV;
    const recus = reglagesRecus('android', 36, { androidKeyboardInputMode: mode });
    expect(recus.android_keyboardInputMode).toBe(mode);
  });

  it('une feuille qui fixe son comportement le garde sur Android 16', () => {
    mockInsets.top = BARRE_ETAT;
    mockInsets.bottom = BARRE_NAV;
    expect(reglagesRecus('android', 36, { keyboardBehavior: 'extend' }).keyboardBehavior)
      .toBe('extend');
  });
});
