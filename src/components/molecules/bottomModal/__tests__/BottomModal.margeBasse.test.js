import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// FEUILLES-BAS — LA DERNIERE RANGEE D'UNE FEUILLE FINISSAIT AU RAS DU BORD.
//
// Motif : recette du 16/09 (emulateur 1080 x 2424 et iPhone d'Adel, TestFlight
// 2.6.46) : dans toute feuille qui se dimensionne sur son contenu, la derniere
// rangee finit a y = 2423 sur 2424. La marge basse du composant
// (`40 + zone de securite`) n'existe pas a l'ecran.
//
// LA CAUSE, et aucun temoin ne pouvait la voir : `@gorhom/bottom-sheet` 5.2.4
// « aplatit » le style de contenu par `StyleSheet.compose(...style)`
// (`lib/commonjs/hooks/useBottomSheetContentContainerStyle.js:23`). Or
// `compose` ne prend que DEUX arguments (`react-native/src/private/styles/
// composeStyles.js`) : tout ce qui suit le 2e element du tableau est JETE —
// la marge basse, le `minHeight`, et le `contentContainerStyle` de l'appelant.
// Les autres temoins de ce dossier doublent la bibliotheque par des vues qui
// GARDENT le tableau entier : ils voyaient une marge que le telephone n'a
// jamais recue.
//
// Ce temoin branche donc la VRAIE fonction de la bibliotheque entre le
// composant et la vue doublee. Seul son contexte interne est double (il
// n'existe qu'a l'interieur d'une feuille native).
//
// ⚠️ CE QU'IL NE PROUVE PAS : Jest n'a pas de moteur de mise en page. La
// geometrie est CALCULEE a partir d'une regle de la bibliotheque, lue dans son
// code : en dimensionnement dynamique, la feuille prend la hauteur du contenu
// defilant (`onContentSizeChange` -> `contentHeight`,
// `useAnimatedDetents.ts`), ancree au bas de l'ecran. L'ecart entre la
// derniere rangee et le bord vaut donc la marge basse du contenu, ni plus ni
// moins. Le rendu, lui, se constate sur l'emulateur et sur l'iPhone.

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

// Les deux seules dependances de la vraie fonction de style : le contexte
// interne de la feuille (hauteur du pied de la bibliotheque, inutilisee ici)
// et deux primitives d'animation, sans objet sans reglage de pied.
jest.mock('@gorhom/bottom-sheet/lib/commonjs/hooks/useBottomSheetInternal', () => ({
  useBottomSheetInternal: () => ({
    animatedLayoutState: { get: () => ({ footerHeight: 0 }), modify: () => {} },
  }),
}));

jest.mock('react-native-reanimated', () => ({
  runOnJS: (/** @type {Function} */ fonction) => fonction,
  useAnimatedReaction: () => {},
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  // LA VRAIE fonction, celle que le telephone execute.
  const { useBottomSheetContentContainerStyle: styleDeLaBibliotheque } = jest.requireActual(
    '@gorhom/bottom-sheet/lib/commonjs/hooks/useBottomSheetContentContainerStyle',
  );

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, { testID: 'feuille' }, props.children);
      },
    ),
    // Comme `createBottomSheetScrollableComponent` : le style de contenu passe
    // par la fonction de la bibliotheque avant d'atteindre la vue native.
    BottomSheetScrollView: (/** @type {any} */ props) => {
      const styleRecu = styleDeLaBibliotheque(false, props.contentContainerStyle);
      return reactActuel.createElement(
        VueRN,
        { style: props.style, styleDuContenu: styleRecu, testID: 'zone-defilante' },
        props.children,
      );
    },
    // Comme `BottomSheetView` : meme fonction, puis sa position absolue.
    BottomSheetView: (/** @type {any} */ props) => {
      const styleRecu = styleDeLaBibliotheque(false, props.style);
      return reactActuel.createElement(
        VueRN,
        { styleDuContenu: styleRecu, testID: 'zone-fixe' },
        props.children,
      );
    },
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

/** @type {any} */
let arbre;

/**
 * Monte une feuille et rend le style de contenu REELLEMENT recu par la vue
 * native, aplati comme React Native l'aplatit.
 * @param {any} [props] Proprietes passees a la feuille.
 * @param {string} [zone] `zone-defilante` ou `zone-fixe`.
 * @returns {Record<string, any>} Le style de contenu applique.
 */
const styleApplique = (props = {}, zone = 'zone-defilante') => {
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      { close: () => {}, isVisible: true, ...props },
      createElement(Text, null, 'DERNIERE-RANGEE'),
    ));
  });
  const noeud = arbre.root.find((/** @type {any} */ n) => n.props?.testID === zone);
  return StyleSheet.flatten(noeud.props.styleDuContenu) || {};
};

/**
 * Ecart entre le bas de la derniere rangee et le bord de l'ecran, pour une
 * feuille ancree en bas dont la hauteur vaut celle de son contenu.
 * @param {Record<string, any>} style Style de contenu applique.
 * @returns {number} L'ecart, en points.
 */
