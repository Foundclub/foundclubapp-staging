/* eslint-disable max-len */
import { cloneWithoutSystemFields } from '../AdminClubForm';

jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

// BH14 P9-17 (BUGHUNT 24/10/2026) — dupliquer un club renvoyait les identifiants des sponsors
// (composants répétables) du club SOURCE.
test('P9-17 : la copie d un club ne garde pas les identifiants de ses sponsors', () => {
  const copie = cloneWithoutSystemFields({
    documentId: 'club-a',
    id: 7,
    name: 'A',
    sponsor: [{ id: 41, name: 'Boulangerie' }],
  });
  expect(copie.id).toBeUndefined();
  expect(copie.sponsor).toEqual([{ name: 'Boulangerie' }]);
});
