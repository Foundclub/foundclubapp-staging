import { Platform, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteSelect from '../AutocompleteSelect';

// AUTOCOMPLETE-WEB (E6) — LA GEOMETRIE DE LA VALEUR FERMEE.
//
// ---------------------------------------------------------------------------
// 🧨 LE DEFAUT, MESURE A LA MAIN DANS CHROME LE 2026-09-23
// ---------------------------------------------------------------------------
//
//   BUTTON h=31 position=absolute paddingTop=12 paddingBottom=12
//     DIV "Football" h=7  overflow:hidden        <- il en faut 23 (lineHeight)
//
// La valeur fermee est posee dans une SURCOUCHE absolue en `fullSize`, avec
// `padding: 12` (et `paddingTop: 40` quand il y a un `label`). La hauteur du
// cadre, elle, vient de l `Input` pose dessous — dont la ligne fait 30 px et
// qui n a AUCUNE marge verticale.
//
//   sans label : 30 − 12 − 12 = 6 px pour une ligne de 23
//   avec label : 61 − 40 − 12 = 9 px pour une ligne de 23
//
// Sur telephone ca ne se voit pas : React Native ne decoupe pas, le texte
// deborde. Sur le web, react-native-web pose `overflow: hidden` sur son
// `<Text>` et COUPE LES GLYPHES EN DEUX.
//
// ---------------------------------------------------------------------------
// 🗺️ LA CARTE (R2) — POURQUOI ON CORRIGE LE COMPOSANT ET PAS UN ECRAN
// ---------------------------------------------------------------------------
//
//   83 usages, 31 fichiers.  76 usages sur la variante par defaut (28 fichiers)
//   70 passent un `label` — c est donc le cas a 40 px qui domine.
//   UN SEUL usage passe un style ou un contenu personnalise :
//     components/organisms/phoneInput/PhoneInput.js:383
//
// 🎯 ET C EST PHONEINPUT QUI DONNE LA SOLUTION. Il contournait deja ce defaut,
// pour lui seul et sur le web uniquement (`webClosedPressableStyle`) :
//
//     { justifyContent: 'center', paddingBottom: 0, paddingTop: 0, ... }
//
// C est exactement la bonne geometrie : pas de marge verticale, et on centre.
// Ce lot la remonte dans le composant, pour les 76 usages — et la rend juste
// AUSSI quand il y a un label, ce que le contournement de PhoneInput n avait
// pas a traiter (il n en passe pas).
//
// ---------------------------------------------------------------------------
// ⚖️ CE QUI BOUGE SUR TELEPHONE, ET C EST VOULU
// ---------------------------------------------------------------------------
//
// Aujourd hui, sur mobile, la valeur fermee est posee a 12 px du haut du cadre,
// alors que le texte du meme champ OUVERT est centre dans sa ligne de 30 px,
// donc a ~3,5 px. La valeur fermee est donc ~8 px PLUS BASSE que la meme valeur
// une fois le champ ouvert — un decalage que personne n avait nomme.
// Apres ce lot, les deux sont au meme endroit. Le temoin « LE NATIF » ci-dessous
// mesure ce deplacement au lieu de le subir.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// ⚠️ LA DIFFERENCE AVEC LES DEUX AUTRES TEMOINS DE CE COMPOSANT, ET ELLE EST
// TOUT LE SUJET : eux remplacent le theme par des feuilles VIDES, parce qu ils
// mesurent une decision (ouvrir, deselectionner). Ici on mesure des PIXELS :
// il faut le VRAI theme, sinon le temoin ne mesure rien du tout.
jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Colors = generateColors();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces,
    }),
  };
});

jest.mock('../../bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});
jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});
// L Input n est pas RENDU : ce qu on mesure, c est la surcouche posee dessus.
// ⚠️ Mais ses REPERES de geometrie, eux, restent les vrais — c est tout
// l interet du lot : la surcouche et la ligne lisent desormais les memes
// chiffres, et ce temoin lit ces chiffres-la, pas des copies.
jest.mock('../../input/Input', () => {
  const reel = jest.requireActual('../../input/Input');
  return { ...reel, __esModule: true, default: function InputMock() { return null; } };
});

const Fonts = jest.requireActual('@/theme/fonts').default(
  jest.requireActual('@/theme/colors').default(),
);
const HAUTEUR_DE_LIGNE = Fonts.p1.lineHeight;

const {
  INPUT_ROW_IOS_BOTTOM_PADDING,
  INPUT_ROW_MIN_HEIGHT,
} = jest.requireActual('../../input/Input');

const OPTIONS = [
  { label: 'Football', value: 'foot' },
  { label: 'Basket', value: 'basket' },
];

