import { createElement } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainerInvitedModal from '../TrainerInvitedModal';

// Lot FEUILLES-COUPEES (15/09) — la feuille « Entraîneur ajouté », qui s'ouvre
// après la création d'un entraîneur (AddCoach.js), porte les DEUX seules actions
// de l'écran : « Inviter » et « Plus tard ».
//
// 🧨 LE PIÈGE (mémoire du projet, BottomModal) : sans `snapPoints`, la
// bibliothèque taille la feuille sur la zone défilante SEULE. Un pied
// (`footerComponent`) est posé à côté, hors mesure : la feuille est plus courte
// que ce qu'elle affiche de toute la hauteur du pied, et ce surplus sort par le
// bas de l'écran — ici, les deux boutons entiers.
//
// Ce fichier monte le VRAI BottomModal : seule la feuille native est doublée,
// par des vues qui gardent leurs props. ⚠️ Jest ne mesure aucun pixel : il lit
// OÙ vivent les boutons dans l'arbre. La preuve à l'écran se fait à l'émulateur.

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
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
    // La zone que la bibliothèque MESURE pour tailler la feuille.
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-mesuree' },
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-mesuree' },
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

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: ToucheRN } = jest.requireActual('react-native');

  return function BoutonDouble(/** @type {any} */ props) {
    return reactActuel.createElement(
      ToucheRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const INVITER = 'addCoach.actions.invite';
const PLUS_TARD = 'common.actions.askLater';

/** @type {any} */
let arbre;

/**
 * Monte la feuille ouverte.
 * @param {{ onClose?: jest.Mock, onInvite?: jest.Mock }} [rappels] Les rappels.
 * @returns {any} La racine de l'arbre.
 */
const monterLaFeuille = (rappels = {}) => {
  act(() => {
    arbre = renderer.create(createElement(TrainerInvitedModal, {
      isVisible: true,
      onClose: rappels.onClose || jest.fn(),
      onInvite: rappels.onInvite || jest.fn(),
      trainerName: 'Karim',
    }));
  });
  return arbre.root;
};

/**
 * Le bouton qui porte ce libellé.
 * @param {any} racine Sous-arbre où chercher.
 * @param {string} libelle Libellé du bouton.
 * @returns {any[]} Les boutons trouvés.
 */
const boutons = (racine, libelle) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.type === TouchableOpacity
    && noeud.findAll((/** @type {any} */ n) => n.type === Text && n.props.children === libelle)
      .length > 0,
);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('TrainerInvitedModal — ce qu elle fait (caractérisation, verte avant et après)', () => {
  test('elle dit que l entraîneur est ajouté, et le nomme', () => {
    const racine = monterLaFeuille();
    const textes = racine.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);

    expect(textes).toContain('addCoach.alerts.success.title');
    expect(textes).toContain('addCoach.alerts.success.description');
  });

  test('« Inviter » appelle onInvite, « Plus tard » appelle onClose', () => {
    const onInvite = jest.fn();
    const onClose = jest.fn();
    const racine = monterLaFeuille({ onClose, onInvite });

    act(() => boutons(racine, INVITER)[0].props.onPress());
    expect(onInvite).toHaveBeenCalledTimes(1);

    act(() => boutons(racine, PLUS_TARD)[0].props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('FEUILLES — ses deux boutons sont dans la hauteur de la feuille', () => {
  test('🔴 F1 — « Inviter » et « Plus tard » vivent DANS la zone mesurée', () => {
    const racine = monterLaFeuille();
    const feuille = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille')[0];
    const zoneMesuree = racine.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'zone-mesuree',
    )[0];

    // Sans `snapPoints`, seule la zone mesurée compte dans la hauteur de la
    // feuille : un bouton rangé ailleurs (pied) sort de l'écran.
    expect(feuille.props.snapPoints).toBeUndefined();
    expect(boutons(zoneMesuree, INVITER)).toHaveLength(1);
    expect(boutons(zoneMesuree, PLUS_TARD)).toHaveLength(1);
  });

  test('🔴 F2 — la feuille ne déclare ni pied ni en-tête hors mesure', () => {
    const racine = monterLaFeuille();
    const modale = racine.findAll(
      (/** @type {any} */ n) => typeof n.type === 'function' && n.type.name === 'BottomModal',
    )[0];

    expect(modale.props.footerComponent).toBeUndefined();
    expect('headerComponent' in modale.props).toBe(false);
  });
});

// RETOUCHES-DESIGN D4 (28/10, Adel sur iPhone) — le texte de la feuille était
// NOIR sur le fond sombre (`Fonts.p1` porte `color: 'black'`, la feuille est
// `primary700`) : 1,69:1. Et le bas tombait trop bas : la zone défilante
// ajoutait 40 + la barre de gestes sous « Plus tard », pour 20 au-dessus du titre.
describe('RETOUCHES-DESIGN D4 — lisible, et le bas équilibré', () => {
  const { StyleSheet } = jest.requireActual('react-native');
  const couleurs = jest.requireActual('@/theme/colors').default();

  /**
   * Luminance relative WCAG d'une couleur #rrggbb.
   * @param {string} hex La couleur.
   * @returns {number} La luminance.
   */
  const luminance = (hex) => {
    const [r, v, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * v + 0.0722 * b;
  };
  // Couleurs nommées (`Fonts.*` porte `'black'`) : leur luminance, sans hex (contrat de thème).
  const LUMINANCES_NOMMEES = { black: 0, white: 1 };
  /**
   * Contraste WCAG entre deux couleurs.
   * @param {string} a Couleur.
   * @param {string} b Couleur.
   * @returns {number} Le rapport.
   */
  const contraste = (a, b) => {
    const [x, y] = [a, b]
      .map((c) => (c in LUMINANCES_NOMMEES ? LUMINANCES_NOMMEES[c] : luminance(c)));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  test('🔴 D4-1 — chaque texte de la feuille se lit sur son fond (≥ 4,5:1)', () => {
    const racine = monterLaFeuille();
    const textes = racine.findAllByType(Text)
      .filter((/** @type {any} */ n) => typeof n.props.children === 'string')
      .filter((/** @type {any} */ n) => n.props.children.startsWith('addCoach.alerts'));

    expect(textes).toHaveLength(2);
    textes.forEach((/** @type {any} */ n) => {
      const { color } = StyleSheet.flatten(n.props.style);
      expect({ cle: n.props.children, ratio: contraste(color, couleurs.primary700) >= 4.5 })
        .toEqual({ cle: n.props.children, ratio: true });
    });
  });

  test('🔴 D4-2 — sous « Plus tard », la même marge qu au-dessus du titre, plus la barre de gestes', () => {
    const racine = monterLaFeuille();
    const zones = racine.findAll((/** @type {any} */ n) => n.props?.testID === 'zone-mesuree');
    const zone = zones[zones.length - 1];
    const styleZone = StyleSheet.flatten(zone.props.contentContainerStyle || zone.props.style);

    // La zone ne réserve que la barre de gestes (34 au banc) ; la marge est posée
    // par le contenu, d'un seul bloc, la même en haut et en bas.
    expect(styleZone.paddingBottom).toBe(34);
    expect(zone.children).toHaveLength(1);
    const styleContenu = StyleSheet.flatten(zone.children[0].props.style);
    const enHaut = (styleZone.paddingTop || 0) + (styleContenu.paddingTop || 0);
    expect({ enBas: styleContenu.paddingBottom, enHaut }).toEqual({ enBas: 24, enHaut: 24 });
  });
});
