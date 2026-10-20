/**
 * LES OUTILS DES TÉMOINS DU GÉRANT DE COMPLEXE — RESA-L5A1 (13/10/2026).
 *
 * Un seul endroit pour ce que chaque témoin des écrans du gérant recopiait : le thème réel sans
 * images, la lecture de l'arbre (textes, boutons par libellé ou par repère) et les données
 * d'exemple de la toile validée (« Le Five de Montrivage », Terrain 1, Padel A). Les `jest.mock`
 * restent dans chaque témoin (jest les remonte en tête de fichier) ; ils appellent ces fabriques.
 */
const { Text } = require('react-native');

const alignements = require('@/theme/alignements').default;
const genererStyles = require('@/theme/applicationStyle').default;
const genererCouleurs = require('@/theme/colors').default;
const genererPolices = require('@/theme/fonts').default;
const espaces = require('@/theme/spaces').default;

/**
 * Le thème RÉEL (couleurs, polices, styles, alignements, espaces), sans images : la fabrique d'un
 * `jest.mock('@/theme/themeContext', …)`.
 * @returns {{ __esModule: true, default: () => any }} Le module doublé.
 */
const themeDeTemoin = () => {
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
};

/**
 * Le texte d'un nœud `Text`, enfants compris.
 * @param {any} enfants - Les enfants.
 * @returns {string} Le texte.
 */
const texteDe = (enfants) => {
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (Array.isArray(enfants)) return enfants.map(texteDe).join('');
  if (typeof enfants === 'object') return texteDe(enfants.props?.children);
  return String(enfants);
};

/**
 * Tous les textes affichés, dans l'ordre de l'arbre.
 * @param {any} arbre - L'arbre de `react-test-renderer`.
 * @returns {string[]} Les textes.
 */
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud.props.children));

/**
 * Les textes affichés, espaces insécables rendus ordinaires : les puces et les états vides de l'app
 * écrivent leurs mots avec des espaces insécables (`texteInsecable`).
 * @param {any} arbre - L'arbre.
 * @returns {string[]} Les textes.
 */
const lisibles = (arbre) => textes(arbre)
  .map((texte) => texte.split(String.fromCharCode(160)).join(' '));

/**
 * Le premier élément pressable dont le libellé (texte, `title` ou `accessibilityLabel`) contient
 * `libelle`.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé cherché.
 * @returns {any} Le nœud ; lève une erreur s'il n'existe pas.
 */
const pressable = (arbre, libelle) => {
  const ordinaire = (/** @type {string} */ texte) => texte
    .split(String.fromCharCode(160)).join(' ');
  const contient = (/** @type {unknown} */ texte) => ordinaire(String(texte || ''))
    .includes(libelle);
  const noeuds = arbre.root.findAll((/** @type {any} */ noeud) => (
    typeof noeud.props?.onPress === 'function'
    && typeof noeud.type !== 'string'
    && (contient(noeud.props?.title)
      || contient(noeud.props?.accessibilityLabel)
      || noeud.findAllByType(Text)
        .some((/** @type {any} */ texte) => contient(texteDe(texte.props.children))))));
  if (!noeuds.length) throw new Error(`Aucun élément pressable « ${libelle} »`);
  return noeuds[0];
};

/**
 * Le premier nœud portant ce repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {any | null} Le nœud, ou null.
 */
const parRepere = (arbre, testID) => {
  const noeuds = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === testID
  ));
  return noeuds[0] || null;
};

/**
 * RESA-L5A2 (14/10/2026) — le sélecteur d'onglets de l'app (`SegmentedControl`) charge les gestes
 * natifs, que jest ne lit pas : sa doublure, un bouton par onglet (libellé, choisi ou non). La
 * fabrique d'un `jest.mock('@/components/molecules/segmentedControl/SegmentedControl', …)`.
 * @returns {{ __esModule: true, default: (props: any) => any }} Le module doublé.
 */
const ongletsDeTemoin = () => {
  // Chargés à l'appel : la fabrique s'exécute dans un `jest.mock`, avant les imports du témoin.
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const { TouchableOpacity, View } = require('react-native');
  return {
    __esModule: true,
    default: function FauxOnglets(/** @type {any} */ { onChange, options, value }) {
      return createElement(View, null, options.map((/** @type {any} */ option) => createElement(
        TouchableOpacity,
        {
          accessibilityRole: 'tab',
          accessibilityState: { selected: option.value === value },
          key: option.value,
          onPress: () => onChange(option.value),
        },
        createElement(Text, null, option.label),
      )));
    },
  };
};

/** Le complexe d'exemple de la toile (données fictives). */
const COMPLEXE_FIVE = Object.freeze({
  city: 'Montrivage',
  documentId: 'cx-five',
  logo: null,
  name: 'Le Five de Montrivage',
  slug: 'le-five-de-montrivage',
  status: 'actif',
  verified: false,
});

/**
 * Un terrain du gérant, tel que `GET /complexes/:id/terrains` le rend (RESA-L1B).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le terrain.
 */
const terrainDeTemoin = (autres = {}) => ({
  basePrice: 60,
  bookingMode: 'automatique',
  bookingPhone: null,
  bookingPhoneText: null,
  capacity: 10,
  creneaux: {
    openSlots: null, ranges: [], slotsPerWeek: 0, status: 'vide',
  },
  documentId: 't-1',
  isBookable: true,
  name: 'Terrain 1',
  photos: [],
  priceUnit: 'creneau',
  setting: 'exterieur',
  slotPlan: null,
  sport: { documentId: 'a-five', name: 'Football à 5' },
  ...autres,
});

/** Un modèle de créneaux ouvert : lun-ven 17 h – 23 h, sam-dim 9 h – 22 h. */
const PLAN_OUVERT = Object.freeze({
  extraSlots: [],
  period: { from: '2026-10-13', until: null },
  ranges: [
    {
      days: [1, 2, 3, 4, 5], durationMinutes: 60, from: '17:00', to: '23:00',
    },
    {
      days: [6, 7], durationMinutes: 90, from: '09:00', to: '22:00',
    },
  ],
  rates: [],
});

/**
 * RESA-L5B-2 (20/10/2026) — la doublure de `useComplexeChoisi` (complexeQueries) : le complexe de
 * l'adresse, tel quel (les témoins des écrans du gérant passent toujours `complexeId`).
 * @param {string | null | undefined} complexeId - Le complexe demandé.
 * @returns {{ complexe: any, complexeId: string | null, mes: any }} Le complexe et la lecture.
 */
const complexeChoisiDeTemoin = (complexeId) => ({
  complexe: complexeId ? { documentId: complexeId } : null,
  complexeId: complexeId || null,
  mes: { data: [], isLoading: false },
});

module.exports = {
  COMPLEXE_FIVE,
  complexeChoisiDeTemoin,
  lisibles,
  ongletsDeTemoin,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
  textes,
  themeDeTemoin,
};
