import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// GUIDES-SITE-CORR S18, S17 (tournée du site, 09/11, D 1360 rangs 087-091) : sur ordinateur,
// `/messages` montre la colonne de `Conversation.web.js`, qui ne porte aucune ancre du guide. Au
// bonus 3, la bulle recouvrait « Nouvelle discussion » (aucun cadre à éviter) ; au bonus 2, le
// canal n'était jamais montré. Pendant une étape du guide sur la liste, la page du téléphone (ses
// ancres, ses « Exemple ») revient ; hors du guide, la colonne de l'ordinateur reste.
// Puis le canal d'exemple : le fil du site l'ouvrait comme un vrai fil, sans ancre.

let mockTour = /** @type {any} */ ({});
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: 1360,
  }),
}));
jest.mock('@/views/Conversation.web', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return { MessagesDuSite: () => <Texte>colonne de l ordinateur</Texte> };
});
jest.mock('@/views/Messaging.js', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Texte>page du telephone</Texte> };
});

// eslint-disable-next-line import/first
import Messaging from '../Messaging.web';

const rendu = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<Messaging navigation={{}} route={{ params: {} }} />);
  });
  const texte = arbre.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children)
    .join(' ');
  act(() => { arbre.unmount(); });
  return texte;
};

afterEach(() => { mockTour = {}; });

test('hors du guide, l ordinateur garde sa colonne', () => {
  expect(rendu()).toBe('colonne de l ordinateur');
});

test('bonus 3, « Nouvelle discussion » : la page aux ancres du guide', () => {
  mockTour = { currentStep: { id: 'b3-new', targets: ['msg-new'] }, tourStatus: 'active' };
  expect(rendu()).toBe('page du telephone');
});

test('bonus 2, le canal : la page aux ancres du guide', () => {
  mockTour = { currentStep: { id: 'b2-canal', targets: ['msg-canal'] }, tourStatus: 'active' };
  expect(rendu()).toBe('page du telephone');
});

test('guide en pause : la colonne de l ordinateur', () => {
  mockTour = { currentStep: { id: 'b3-new', targets: ['msg-new'] }, tourStatus: 'paused' };
  expect(rendu()).toBe('colonne de l ordinateur');
});
