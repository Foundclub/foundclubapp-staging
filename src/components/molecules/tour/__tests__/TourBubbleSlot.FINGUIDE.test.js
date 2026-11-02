import { Keyboard, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourBubbleSlot, { TOUR_BUBBLE_SLOT_HEIGHT } from '../TourBubbleSlot';

// FIN-GUIDE, point 3 (capture 3 d'Adel) : clavier ouvert, les 112 pt de la place réservée
// repoussaient le champ sous le bord de la liste. Le voile interdisant de défiler ailleurs que
// dans la fente, le champ restait coupé : la place s'efface et le champ remonte tout seul.

let mockTour;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/components/molecules/tour/TourTarget', () => ({
  __esModule: true, default: ({ children }) => children,
}));

const slotHeight = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubbleSlot'
  && typeof node.type === 'string')[0]?.props.style.height;

let listeners;
let addListener;
let focused;
const scrollTo = jest.fn();
const innerView = {};
const scrollRef = { current: { getInnerViewRef: () => innerView, scrollTo } };

const mount = () => {
  let tree;
  act(() => { tree = renderer.create(<TourBubbleSlot scrollRef={scrollRef} />); });
  return tree;
};
const open = () => act(() => {
  const event = { endCoordinates: { height: 336, screenY: 516 } };
  listeners.keyboardWillShow?.(event);
  listeners.keyboardDidShow?.(event);
});

beforeEach(() => {
  jest.useFakeTimers();
  scrollTo.mockClear();
  listeners = {};
  addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, handler) => {
    listeners[name] = handler;
    return { remove: () => { delete listeners[name]; } };
  });
  focused = {
    measureLayout: jest.fn((relativeTo, onDone) => onDone(0, 306, 361, 44)),
  };
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focused);
  mockTour = { currentStep: { bubbleSlot: true }, isGuide: true, tourStatus: 'active' };
});

afterEach(() => {
  addListener.mockRestore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('TourBubbleSlot et le clavier', () => {
  it('clavier fermé : la place est gardée', () => {
    expect(slotHeight(mount())).toBe(TOUR_BUBBLE_SLOT_HEIGHT);
  });

  it('clavier ouvert : la place s’efface', () => {
    const tree = mount();
    open();
    expect(slotHeight(tree)).toBe(0);
  });

  it('clavier ouvert : le champ actif remonte sous la bulle compacte', () => {
    mount();
    open();
    act(() => { jest.runOnlyPendingTimers(); });
    expect(focused.measureLayout).toHaveBeenCalledWith(
      innerView,
      expect.any(Function),
      expect.any(Function),
    );
    expect(scrollTo).toHaveBeenCalled();
    const { y } = scrollTo.mock.calls[0][0];
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(306);
  });

  it('écran trop petit pour la bulle : le champ remonte tout en haut de la liste', () => {
    mount();
    act(() => {
      const event = { endCoordinates: { height: 285, screenY: 202 } };
      listeners.keyboardWillShow?.(event);
      listeners.keyboardDidShow?.(event);
    });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(scrollTo.mock.calls[0][0].y).toBe(306 - 32);
  });

  it('champ tout en haut de la liste : jamais de défilement négatif', () => {
    focused.measureLayout = jest.fn((relativeTo, onDone) => onDone(0, 10, 361, 44));
    mount();
    open();
    act(() => { jest.runOnlyPendingTimers(); });
    expect(scrollTo.mock.calls[0][0].y).toBe(0);
  });

  it('hors du guide : rien ne bouge', () => {
    mockTour = { currentStep: null, isGuide: false, tourStatus: null };
    const tree = mount();
    open();
    act(() => { jest.runOnlyPendingTimers(); });
    expect(tree.toJSON()).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
