import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import useBottomDockLayout from '../useBottomDockLayout';

let mockPlatform = 'web';
jest.mock('react-native', () => ({
  Platform: { get OS() { return mockPlatform; } },
  Text: 'Text',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionBottomOffset: () => 146,
  getFloatingTabBarMetrics: () => ({ clearance: 98 }),
  getFloatingTabBarScenePaddingBottom: () => 144,
}));

/**
 * Expose les métriques rendues après les effets du hook.
 * @returns {import('react').ReactElement} Mesures sérialisées.
 */
function Probe() {
  return <Text>{JSON.stringify(useBottomDockLayout())}</Text>;
}

const contexte = /** @type {any} */ (global);
const ancienWindow = contexte.window;
const ancienDocument = contexte.document;
/** @type {any} */
let arbre;

const lire = (padding = '92px', coquePresente = true, contratPresent = true) => {
  contexte.document = { querySelector: () => (coquePresente ? {} : null) };
  contexte.window = {
    addEventListener: jest.fn(),
    getComputedStyle: () => ({
      getPropertyValue: () => (contratPresent ? padding : ''), paddingBottom: padding,
    }),
    removeEventListener: jest.fn(),
  };
  act(() => { arbre = renderer.create(<Probe />); });
  return JSON.parse(arbre.root.findByType(Text).props.children);
};

afterEach(() => {
  act(() => { arbre?.unmount(); });
  arbre = null;
  contexte.window = ancienWindow;
  contexte.document = ancienDocument;
  mockPlatform = 'web';
});

test('SAISIE : une coque web qui réserve le bas ne réclame pas un deuxième dock', () => {
  expect(lire().dockClearance).toBe(0);
});

test('SAISIE : le menu latéral avec son retrait de 24px ne réclame pas un dock', () => {
  expect(lire('24px').dockClearance).toBe(0);
});

test('hors coque, la réserve web historique reste disponible', () => {
  expect(lire('0px', false).dockClearance).toBe(132);
});

test('une coque sans réserve ne retire pas la protection locale', () => {
  expect(lire('0px').dockClearance).toBe(132);
});

test('une ancienne coque sans le contrat de hauteur garde sa protection locale', () => {
  expect(lire('92px', true, false).dockClearance).toBe(132);
});

test('un redimensionnement relit la réserve et le démontage retire son écouteur', () => {
  expect(lire().dockClearance).toBe(0);
  const callback = contexte.window.addEventListener.mock.calls[0][1];
  contexte.window.getComputedStyle = () => ({
    getPropertyValue: () => '0px', paddingBottom: '0px',
  });
  act(() => { callback(); });
  expect(JSON.parse(arbre.root.findByType(Text).props.children).dockClearance).toBe(132);
  act(() => { arbre.unmount(); });
  arbre = null;
  expect(contexte.window.removeEventListener).toHaveBeenCalledWith('resize', callback);
});

test('le contrat natif, les listes et les actions fixes ne changent pas', () => {
  mockPlatform = 'ios';
  expect(lire()).toMatchObject({
    dockClearance: 98, floatingActionBottomOffset: 146, sceneBottomInset: 144,
  });
});
