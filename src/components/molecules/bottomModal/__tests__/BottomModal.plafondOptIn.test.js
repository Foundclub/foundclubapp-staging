import { createElement } from 'react';
import { Dimensions, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// R5 (D1) — LE PLAFOND DE LA ZONE DEFILANTE DEVIENT REGLABLE, PAR EXCEPTION.
//
// Motif : a la recette de la 2.6.26, la feuille « Gerer l'evenement » « est trop
// petite, on ne voit pas toutes les actions du premier coup ». Elle porte 5 a 7
// rangees dont deux a note de 2-3 lignes, et sa zone defilante est plafonnee a
// 70 % de la hauteur d'ECRAN (`BottomModal.js`) : les dernieres rangees, dont
// « Annuler l'evenement », tombent sous le pli.
//
// ⛔ CE FICHIER NE DEPLACE PAS LE DEFAUT. `BottomModal` sert 70 appelants ; en
// remonter le plafond pour tout le monde changerait 70 ecrans sans qu'aucun
// temoin ne le voie. La prop est donc OPT-IN : qui ne la passe pas garde
// exactement le rendu d'avant, et c'est le premier temoin ci-dessous qui le
// verrouille — en double du filet D19 (`BottomModal.debordement.test.js`).
//
// ⚠️ CE QU'IL NE PROUVE PAS : Jest n'a pas de moteur de mise en page, il ne
// mesure aucun pixel. Il lit la CONTRAINTE posee sur l'arbre. C'est suffisant
// ici parce que le defaut EST une contrainte ; le rendu, lui, se constate sur un
// telephone.

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, { testID: 'feuille', ...props }, props.children);
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-defilante' },
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-fixe' },
      props.children,
    ),
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

/**
 * Aplatit un style RN (tableau, valeurs nulles) en un seul objet.
 * @param {any} style Style tel que passe au composant.
 * @returns {Record<string, any>} Le style resolu.
 */
const styleAplati = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));

/** @type {any} */
let arbre;

/**
 * Monte une feuille a en-tete dont le contenu deborde : plus haut que l'ecran.
 * @param {any} [props] Proprietes supplementaires passees a la feuille.
 * @returns {any} La zone defilante, seul noeud qui porte le plafond.
 */
const monterUneFeuille = (props = {}) => {
  const hauteurEcran = Dimensions.get('screen').height;

  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      {
        close: () => {},
        headerComponent: createElement(Text, null, 'TITRE'),
        isVisible: true,
        ...props,
      },
      createElement(View, { style: { height: hauteurEcran * 2 } }),
    ));
  });

  return arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'zone-defilante',
  ).pop();
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('R5 (D1) — le plafond de la zone defilante', () => {
  test('sans la prop, il reste a 70 % de la hauteur d ECRAN', () => {
    const zoneDefilante = monterUneFeuille();

    expect(styleAplati(zoneDefilante.props.style).maxHeight)
      .toBe(Dimensions.get('screen').height * 0.7);
  });

  test('avec `maxContentHeightRatio`, il monte a la fraction demandee', () => {
    const zoneDefilante = monterUneFeuille({ maxContentHeightRatio: 0.9 });

    expect(styleAplati(zoneDefilante.props.style).maxHeight)
      .toBe(Dimensions.get('screen').height * 0.9);
  });

  // La feuille a hauteur fixe n'a PAS de plafond : elle prend la place laissee
  // par l'en-tete et le pied (`flex: 1`). La prop ne doit pas y rouvrir un
  // maxHeight, sinon elle casserait la quarantaine de feuilles a `snapPoints`.
  test('avec `snapPoints`, la prop est ignoree et la zone reste en flex', () => {
    const zoneDefilante = monterUneFeuille({
      maxContentHeightRatio: 0.9,
      snapPoints: ['90%'],
    });
    const style = styleAplati(zoneDefilante.props.style);

    expect(style.flex).toBe(1);
    expect(style.maxHeight).toBeUndefined();
  });
});
