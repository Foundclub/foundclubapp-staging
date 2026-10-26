import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ChatAttachmentSheet from '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet';

import BottomModal from '../BottomModal';

// RECETTEWEB retour 5 (26/10, capture d'Adel, iPhone 2.6.80) — LA FEUILLE « AJOUTER » DE LA
// MESSAGERIE MONTE A 70 % DE L'ECRAN, avec un grand vide sous ses deux rangees d'icones.
//
// Les 70 % fixes venaient d'IPH09 (09/10) : en hauteur automatique, la derniere rangee sortait de
// l'ecran. LA CAUSE, lue dans `@gorhom/bottom-sheet` 5.2.4 : en dimensionnement dynamique, la
// feuille prend la hauteur de la zone qu'il MESURE — le contenu de `BottomSheetScrollView`
// (`onContentSizeChange` -> `contentHeight`) ou la vue de `BottomSheetView` (`onLayout`). L'en-tete
// (« Ajouter », son sous-titre) etait pose AU-DESSUS de cette zone : jamais compte, il poussait la
// derniere rangee sous le bord.
//
// Ce temoin tient la regle : SANS snapPoints, tout ce que la feuille montre est dans la zone
// mesuree, donc la feuille a la hauteur de son contenu (7 ou 8 choix) ; AVEC snapPoints, l'en-tete
// reste fixe au-dessus, comme avant.
// ⚠️ Jest n'a pas de moteur de mise en page : la hauteur se constate sur l'iPhone et l'emulateur.

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

// Le VRAI theme, sans le contexte React qui le porte (jamais un Proxy).
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentActionIcon', () => () => null);

// La bibliotheque doublee : la feuille garde ses reglages de taille, et les deux zones que la
// bibliotheque mesure portent la marque `zone-mesuree`.
jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const zone = (/** @type {any} */ props) => reactActuel.createElement(
    VueRN,
    { style: props.style, testID: 'zone-mesuree' },
    props.children,
  );
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, {
          enableDynamicSizing: props.enableDynamicSizing,
          snapPoints: props.snapPoints,
          testID: 'feuille',
        }, props.children);
      },
    ),
    BottomSheetScrollView: zone,
    BottomSheetView: zone,
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
  };
});

const CHOIX = ['photos', 'camera', 'document', 'poll', 'event', 'location', 'contact'];

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

/**
 * Monte la feuille « Ajouter » comme Conversation.js la monte.
 * @param {object} params
 * @param {number} params.nombre Nombre de choix (7, ou 8 avec Convocation).
 * @param {(string|number)[]} [params.snapPoints] Points d'arret, s'il y en a.
 * @param {boolean} [params.scrollable] Zone qui defile (defaut : oui).
 * @returns {any} L'arbre de test.
 */
const monterAjouter = ({ nombre, scrollable, snapPoints }) => {
  const actions = [...CHOIX, 'convocation'].slice(0, nombre)
    .map((cle) => ({ key: cle, label: `choix-${cle}` }));
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      {
        close: () => {},
        contentContainerStyle: { gap: 16, paddingBottom: 56 },
        headerComponent: createElement(
          View,
          null,
          createElement(Text, null, 'Ajouter'),
          createElement(Text, null, 'Partage du contenu dans cette conversation'),
        ),
        hideCloseButton: true,
        isVisible: true,
        keyboardBehavior: 'interactive',
        onDismissed: () => {},
        scrollable,
        snapPoints,
      },
      createElement(ChatAttachmentSheet, { actions, onActionPress: () => {} }),
    ));
  });
  return arbre;
};

/**
 * Les textes rendus HORS de la zone que la bibliotheque mesure.
 * @param {any} racine L'arbre de test.
 * @returns {string[]} Ces textes.
 */
const textesHorsMesure = (racine) => {
  const zones = racine.root.findAllByProps({ testID: 'zone-mesuree' })
    .filter((/** @type {any} */ noeud) => typeof noeud.type === 'string');
  const dansUneZone = (/** @type {any} */ noeud) => {
    for (let n = noeud; n; n = n.parent) if (zones.includes(n)) return true;
    return false;
  };
  return racine.root.findAllByType(Text)
    .filter((/** @type {any} */ texte) => !dansUneZone(texte))
    .map((/** @type {any} */ texte) => String(texte.props.children));
};

describe.each([7, 8])('RECETTEWEB retour 5 — « Ajouter », %i choix, sans snapPoints', (nombre) => {
  test('la feuille se dimensionne sur son contenu', () => {
    const racine = monterAjouter({ nombre });
    const feuille = racine.root.findAllByProps({ testID: 'feuille' }).pop();

    expect(feuille.props.snapPoints).toBeUndefined();
    expect(feuille.props.enableDynamicSizing).toBe(true);
  });

  test('le titre et le sous-titre sont dans la zone mesuree : rien n est hors du compte', () => {
    const racine = monterAjouter({ nombre });

    expect(textesHorsMesure(racine)).toEqual([]);
    expect(racine.root.findAllByType(Text).map((/** @type {any} */ t) => t.props.children))
      .toEqual(expect.arrayContaining(['Ajouter', `choix-${CHOIX[0]}`]));
  });

  test('l ecart entre le titre et les icones reste 16 (le gap du contenu compte)', () => {
    const racine = monterAjouter({ nombre });
    const titre = racine.root.findAllByType(Text)
      .find((/** @type {any} */ t) => t.props.children === 'Ajouter');
    // La vue qui porte l'en-tete dans la zone mesuree : grand-parent hote du titre.
    let porteur = titre.parent;
    const estLePorteur = (/** @type {any} */ n) => n.type === 'View'
      && StyleSheet.flatten(n.props.style)?.paddingTop === 24;
    while (porteur && !estLePorteur(porteur)) {
      porteur = porteur.parent;
    }

    expect(porteur).toBeTruthy();
    expect(StyleSheet.flatten(porteur.props.style).paddingBottom).toBe(0);
  });
});

describe('RECETTEWEB retour 5 — ce qui NE change PAS', () => {
  test('avec des snapPoints, l en-tete reste fixe au-dessus de la zone qui defile', () => {
    const racine = monterAjouter({ nombre: 7, snapPoints: ['70%'] });

    expect(textesHorsMesure(racine))
      .toEqual(['Ajouter', 'Partage du contenu dans cette conversation']);
  });

  test('sans defilement ni snapPoints, l en-tete est aussi compte', () => {
    const racine = monterAjouter({ nombre: 7, scrollable: false });

    expect(textesHorsMesure(racine)).toEqual([]);
  });
});
