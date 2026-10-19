import { createElement, createRef } from 'react';
import { Platform, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Input from '../Input';

// Le vrai BottomSheetTextInput installe est execute ; seules ses frontieres natives
// sont doublees. Ce temoin prouve le target/focus, jamais une position a l'ecran.
const mockKeyboardState = {
  get: () => mockKeyboardState.value,
  set: (update) => { mockKeyboardState.value = update(mockKeyboardState.value); },
  value: {},
};
const mockNodes = { current: new Set() };
let mockFocusedInput = null;

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  const NativeInput = React.forwardRef((props, ref) => React.createElement(
    'NativeTextInput',
    { ...props, ref },
  ));
  NativeInput.State = { currentlyFocusedInput: () => mockFocusedInput };
  return Object.create(RN, { TextInput: { value: NativeInput } });
});
jest.mock('react-native-gesture-handler', () => ({
  TextInput: jest.requireMock('react-native').TextInput,
}));
jest.mock('@gorhom/bottom-sheet/lib/commonjs/hooks', () => ({
  useBottomSheetInternal: () => ({
    animatedKeyboardState: mockKeyboardState,
    textInputNodesRef: mockNodes,
  }),
}));
jest.mock('@gorhom/bottom-sheet/lib/commonjs/utilities', () => ({
  findNodeHandle: (node) => node?.tag,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetTextInput: jest.requireActual(
    '@gorhom/bottom-sheet/lib/commonjs/components/bottomSheetTextInput/BottomSheetTextInput',
  ).default,
}));
// Jest utilise normalement la plateforme iOS. Ce fichier choisit explicitement
// la resolution Android, sans changer le resolver ni la configuration des suites.
jest.mock('@/components/atoms/bottomModalTextInput/BottomModalTextInput', () => ({
  __esModule: true,
  default: jest.requireActual(
    '@/components/atoms/bottomModalTextInput/BottomModalTextInput.android',
  ).default,
}));
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: jest.requireActual('@/theme/fonts').default(Colors),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const monter = (props = {}) => {
  const ref = createRef();
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(Input, { ...props, ref }), {
      createNodeMock: () => ({ blur: jest.fn(), focus: jest.fn(), tag: 42 }),
    });
  });
  return { arbre, champ: arbre.root.findByType('NativeTextInput'), ref };
};

beforeEach(() => {
  mockKeyboardState.value = { height: 0, target: undefined };
  mockNodes.current = new Set();
  mockFocusedInput = null;
});

describe('Input — contrat existant hors feuille', () => {
  it('iOS et web resolvent toujours le TextInput RN sans contexte Gorhom', () => {
    const fallback = jest.requireActual(
      '@/components/atoms/bottomModalTextInput/BottomModalTextInput.js',
    ).default;
    expect(fallback).toBe(TextInput);
  });

  it('garde le TextInput RN, sa ref, la saisie et les evenements', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const onEndEditing = jest.fn();
    const onChangeText = jest.fn();
    const { arbre, champ, ref } = monter({
      accessibilityLabel: 'Email',
      keyboardType: 'email-address',
      onBlur,
      onChangeText,
      onEndEditing,
      onFocus,
      value: 'a@b.fr',
    });
    const event = { nativeEvent: { target: 42, text: 'c@b.fr' } };
    act(() => champ.props.onFocus(event));
    act(() => champ.props.onChangeText('c@b.fr'));
    act(() => champ.props.onBlur(event));
    act(() => champ.props.onEndEditing(event));
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);
    expect(ref.current.focus).toEqual(expect.any(Function));
    expect(champ.props.accessibilityLabel).toBe('Email');
    expect(champ.props.keyboardType).toBe('email-address');
    expect(champ.props.value).toBe('a@b.fr');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('c@b.fr');
    expect(onBlur).toHaveBeenCalledWith(event);
    expect(onEndEditing).toHaveBeenCalledWith(event);
    expect(mockKeyboardState.get().target).toBeUndefined();
    expect(mockNodes.current.size).toBe(0);
  });
});

describe('Input — enregistrement Gorhom demande seulement dans une feuille Android', () => {
  it.each([34, 35, 36])('API %s : le focus renseigne le target et le blur le retire', (api) => {
    const previousOS = Platform.OS;
    const previousVersion = Platform.Version;
    Platform.OS = 'android';
    Platform.Version = api;
    try {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      const { champ, ref } = monter({ onBlur, onFocus, useBottomSheetInput: true });
      const event = { nativeEvent: { target: 42 } };
      act(() => champ.props.onFocus(event));
      expect(mockKeyboardState.get().target).toBe(42);
      expect(mockNodes.current.has(42)).toBe(true);
      expect(ref.current.focus).toEqual(expect.any(Function));
      expect(onFocus).toHaveBeenCalledTimes(1);
      act(() => champ.props.onBlur(event));
      expect(mockKeyboardState.get().target).toBeUndefined();
      expect(onBlur).toHaveBeenCalledWith(event);
    } finally {
      Platform.OS = previousOS;
      Platform.Version = previousVersion;
    }
  });

  it('le blur precedent ne vole pas le target du champ suivant de la feuille', () => {
    const { champ } = monter({ useBottomSheetInput: true });
    act(() => champ.props.onFocus({ nativeEvent: { target: 42 } }));
    mockNodes.current.add(43);
    mockFocusedInput = { tag: 43 };
    act(() => champ.props.onBlur({ nativeEvent: { target: 42 } }));
    expect(mockKeyboardState.get().target).toBe(42);
    act(() => champ.props.onFocus({ nativeEvent: { target: 43 } }));
    act(() => champ.props.onBlur({ nativeEvent: { target: 42 } }));
    expect(mockKeyboardState.get().target).toBe(43);
  });
});
