import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ApercuDImage from '../ApercuDImage';

// IMGNOIR — L'IMAGE OUVERTE EN GRAND RESTAIT NOIRE (constat d'Adel, iPhone, TestFlight
// 2.6.80, 26/10/2026 17:38) : croix et « Enregistrer » visibles, l'image absente.
//
// Cause : la racine de la fenetre CENTRE ses enfants (`alignItems: 'center'`). Le conteneur
// glissant (MSGIMG 2/4) n'a pas de largeur : centre, il prend la largeur de son contenu.
// Son contenu est l'image, a `width: '100%'`… de ce conteneur. Le moteur de mise en page
// (Yoga 3.2, errata All comme React Native 0.81, ou None) resout ce cercle a 0 :
//   conteneur 0 x 852, image 0 x 766 sur un ecran 393 x 852.
// Avec `alignSelf: 'stretch'` sur le conteneur : conteneur 393 x 852, image 393 x 766.
// Ce temoin verifie la regle qui evite le cercle, sans moteur de mise en page sous Jest.

jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/platform/media/enregistrerLImage', () => ({
  ECHECS_D_ENREGISTREMENT: {},
  enregistrerLImage: jest.fn(),
}));

const URI = 'https://foundclub.app/uploads/capture_mail.png';

/**
 * Le style aplati d'un noeud rendu.
 * @param {any} noeud Le noeud de l'arbre de test.
 * @returns {any} Son style aplati.
 */
const styleDe = (noeud) => StyleSheet.flatten(noeud.props.style) || {};

/**
 * Le noeud natif qui contient celui-ci. La vue 'gesture-detector' n'existe que dans la
 * doublure : le vrai GestureDetector n'en pose pas.
 * @param {any} noeud Le noeud de l'arbre de test.
 * @returns {any} Son parent natif.
 */
const parentNatif = (noeud) => {
  let { parent } = noeud;
  const estDoublure = (/** @type {any} */ n) => n.props.testID === 'gesture-detector';
  while (parent && (typeof parent.type !== 'string' || estDoublure(parent))) {
    ({ parent } = parent);
  }
  return parent;
};

test('IMGNOIR — le conteneur de l image s etire sur toute la largeur de l ecran', () => {
  let arbre;
  act(() => {
    arbre = renderer.create(<ApercuDImage onClose={() => {}} uri={URI} visible />);
  });
  const racine = /** @type {any} */ (arbre).root;

  const glissante = racine.find((/** @type {any} */ n) => (
    n.props.testID === 'MSGIMG-image-glissante' && typeof n.type === 'string'
  ));
  const image = glissante.find((/** @type {any} */ n) => (
    n.props.source?.uri === URI && typeof n.type === 'string'
  ));
  // Le parent natif du conteneur : la racine de la fenetre (GestureHandlerRootView).
  const parent = parentNatif(glissante);
  expect(parent.props.testID).toBeUndefined();

  const styleParent = styleDe(parent);
  const styleConteneur = styleDe(glissante);

  // L'image se dimensionne en pourcentage de son conteneur : il lui faut une vraie largeur.
  expect(String(styleDe(image).width)).toMatch(/%$/);
  const alignement = styleConteneur.alignSelf ?? styleParent.alignItems ?? 'stretch';
  const largeurConnue = alignement === 'stretch' || styleConteneur.width !== undefined;
  expect({ alignement, largeurConnue }).toEqual({ alignement: 'stretch', largeurConnue: true });
  // Et une vraie hauteur : il pousse dans la fenetre (flex 1).
  expect(styleConteneur.flex).toBe(1);
});
