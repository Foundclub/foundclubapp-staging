import renderer, { act } from 'react-test-renderer';

import AppProvidersNative from '../AppProviders.native';

// TUTOE-2 (27/10) — « une feuille ouverte passe devant le voile ». Les feuilles
// gorhom se rendent dans l'hôte de portail que `BottomSheetModalProvider` pose
// APRÈS ses enfants : une couche montée dans le navigateur (donc dans ces
// enfants) se peint dessous. Le guide doit être un frère qui vient APRÈS le
// fournisseur des feuilles.

jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = jest.requireActual('react-native');
  return {
    BottomSheetModalProvider: ({ children }) => (
      <View testID="feuilles">
        {children}
        <View testID="hote-des-feuilles" />
      </View>
    ),
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return { GestureHandlerRootView: ({ children }) => <View>{children}</View> };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('../AppProviders.shared', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock('@/components/molecules/tour/TourGuideLayer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <View testID="guide" /> };
});

it('le guide se peint après l’hôte des feuilles, hors de ses enfants', () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <AppProvidersNative queryClient={/** @type {any} */ ({})}>
        {null}
      </AppProvidersNative>,
    );
  });
  // Racine (GestureHandlerRootView) : [feuilles, guide], dans cet ordre.
  const racine = tree.toJSON();
  const ordre = racine.children.map((child) => child.props.testID);
  expect(ordre).toEqual(['feuilles', 'guide']);
  // Et le guide n'est pas (aussi) rendu sous le fournisseur des feuilles.
  expect(JSON.stringify(racine.children[0])).not.toContain('"guide"');
});