const margeSousLaDerniereRangee = (style) => Number(
  style.paddingBottom ?? style.paddingVertical ?? style.padding ?? 0,
);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('FEUILLES-BAS — la bibliotheque elle-meme', () => {
  // Temoin de la BIBLIOTHEQUE, vert avant comme apres le correctif. S'il
  // rougit un jour (montee de version corrigee), l'aplatissement fait par
  // `BottomModal` n'est plus necessaire : le retirer.
  test('jette tout ce qui suit le 2e element d un style en tableau', () => {
    const { useBottomSheetContentContainerStyle } = jest.requireActual(
      '@gorhom/bottom-sheet/lib/commonjs/hooks/useBottomSheetContentContainerStyle',
    );
    /** @type {any} */
    let recu;
    /**
     * Appelle la vraie fonction de style avec un tableau de trois elements.
     * @returns {null} Rien a l'ecran.
     */
    function Sonde() {
      recu = useBottomSheetContentContainerStyle(false, [
        { paddingHorizontal: 24 }, { paddingTop: 12 }, { paddingBottom: 74 },
      ]);
      return null;
    }
    act(() => { arbre = renderer.create(createElement(Sonde)); });

    expect(StyleSheet.flatten(recu)).toEqual({ paddingHorizontal: 24, paddingTop: 12 });
  });
});

describe('FEUILLES-BAS — la derniere rangee s ecarte du bord de l ecran', () => {
  describe('feuille DEFILANTE (100 feuilles sur 121)', () => {
    test('dimensionnee sur son contenu, sans entete : marge 40 + zone de securite', () => {
      expect(margeSousLaDerniereRangee(styleApplique()))
        .toBeGreaterThanOrEqual(40 + INSET_BAS);
    });

    test('avec entete (le 2e element du tableau est vide) : meme marge', () => {
      const style = styleApplique({ headerComponent: createElement(Text, null, 'TITRE') });

      expect(margeSousLaDerniereRangee(style)).toBeGreaterThanOrEqual(40 + INSET_BAS);
    });

    test('a hauteur fixe (`snapPoints`) : en fin de defilement, meme marge', () => {
      expect(margeSousLaDerniereRangee(styleApplique({ snapPoints: ['60%'] })))
        .toBeGreaterThanOrEqual(40 + INSET_BAS);
    });

    // La barre de gestes est deja reservee SOUS le pied (dernier temoin de ce
    // fichier) : la compter aussi au-dessus de lui la doublerait.
    test('avec pied : 16 au-dessus du pied, sans compter la zone de securite une 2e fois', () => {
      const style = styleApplique({
        footerComponent: createElement(Text, null, 'PIED'),
        snapPoints: ['60%'],
      });

      expect(margeSousLaDerniereRangee(style)).toBe(16);
    });

    test('la marge explicite d un appelant (`contentBottomPaddingOverride`) arrive', () => {
      expect(margeSousLaDerniereRangee(styleApplique({ contentBottomPaddingOverride: 12 })))
        .toBe(12);
    });

    test('le style d un appelant arrive, sauf sa marge basse (celle du composant gagne)', () => {
      const style = styleApplique({ contentContainerStyle: { gap: 20, paddingBottom: 8 } });

      expect(style.gap).toBe(20);
      expect(margeSousLaDerniereRangee(style)).toBe(40 + INSET_BAS);
    });

    test('la marge et le plancher de hauteur arrivent ensemble', () => {
      expect(styleApplique().minHeight).toBe(100);
    });
  });

  describe('feuille FIXE (`scrollable={false}`, 21 feuilles sur 121)', () => {
    // Ces feuilles posent leur propre marge dans leurs enfants (8 a 24) mais
    // aucune ne compte la barre de gestes : le composant l'ajoute, lui seul.
    test('sans pied : la zone de securite est reservee sous la derniere rangee', () => {
      const style = styleApplique({ scrollable: false }, 'zone-fixe');

      expect(margeSousLaDerniereRangee(style)).toBe(INSET_BAS);
    });

    test('sans pied et sans zone de securite demandee : aucune marge ajoutee', () => {
      const style = styleApplique(
        { scrollable: false, useSafeAreaBottomInset: false },
        'zone-fixe',
      );

      expect(margeSousLaDerniereRangee(style)).toBe(0);
    });

    test('avec pied : 16 au-dessus du pied, comme une feuille defilante', () => {
      const style = styleApplique({
        footerComponent: createElement(Text, null, 'PIED'),
        scrollable: false,
      }, 'zone-fixe');

      expect(margeSousLaDerniereRangee(style)).toBe(16);
    });

    test('le `contentContainerStyle` d un appelant arrive', () => {
      const style = styleApplique({
        contentContainerStyle: { gap: 12 },
        scrollable: false,
      }, 'zone-fixe');

      expect(style.gap).toBe(12);
    });
  });

  // Le pied n'a jamais ete touche par le defaut (vue ordinaire, hors
  // bibliotheque) : on le fige pour qu'il ne bouge pas.
  test('le pied garde 12 + zone de securite sous son dernier bouton', () => {
    act(() => {
      arbre = renderer.create(createElement(
        BottomModal,
        {
          close: () => {},
          footerComponent: createElement(Text, null, 'DERNIER-BOUTON'),
          isVisible: true,
          snapPoints: ['60%'],
        },
        createElement(View),
      ));
    });
    const pied = arbre.root.findAll((/** @type {any} */ n) => {
      const enfants = Array.isArray(n.props?.children) ? n.props.children : [n.props?.children];
      return n.type === View && enfants.some((e) => e?.props?.children === 'DERNIER-BOUTON');
    }).pop();

    expect(StyleSheet.flatten(pied.props.style).paddingBottom).toBe(12 + INSET_BAS);
  });
});
