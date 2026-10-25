import { InteractionManager } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteSelect from '../AutocompleteSelect';

// C04 Q1-07 (BUGHUNT phase 2, 25/10) — cocher une adresse puis appuyer sur « Ajouter « Stade » »
// (action en tête de feuille) enregistrait QUAND MÊME l'adresse cochée : la feuille, refermée par
// le code, rappelait `close()` sans argument à la fin de son animation (`onDismiss`), et
// `onBlur` partait deux fois. Témoin repris de la chasse (hunt/Q1/prover-18).

const OPTIONS = [
  { label: 'Adresse A', value: 'a' },
  { label: 'Adresse B', value: 'b' },
];
const mockFermeture = { courant: /** @type {any} */ (null) };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ c, /** @type {any} */ r) => (typeof r === 'string' ? r : c),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));
jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'S', STEADY_STATE: 'T' },
  useStartupPhase: () => ({ phase: 'T' }),
}));
jest.mock('@/theme/themeContext', () => {
  const s = {};
  const rampe = () => new Proxy({}, { get: () => s });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => s }),
      Colors: new Proxy({}, { get: () => 'couleur' }),
      Fonts: rampe(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
// Doublure fidèle de @gorhom : dismiss() mémorise onDismiss, émis « à la fin de l'animation ».
jest.mock('@gorhom/bottom-sheet', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: R.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      R.useImperativeHandle(ref, () => ({
        dismiss: () => { mockFermeture.courant = props.onDismiss; },
        present: () => {},
      }));
      return R.createElement(View, null, props.children);
    }),
    BottomSheetScrollView: (/** @type {any} */ p) => R.createElement(View, null, p.children),
    BottomSheetView: (/** @type {any} */ p) => R.createElement(View, null, p.children),
    useBottomSheetInternal: () => null,
  };
});
jest.mock('@/components/atoms/checkable/Checkable', () => {
  const R = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return (/** @type {any} */ p) => R.createElement(
    TouchableOpacity,
    { onPress: p.setIsChecked, testID: `option-${p.text}` },
    R.createElement(Text, null, p.text),
  );
});
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);

test('action en tête : referme SANS toucher à la valeur, même après onDismiss', () => {
  jest.useFakeTimers();
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(
    (/** @type {any} */ tache) => { tache(); return /** @type {any} */ ({ cancel() {} }); },
  );
  const setValue = jest.fn();
  const onBlur = jest.fn();
  const onPress = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <AutocompleteSelect
        actionEnTete={{
          accessibilityLabel: 'Ajouter', aide: 'carte', onPress, titre: 'Ajouter « Stade »',
        }}
        garderLaRecherche
        isSearchable
        label="Adresse"
        onBlur={onBlur}
        options={OPTIONS}
        searchValue="Stade"
        setSearchValue={() => {}}
        setValue={setValue}
        value=""
      />,
    );
  });
  const ouvrir = arbre.root.findAll((/** @type {any} */ n) => n.props.accessibilityRole === 'button'
    && typeof n.props.onPress === 'function')[0];
  act(() => { ouvrir.props.onPress(); });
  act(() => { jest.advanceTimersByTime(300); });
  act(() => {
    arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'option-Adresse A')[0]
      .props.onPress();
  });
  const action = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.accessibilityLabel === 'Ajouter'
      && typeof n.props.onPress === 'function',
  )[0];
  act(() => { action.props.onPress(); });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(typeof mockFermeture.courant).toBe('function');
  act(() => { mockFermeture.courant(); }); // fin de l'animation de fermeture

  expect(setValue).not.toHaveBeenCalled();
  expect(onBlur).toHaveBeenCalledTimes(1);
  act(() => arbre.unmount());
  jest.useRealTimers();
});
