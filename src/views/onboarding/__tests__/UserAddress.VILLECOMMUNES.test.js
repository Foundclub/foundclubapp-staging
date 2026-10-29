import renderer, { act } from 'react-test-renderer';

import UserAddress from '../UserAddress';

// VILLE-COMMUNES (29/10/2026, « 1- A ») — l'étape « Où habites-tu ? » demande une COMMUNE : le
// champ part en `type="municipality"` (la base d'adresses, en communes ; placesService).

const mockChamp = jest.fn(() => null);
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => /** @type {any} */ (mockChamp)(props),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => 'UserAvatar',
    refetchUserData: jest.fn(),
    userData: { documentId: 'u1' },
    userDataError: null,
    userDataLoading: false,
  }),
}));
jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: jest.fn() }),
}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
// Doublures reprises de UserSection.test.js (thème, traductions, bouton, lien de saut).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});
jest.mock('@/components/atoms/button/Button', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));
jest.mock('@/components/templates/FormScreenContainer', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));

describe('VILLE-COMMUNES — l’étape Ville de l’inscription', () => {
  it('cherche des communes', () => {
    act(() => {
      const navigation = /** @type {any} */ ({ navigate: jest.fn() });
      renderer.create(<UserAddress navigation={navigation} route={/** @type {any} */ ({})} />);
    });
    expect(mockChamp).toHaveBeenCalledWith(expect.objectContaining({ type: 'municipality' }));
  });
});
