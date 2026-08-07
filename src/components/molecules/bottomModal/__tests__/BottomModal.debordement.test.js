import { createElement } from 'react';
import { Dimensions, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// Filet D19 — POURQUOI UNE FEUILLE A ENTETE ET PIED DOIT DECLARER `snapPoints`.
//
// Motif : a la recette du 2026-08-07, la feuille « Repeter » du tunnel
// evenement « ne defile pas jusqu'en bas » et « ses boutons sont
// inatteignables ». `BottomModal` sert 70 fichiers et il SAIT defiler — le
// defaut n'etait pas en lui, il etait dans l'appelant, qui utilisait la mauvaise
// de ses DEUX mises en page.
//
// Ce fichier CARACTERISE le composant partage, il ne le modifie pas. Il decrit
// la difference entre les deux mises en page, avec un contenu PLUS HAUT QUE
// L'ECRAN — sans contenu debordant, il n'y aurait rien a montrer.
//
// ⚠️ CE QU'IL NE PROUVE PAS, et il faut le dire : Jest n'a pas de moteur de mise
// en page, il ne mesure aucun pixel. Il lit les CONTRAINTES posees sur l'arbre.
// C'est suffisant ici parce que le defaut EST une contrainte : une zone
// defilante plafonnee a une fraction de l'ECRAN, dans un conteneur sans flex,
// laisse le pied deborder par le bas. Le rendu, lui, se constate sur un
// telephone.

const INSET_HAUT = 47;
const INSET_BAS = 34;

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

// La feuille native est doublee par des vues qui CONSERVENT leurs styles :
// c'est tout l'objet du test. `present`/`dismiss` sont muets — on n'observe pas
// l'animation, on observe la mise en page.
jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(
          VueRN,
          { testID: 'feuille', ...props },
          props.children,
        );
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
 * Monte une feuille dont le CONTENU DEBORDE : plus haut que l'ecran entier.
 * @param {any} [props] Proprietes supplementaires passees a la feuille.
 * @returns {{ pied: any, zoneDefilante: any }} Les morceaux a inspecter.
 */
const monterUneFeuilleQuiDeborde = (props = {}) => {
  const hauteurEcran = Dimensions.get('screen').height;

  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      {
        close: () => {},
        footerComponent: createElement(Text, null, 'DERNIER-BOUTON'),
        headerComponent: createElement(Text, null, 'TITRE'),
        isVisible: true,
        ...props,
      },
      // Deux fois la hauteur de l'ecran : aucune feuille ne peut le montrer
      // d'un coup, il FAUT que ca defile.
      createElement(View, { style: { height: hauteurEcran * 2 } }),
    ));
  });

  const zoneDefilante = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'zone-defilante',
  ).pop();
  const pied = arbre.root.findAll(
    (/** @type {any} */ noeud) => {
      const enfants = Array.isArray(noeud.props?.children)
        ? noeud.props.children
        : [noeud.props?.children];
      return enfants.some((enfant) => enfant?.props?.children === 'DERNIER-BOUTON');
    },
  ).pop();

  return { pied, zoneDefilante };
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D19 — une feuille du bas dont le contenu deborde', () => {
  // ⛔ L'ETAT DE DEPART, decrit sans jugement : c'est la mise en page que la
  // feuille « Repeter » utilisait, et celle qui a produit le defaut.
  describe('SANS `snapPoints` — la feuille se dimensionne sur son contenu', () => {
    test('sa zone defilante est plafonnee a 70 % de la hauteur d ECRAN', () => {
      const { zoneDefilante } = monterUneFeuilleQuiDeborde();

      expect(styleAplati(zoneDefilante.props.style).maxHeight)
        .toBe(Dimensions.get('screen').height * 0.7);
    });

    // LE POINT QUI FAIT TOUT : ce plafond est une fraction de l'ECRAN, pas de la
    // place restante. L'entete et le pied s'ajoutent PAR-DESSUS au lieu de s'y
    // tailler une part — d'ou un total qui peut depasser la feuille elle-meme.
    test('et rien ne la borne a la place LAISSEE par l entete et le pied', () => {
      const { zoneDefilante } = monterUneFeuilleQuiDeborde();

      expect(styleAplati(zoneDefilante.props.style).flex).toBeUndefined();
      expect(styleAplati(zoneDefilante.parent.props.style).flex).toBeUndefined();
    });
  });

  // ✅ LA MISE EN PAGE A UTILISER pour toute feuille a entete et pied. C'est
  // celle que suivent deja une quarantaine de feuilles de ce depot.
  describe('AVEC `snapPoints` — la feuille a une hauteur fixe', () => {
    test('sa zone defilante prend exactement la place LAISSEE par l entete et le pied', () => {
      const { zoneDefilante } = monterUneFeuilleQuiDeborde({ snapPoints: ['90%'] });
      const style = styleAplati(zoneDefilante.props.style);

      expect(style.flex).toBe(1);
      expect(style.maxHeight).toBeUndefined();
      expect(styleAplati(zoneDefilante.parent.props.style).flex).toBe(1);
    });

    // Le temoin qu'Adel aurait vu : le dernier bouton est encore la, et il est
    // DEHORS de la zone defilante — donc jamais emporte par le defilement.
    test('le dernier bouton reste hors de la zone defilante, a sa place', () => {
      const { pied, zoneDefilante } = monterUneFeuilleQuiDeborde({ snapPoints: ['90%'] });

      expect(pied).toBeDefined();
      expect(zoneDefilante.findAll(
        (/** @type {any} */ noeud) => noeud.props?.children === 'DERNIER-BOUTON',
      )).toEqual([]);
      // Et il garde une reserve pour l'encoche du bas : sinon il serait a
      // l'ecran mais sous la barre de gestes.
      expect(styleAplati(pied.props.style).paddingBottom).toBeGreaterThanOrEqual(INSET_BAS);
    });
  });

  // Le chiffre qui a condamne la premiere mise en page, garde ici pour qu'il ne
  // se reperde pas : la feuille ne peut jamais depasser l'ecran moins son
  // `topInset`, et ce plafond-la est un DECOR, pas une contrainte de mise en
  // page — d'ou le debordement.
  test('la feuille ne peut pas depasser l ecran moins sa reserve haute', () => {
    monterUneFeuilleQuiDeborde();
    const feuille = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'feuille',
    ).pop();

    expect(feuille.props.topInset).toBe(INSET_HAUT + 20);
    expect(Dimensions.get('screen').height * 0.7)
      .toBeLessThan(Dimensions.get('screen').height - feuille.props.topInset);
  });
});
