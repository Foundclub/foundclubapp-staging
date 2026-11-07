import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import SelectAvatar from '../SelectAvatar';

// GUIDE-D-CORR TG-01 (tournée du 07/11, g05-g07) : « Ton logo : touche-le pour choisir une
// image ». Toucher la grande image (appareil photo) ne faisait rien ; seul le petit « + » ouvrait
// la feuille « Prendre une photo / Choisir depuis la galerie ».

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));

// Le composant passe par `@/platform/media`, l'aiguillage deja en place dans le
// depot. On double la BIBLIOTHEQUE, pas l'aiguillage : le cablage reel est donc
// exerce par le test. `@react-native-documents/picker` est importe par le meme
// module — il doit etre double lui aussi, sinon le chargement echoue.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({ pick: jest.fn() }));

// Y01 — `platform/media` remesure la taille du fichier produit par la capture
// (`getLocalFileSize`). La bibliotheque de systeme de fichiers est doublee : on
// observe ce que le composant FAIT de la taille, pas comment elle est lue.
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fs: { stat: jest.fn() } },
}));

// La feuille du bas est doublee : on n'observe pas l'animation, on observe ce
// que les deux boutons declenchent.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible
      ? reactActuel.createElement(VueRN, { testID: 'feuille' }, props.children)
      : null),
  };
});

// Doublure de Button : un pressable qui PORTE son titre, pour retrouver les
// deux entrees sans dependre de la forme interne de l'atome.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
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
      Images: { camera: 1, plus: 2, trash: 3 },
      Spaces: espaces,
    }),
  };
});


const monter = (props = {}) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(SelectAvatar, {
      currentAvatar: undefined,
      onAvatarSelected: jest.fn(),
      ...props,
    }));
  });
  return arbre;
};
const feuille = (arbre) => arbre.root.findAll((noeud) => noeud.props?.testID === 'feuille');
const zone = (arbre) => arbre.root.findAll((noeud) => noeud.props?.testID === 'selectAvatar.zone'
  && typeof noeud.props?.onPress === 'function')[0];

describe('TG-01 : toute l’image ouvre le choix', () => {
  it('toucher la grande image ouvre la feuille photo / galerie', () => {
    const arbre = monter();
    expect(feuille(arbre)).toHaveLength(0);
    act(() => { zone(arbre).props.onPress(); });
    expect(feuille(arbre).length).toBeGreaterThan(0);
  });

  it('logo déjà là : toucher l’image ouvre aussi le choix', () => {
    const arbre = monter({ currentAvatar: { url: '/uploads/logo.png' }, onDelete: jest.fn() });
    act(() => { zone(arbre).props.onPress(); });
    expect(feuille(arbre).length).toBeGreaterThan(0);
  });

  it('la zone ne cache pas « + » ni la poubelle au lecteur d’écran', () => {
    const arbre = monter({ currentAvatar: { url: '/uploads/logo.png' }, onDelete: jest.fn() });
    expect(zone(arbre).props.accessible).toBe(false);
  });
});
