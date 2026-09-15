// DECO (2026-09-15) — la deconnexion mobile doit TOUJOURS fermer la session Firebase.
//
// `SessionManager` rouvre seul une session des qu'il voit un utilisateur Firebase avec un
// store vide (SessionManager.deconnexionDernierCompte.test.js, 3e cas). La deconnexion ne
// tient donc au demarrage suivant que si `logout()` a bien appele `signOut`.

const mockPlatformLogout = jest.fn();
const mockGetCurrentUser = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:1337'),
}));

jest.mock('@/platform/auth', () => ({
  confirmOtp: jest.fn(),
  getCurrentUser: (...args) => mockGetCurrentUser(...args),
  logout: (...args) => mockPlatformLogout(...args),
  onAuthStateChanged: jest.fn(),
  sendOtp: jest.fn(),
}));

jest.mock('@/platform/device', () => ({
  getAppVersion: jest.fn(() => '1.0.0'),
  getDeviceId: jest.fn(() => 'device-id'),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('./bypassPolicy', () => ({
  getResolvedAuthAppEnv: jest.fn(() => 'production'),
  isFirebaseBypassEnabled: jest.fn(() => false),
  isWebQaPhoneBypassEnabled: jest.fn(() => false),
}));

const { logout } = require('./authService');

describe('DECO — authService.logout ferme la session Firebase', () => {
  beforeEach(() => {
    mockPlatformLogout.mockReset();
    mockGetCurrentUser.mockReset();
    mockPlatformLogout.mockResolvedValue(undefined);
  });

  test('un utilisateur Firebase est present : signOut est appele', async () => {
    mockGetCurrentUser.mockReturnValue({ uid: 'firebase-uid-A' });

    await expect(logout()).resolves.toBeUndefined();

    expect(mockPlatformLogout).toHaveBeenCalledTimes(1);
  });

  test('aucun utilisateur Firebase : rien a fermer, la deconnexion reussit', async () => {
    mockGetCurrentUser.mockReturnValue(null);

    await expect(logout()).resolves.toBeUndefined();

    expect(mockPlatformLogout).not.toHaveBeenCalled();
  });

  test('Firebase repond « aucun utilisateur » au signOut : la deconnexion reussit', async () => {
    mockGetCurrentUser.mockReturnValue({ uid: 'firebase-uid-A' });
    const noCurrentUser = Object.assign(new Error('no user'), { code: 'auth/no-current-user' });
    mockPlatformLogout.mockRejectedValue(noCurrentUser);

    await expect(logout()).resolves.toBeUndefined();
  });
});