/**
 * Monte le selecteur FERME, avec une valeur choisie.
 * @param {any} props - Surcharges passees au composant.
 * @returns {any} L arbre monte.
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <AutocompleteSelect
        displayValue="Football"
        options={OPTIONS}
        placeholder="Choisir un sport"
        setValue={jest.fn()}
        value="foot"
        {...props}
      />,
    );
  });
  return arbre;
};

/**
 * La surcouche absolue : le pressable qui porte la valeur fermee.
 * @param {any} arbre - L arbre monte.
 * @returns {any} Le noeud.
 */
const surcouche = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'button'
    && typeof n.props.onPress === 'function',
)[0];

/**
 * La valeur EFFECTIVE d une marge, raccourcis compris.
 * `padding: 12` et `paddingHorizontal: 12` donnent tous deux 12 a gauche : sans
 * ca, le temoin des marges laterales croirait a un changement qui n existe pas.
 * @param {any} style - Un style aplati.
 * @param {...string} clefs - Les clefs, de la plus precise a la plus large.
 * @returns {number} La marge en pixels.
 */
const margeEffective = (style, ...clefs) => {
  for (const clef of clefs) {
    if (typeof style[clef] === 'number') return style[clef];
  }
  return 0;
};

/**
 * La BANDE qui porte la valeur : une boite de hauteur fixe, contenu centre.
 * @param {any} arbre - L arbre monte.
 * @returns {any} Le style aplati de la bande, ou null s il n y en a pas.
 */
const bandeDeValeur = (arbre) => {
  const noeud = arbre.root.findAll((/** @type {any} */ n) => {
    const style = StyleSheet.flatten(n.props.style);
    return Boolean(style)
      && typeof style.height === 'number'
      && style.justifyContent === 'center';
  })[0];

  return noeud ? StyleSheet.flatten(noeud.props.style) : null;
};

/**
 * 📏 COMBIEN DE PIXELS LE COMPOSANT RESERVE POUR LA LIGNE DE VALEUR.
 *
 * Deux formes possibles, et c est tout le lot :
 *  - AVANT : la valeur est posee a meme la surcouche, qui fait la hauteur du
 *    cadre. La place est donc « cadre moins les marges de la surcouche ».
 *  - APRES : la valeur est posee dans une BANDE de hauteur connue. La place est
 *    la hauteur de la bande, et elle ne depend plus ni du cadre ni du label.
 * @param {any} arbre - L arbre monte.
 * @param {number} hauteurDuCadre - La hauteur reelle du cadre, en pixels.
 * @returns {number} Les pixels disponibles pour le texte.
 */
const placeReserveePourLaValeur = (arbre, hauteurDuCadre) => {
  const bande = bandeDeValeur(arbre);
  if (bande) return bande.height;

  const style = StyleSheet.flatten(surcouche(arbre).props.style) || {};
  return hauteurDuCadre
    - margeEffective(style, 'paddingTop', 'paddingVertical', 'padding')
    - margeEffective(style, 'paddingBottom', 'paddingVertical', 'padding');
};

// La seule marge que la ligne de l Input s accorde : celle d iOS.
const MARGE_BASSE_LIGNE = Platform.OS === 'ios' ? INPUT_ROW_IOS_BOTTOM_PADDING : 0;
// Le cadre, c est la ligne de l Input (+ sa marge iOS).
const CADRE_SANS_LABEL = INPUT_ROW_MIN_HEIGHT + MARGE_BASSE_LIGNE;
// Avec un label : le libelle (p3Bold, 19 px) + l ecart de 12 par-dessus.
// Mesure Chrome du 23/09 : cadre = 61 px, ligne = 30 ⇒ bloc du label = 31.
const HAUTEUR_BLOC_LABEL = 31;
const CADRE_AVEC_LABEL = HAUTEUR_BLOC_LABEL + CADRE_SANS_LABEL;

// ---------------------------------------------------------------------------
// 1. 🔴 LE TEMOIN — la valeur doit tenir dans sa ligne
// ---------------------------------------------------------------------------

test('🔴 SANS label : la valeur a la place de sa ligne entiere', () => {
  const place = placeReserveePourLaValeur(monter(), CADRE_SANS_LABEL);

  expect(place).toBeGreaterThanOrEqual(HAUTEUR_DE_LIGNE);
});

test('🔴 AVEC label : la valeur a la place de sa ligne entiere', () => {
  // Le cas qui domine : 70 des 83 usages passent un `label`.
  const place = placeReserveePourLaValeur(monter({ label: 'Sport' }), CADRE_AVEC_LABEL);

  expect(place).toBeGreaterThanOrEqual(HAUTEUR_DE_LIGNE);
});

