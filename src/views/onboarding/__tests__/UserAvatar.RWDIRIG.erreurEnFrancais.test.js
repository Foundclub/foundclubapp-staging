import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserAvatar from '../UserAvatar';

// RECETTE-WEB-DIRIGEANT (29/10) — renvoyé par la session COACH : à l'inscription, l'étape photo
// affichait « Failed to update user data: Error updating user profile: 2 errors occurred »
// (le fichier partait vide depuis le site, corrigé dans services/formDataFile.js). Ici, le
// MESSAGE : un échec technique ne s'affiche plus en anglais ; un refus que le serveur nomme
// (code connu de APIerrors) garde sa traduction.

/** @type {any[]} */
const mockOptions = [];

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockOptions.push(options);
    return { isPending: false, mutate: jest.fn() };
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    refetchUserData: jest.fn(),
    userData: { documentId: 'u1' },
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});
jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => function SelectAvatarMock() {
  return null;
});
jest.mock('@/components/templates/FormScreenContainer', () => function FormScreenContainerMock(
  /** @type {any} */ { children },
) {
  return children;
});
jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => function SkipMock() {
  return null;
});
jest.mock('@/views/onboarding/components/OnboardingStateView', () => function StateMock() {
  return null;
});
jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));

beforeEach(() => {
  mockOptions.length = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('🔴 un échec technique en anglais s affiche en français', async () => {
  await act(async () => {
    renderer.create(<UserAvatar navigation={/** @type {any} */ ({ navigate: jest.fn() })} />);
  });

  const { onError } = mockOptions[mockOptions.length - 1];
  const brut = 'Failed to update user data: Error updating user profile: 2 errors occurred';
  act(() => onError(new Error(brut)));

  const [, message] = /** @type {any} */ (Alert.alert).mock.calls[0];
  expect(message).toBe('Impossible de mettre à jour ton profil.');
});
