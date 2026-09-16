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