test('🔴 la surcouche ne mange plus le cadre par le haut, et epouse sa marge du bas', () => {
  // La cause racine, dite en une ligne : des marges verticales posees sur une
  // surcouche qui fait EXACTEMENT la hauteur de ce qu elle recouvre.
  // En bas, la surcouche ne met pas zero : elle reprend la SEULE marge que la
  // ligne de l Input s accorde (celle d iOS), sinon elle se poserait 12 px trop
  // bas sur iPhone.
  const style = StyleSheet.flatten(surcouche(monter()).props.style);

  expect(margeEffective(style, 'paddingTop', 'paddingVertical', 'padding')).toBe(0);
  expect(margeEffective(style, 'paddingBottom', 'paddingVertical', 'padding'))
    .toBe(MARGE_BASSE_LIGNE);
});

// ---------------------------------------------------------------------------
// 2. 📱 LE NATIF — ce qui bouge sur telephone, mesure et nomme
// ---------------------------------------------------------------------------

test('📱 la valeur fermee se pose DANS la ligne, comme le texte du champ ouvert', () => {
  // AVANT ce lot, sur telephone : la valeur etait posee a 12 px du haut du
  // cadre, alors que le texte du MEME champ une fois ouvert est centre dans sa
  // ligne de 30 px (~3,5 px du haut). La valeur fermee etait donc ~8 px plus
  // basse que la valeur ouverte — un decalage que personne n avait nomme.
  //
  // APRES : la valeur vit dans une bande de la hauteur EXACTE de la ligne,
  // contenu centre. Les deux sont au meme endroit. C est le seul deplacement
  // visible sur mobile, et il va dans le bon sens.
  const bande = bandeDeValeur(monter());

  expect(bande).not.toBeNull();
  expect(bande.height).toBe(INPUT_ROW_MIN_HEIGHT);
  expect(bande.justifyContent).toBe('center');
});

test('📱 la bande est collee EN BAS du cadre : c est ce qui la place sous le label', () => {
  // Sans ca, il faudrait deviner la hauteur du libelle — c est exactement le
  // chiffre magique (40) qui a cause le defaut.
  const style = StyleSheet.flatten(surcouche(monter({ label: 'Sport' })).props.style);

  expect(style.justifyContent).toBe('flex-end');
});

// ---------------------------------------------------------------------------
// 3. 🛡️ CARACTERISATION — ce qui NE DOIT PAS bouger (vert avant ET apres)
// ---------------------------------------------------------------------------

test('🛡️ la surcouche reste absolue et couvre TOUT le cadre : la zone tactile ne retrecit pas', () => {
  const style = StyleSheet.flatten(surcouche(monter({ label: 'Sport' })).props.style);

  expect(style.position).toBe('absolute');
  expect(style.height).toBe('100%');
  expect(style.width).toBe('100%');
});

test('🛡️ les marges LATERALES ne bougent pas : aucun texte ne se decale en largeur', () => {
  // Vert AVANT comme APRES : `padding: 12` puis `paddingHorizontal: 12` donnent
  // la meme chose a gauche et a droite. Ce temoin existe pour le prouver — un
  // lot de geometrie verticale ne doit rien deplacer horizontalement.
  const style = StyleSheet.flatten(surcouche(monter()).props.style);

  expect(margeEffective(style, 'paddingLeft', 'paddingHorizontal', 'padding')).toBe(12);
  expect(margeEffective(style, 'paddingRight', 'paddingHorizontal', 'padding')).toBe(12);
});

test('🛡️ un appelant garde le dernier mot sur la geometrie (le cas PhoneInput)', () => {
  // PhoneInput passe `closedPressableStyle`. Il doit continuer a gagner, sinon
  // ce lot casserait le seul ecran qui s etait deja repare tout seul.
  const style = StyleSheet.flatten(surcouche(monter({
    closedPressableStyle: { paddingLeft: 8, paddingRight: 4 },
  })).props.style);

  expect(style.paddingLeft).toBe(8);
  expect(style.paddingRight).toBe(4);
});

test('🛡️ sans valeur, le champ affiche toujours son invite', () => {
  const arbre = monter({ displayValue: undefined, value: '' });
  const invites = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.children === 'Choisir un sport',
  );

  expect(invites.length).toBeGreaterThan(0);
});

test('🛡️ la variante « card » n est pas concernee : elle n a pas de surcouche', () => {
  // 7 usages sur 83. Leur geometrie vient de la carte, pas de l Input : ce lot
  // ne doit pas les effleurer.
  const arbre = monter({ displayVariant: 'card', label: 'Sport' });
  const absolues = arbre.root.findAll((/** @type {any} */ n) => {
    const style = StyleSheet.flatten(n.props.style);
    return Boolean(style) && style.position === 'absolute' && style.height === '100%';
  });

  expect(absolues).toHaveLength(0);
});
