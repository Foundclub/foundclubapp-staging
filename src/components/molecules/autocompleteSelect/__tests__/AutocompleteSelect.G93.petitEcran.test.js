import { Dimensions, Keyboard } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteSelect from '../AutocompleteSelect';

// G93 (recette r3, a20-a21) : feuille d'adresse à 360×640, clavier ouvert. Titre et pied sont
// fixes : il ne restait que 11 px au champ et aux résultats, on tapait à l'aveugle.

const OPTIONS = [{ label: 'Lyon', value: 'lyon' }, { label: 'Lille', value: 'lille' }];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (cle, repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('../../bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function BottomModalMock(props) {
    if (!props.isVisible) return null;
    return reactActuel.createElement(
      VueRN,
      { testID: 'feuille-ouverte' },
      props.children,
      props.footerComponent
        ? reactActuel.createElement(VueRN, { testID: 'pied' }, props.footerComponent)
        : null,
    );
  };
});
jest.mock('@/components/atoms/checkable/Checkable', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function CheckableMock(props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.setIsChecked, testID: `option-${props.text}` },
      reactActuel.createElement(TexteRN, null, props.text),
    );
  };
});

let listeners;
let windowSpy;
const setWindow = (height) => {
  windowSpy.mockReturnValue({
    fontScale: 1, height, scale: 2, width: 360,
  });
};
const openKeyboard = (height) => act(async () => {
  const event = { endCoordinates: { height } };
  listeners.keyboardWillShow?.(event);
  listeners.keyboardDidShow?.(event);
});
const closeKeyboard = () => act(async () => {
  listeners.keyboardWillHide?.();
  listeners.keyboardDidHide?.();
});
const mountOpen = async (isSearchable = true) => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <AutocompleteSelect
        isSearchable={isSearchable}
        label="Ville"
        onChange={jest.fn()}
        options={OPTIONS}
      />,
    );
  });
  const opener = tree.root.findAll((node) => typeof node.props.onPress === 'function')[0];
  await act(async () => { opener.props.onPress(); });
  return tree;
};
const hasFooter = (tree) => tree.root.findAll((node) => node.props.testID === 'pied').length > 0;

beforeEach(() => {
  listeners = {};
  windowSpy = jest.spyOn(Dimensions, 'get');
  setWindow(640);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, handler) => {
    listeners[name] = handler;
    return { remove: () => { delete listeners[name]; } };
  });
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('feuille cherchable, clavier ouvert', () => {
  it('360×640 : le pied laisse sa place au champ et aux résultats, et revient', async () => {
    const tree = await mountOpen();
    expect(hasFooter(tree)).toBe(true);
    await openKeyboard(290);
    expect(hasFooter(tree)).toBe(false);
    await closeKeyboard();
    expect(hasFooter(tree)).toBe(true);
  });

  it('360×640 : choisir un résultat replie le clavier, donc rend « Sélectionner »', async () => {
    const tree = await mountOpen();
    await openKeyboard(290);
    const option = tree.root.findAll((node) => node.props.testID === 'option-Lyon'
      && typeof node.props.onPress === 'function')[0];
    await act(async () => { option.props.onPress(); });
    expect(Keyboard.dismiss).toHaveBeenCalled();
  });

  it('témoin : grand écran, le pied reste', async () => {
    setWindow(924);
    const tree = await mountOpen();
    await openKeyboard(300);
    expect(hasFooter(tree)).toBe(true);
  });

  it('témoin : liste sans recherche, le pied reste', async () => {
    const tree = await mountOpen(false);
    await openKeyboard(290);
    expect(hasFooter(tree)).toBe(true);
  });
});
