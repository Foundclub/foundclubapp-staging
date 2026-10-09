import { createElement } from 'react';
import {
  DeviceEventEmitter, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import DecisionCreneauModal from '../components/DecisionCreneauModal';

const mockRefuse = jest.fn();
const mockApprove = jest.fn();
jest.mock('@/services/facility/facilityQueries', () => ({
  useApproveFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: mockApprove }),
  useRefuseFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: mockRefuse }),
}));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const originalOS = Platform.OS;
afterEach(() => {
  act(() => DeviceEventEmitter.emit('keyboardDidHide'));
  Platform.OS = originalOS;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const mount = (/** @type {any} */ extra = {}) => {
  const close = jest.fn();
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(createElement(DecisionCreneauModal, {
      collectiviteId: 'fabricated-town',
      decision: { kind: 'refuse', request: { documentId: 'fabricated-request' } },
      onClose: close,
      ...extra,
    }));
  });
  return { close, root: tree.root, tree };
};

test('FC-007 : la vraie vue iOS retranche les 300pt occupés par le clavier', async () => {
  Platform.OS = 'ios';
  const { root, tree } = mount();
  const avoiding = root.findByType(KeyboardAvoidingView);
  expect(avoiding.props.behavior).toBe('padding');
  await act(async () => {
    // Rejoue la mesure native, puis l'événement reçu par le vrai composant RN.
    root.findByType(TextInput).props.onChangeText('Motif\nDeuxième ligne.');
    // eslint-disable-next-line no-underscore-dangle -- vrai récepteur natif de la mesure.
    await avoiding.instance._onLayout({
      nativeEvent: {
        layout: {
          height: 800, width: 390, x: 0, y: 0,
        },
      },
      persist: () => {},
    });
    DeviceEventEmitter.emit('keyboardWillShow', {
      duration: 0,
      endCoordinates: {
        height: 300, screenX: 0, screenY: 500, width: 390,
      },
    });
  });
  expect(StyleSheet.flatten(avoiding.findAllByType('View')[0].props.style).paddingBottom)
    .toBe(300);
  await act(async () => DeviceEventEmitter.emit('keyboardWillHide', { duration: 0 }));
  expect(StyleSheet.flatten(avoiding.findAllByType('View')[0].props.style).paddingBottom)
    .toBe(0);
  expect(root.findByType(TextInput).props.value).toBe('Motif\nDeuxième ligne.');
  act(() => tree.unmount());
});

test('FC-007 : champ actif multiligne, défilement et Terminer conservent le motif', async () => {
  Platform.OS = 'ios';
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const { close, root, tree } = mount();
  const scroll = root.findByType(ScrollView);
  const scrollToEnd = jest.spyOn(scroll.instance, 'scrollToEnd');
  const input = root.findByType(TextInput);
  expect(input.props.multiline).toBe(true);
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({
    flexShrink: 1, maxHeight: '100%',
  });
  act(() => {
    input.props.onFocus();
    input.props.onChangeText('Fermeture\nTravaux jusqu à lundi.');
    scroll.props.onLayout();
  });
  expect(scrollToEnd).toHaveBeenCalledTimes(2);
  const done = root.findAllByType(Button).find((button) => button.props.title === 'Terminer');
  expect(done).toBeDefined();
  act(() => done.props.onPress());
  expect(dismiss).toHaveBeenCalledTimes(1);
  act(() => input.props.onBlur());
  expect(root.findAllByType(Button).some((button) => button.props.title === 'Terminer'))
    .toBe(false);
  expect(root.findByType(TextInput).props.value).toBe('Fermeture\nTravaux jusqu à lundi.');
  expect(close).not.toHaveBeenCalled();
  expect(mockRefuse).not.toHaveBeenCalled();
  const refuse = scroll.findAllByType(Button)
    .find((button) => button.props.variant === 'Danger');
  await act(async () => refuse.props.onPress());
  expect(mockRefuse).toHaveBeenCalledWith({
    collectiviteId: 'fabricated-town',
    decisionReason: 'Fermeture\nTravaux jusqu à lundi.',
    requestId: 'fabricated-request',
    series: false,
  });
  expect(close).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test.each(['android', 'web'])('FC-007 : %s conserve la saisie sans contrôle iOS', (os) => {
  Platform.OS = /** @type {any} */ (os);
  const { root, tree } = mount();
  expect(root.findByType(KeyboardAvoidingView).props.enabled).toBe(os !== 'web');
  expect(root.findAllByType(Button).some((button) => button.props.title === 'Terminer'))
    .toBe(false);
  act(() => tree.unmount());
});
