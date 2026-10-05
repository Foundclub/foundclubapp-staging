import { createElement } from 'react';
import { Image, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HeaderBackButton from '../HeaderBackButton';

// COLL-C4A3 (03/10/2026) — LE BOUTON D'EN-TÊTE, décrit AVANT qu'on y touche (CLAUDE.md E6 : il
// n'avait aucun témoin, et une vingtaine de fichiers s'en servent).
//
// Ce qu'il fait aujourd'hui, et qui ne doit pas changer pour eux :
//   · une flèche (`Images.arrowLeft`), dans un rond cerclé ;
//   · le libellé « Retour » pour le lecteur d'écran, sauf libellé donné ;
//   · un appui revient en arrière, sauf `onPress` donné.
// Ce que COLL-C4A3 y ajoute (planche 18, « Nouvelle actualité ») : `iconName="close"`, une CROIX
// à la place de la flèche, pour un écran qu'on ANNULE plutôt qu'on ne quitte.

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle) => ({ 'common.back': 'Retour' }[cle] || cle),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: genererStyles(couleurs),
      Images: { arrowLeft: 'image-fleche', close: 'image-croix' },
      Spaces: espaces,
    }),
  };
});

/** @type {any} */
let arbre;

/**
 * Monte le bouton.
 * @param {Record<string, any>} [props] - Les props du bouton.
 * @returns {any} Le bouton (le TouchableOpacity) et son image.
 */
const monter = (props = {}) => {
  act(() => { arbre = renderer.create(createElement(HeaderBackButton, props)); });
  return {
    bouton: arbre.root.findByType(TouchableOpacity),
    image: arbre.root.findByType(Image),
  };
};

afterEach(() => {
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
  mockGoBack.mockClear();
});

// 🎨 FINITIONS15 point 9c — dessinée DANS le bouton de react-navigation (`headerBackImage`), la
// flèche est décorative : un seul « Retour » au relevé d'accessibilité. L'appui marche toujours.
// ROUGE avant le lot.
describe('FINITIONS15 point 9c — la flèche décorative', () => {
  it('ni libellé, ni rôle, hors de l arbre d accessibilité ; l appui revient en arrière', () => {
    const { bouton } = monter({ decorative: true });
    expect(bouton.props.accessible).toBe(false);
    expect(bouton.props.accessibilityLabel).toBeUndefined();
    expect(bouton.props.accessibilityRole).toBeUndefined();
    expect(bouton.props.importantForAccessibility).toBe('no-hide-descendants');
    act(() => { bouton.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('HeaderBackButton — ce qu il fait aujourd hui (caracterisation)', () => {
  it('une fleche, le libelle « Retour », et un appui revient en arriere', () => {
    const { bouton, image } = monter();
    expect(image.props.source).toBe('image-fleche');
    expect(bouton.props.accessibilityLabel).toBe('Retour');
    expect(bouton.props.accessibilityRole).toBe('button');
    act(() => { bouton.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('un libelle et un appui donnes remplacent les siens', () => {
    const appui = jest.fn();
    const { bouton } = monter({ accessibilityLabel: 'Retour au programme', onPress: appui });
    expect(bouton.props.accessibilityLabel).toBe('Retour au programme');
    act(() => { bouton.props.onPress(); });
    expect(appui).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('HeaderBackButton — COLL-C4A3 : la croix d un ecran qu on annule', () => {
  it('iconName="close" montre la croix ; le reste ne change pas', () => {
    const { bouton, image } = monter({ accessibilityLabel: 'Annuler', iconName: 'close' });
    expect(image.props.source).toBe('image-croix');
    expect(bouton.props.accessibilityLabel).toBe('Annuler');
    act(() => { bouton.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('un nom inconnu retombe sur la fleche, jamais sur une image vide', () => {
    expect(monter({ iconName: 'inconnue' }).image.props.source).toBe('image-fleche');
  });
});
