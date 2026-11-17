import renderer, { act } from 'react-test-renderer';

// T-FINITIONS-3 (16/11, chef d'orchestre) — la fenêtre d'arrivée d'un lien d'équipe désactive
// « Rejoindre l'équipe » quand l'action est impossible : `primaryAction.disabled` descend jusqu'au
// bouton. Sans lui, rien ne change.

const mockBoutons = [];
jest.mock('@/components/atoms/button/Button', () => (/** @type {any} */ props) => {
  mockBoutons.push(props);
  return null;
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: generateFonts(Colors), Spaces }),
  };
});

// eslint-disable-next-line import/first
import GlobalPromptModal from '../GlobalPromptModal';

const monter = (/** @type {any} */ primaryAction) => {
  mockBoutons.length = 0;
  let arbre;
  act(() => {
    arbre = renderer.create(
      <GlobalPromptModal
        body="Corps"
        primaryAction={primaryAction}
        secondaryAction={{ label: 'Plus tard', onPress: jest.fn() }}
        title="Titre"
        visible
      />,
    );
  });
  return arbre;
};

test('🔴 T-F3 — primaryAction.disabled : le bouton principal est désactivé', () => {
  monter({ disabled: true, label: 'Rejoindre l’équipe', onPress: jest.fn() });
  const principal = mockBoutons.find((props) => props.title === 'Rejoindre l’équipe');
  expect(principal.disabled).toBe(true);
});

test('T-F3 caractérisant — sans disabled, les deux boutons restent actifs', () => {
  monter({ label: 'Rejoindre l’équipe', onPress: jest.fn() });
  expect(mockBoutons.find((props) => props.title === 'Rejoindre l’équipe').disabled).toBeFalsy();
  expect(mockBoutons.find((props) => props.title === 'Plus tard').disabled).toBeFalsy();
});
