/**
 * RARETE-SERVEUR (10/11/2026) — le palier `cardRarity` que rend `GET /firebase-auth/:id`
 * traverse la validation du profil public jusqu'à l'écran (le schéma accepte les clés
 * inconnues) ; un ancien
 * serveur, sans palier, rend le profil comme avant.
 */
const mockGet = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:1337') }));
jest.mock('@/platform/auth', () => ({
  confirmOtp: jest.fn(),
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendOtp: jest.fn(),
}));
jest.mock('@/platform/device', () => ({
  getAppVersion: jest.fn(() => '1.0.0'),
  getDeviceId: jest.fn(() => 'device-id'),
}));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: mockGet } }));

const { getUserById } = require('./authService');

const PROFIL = {
  age: 24, documentId: 'samia', firstname: 'Samia', id: 31,
};

describe('RARETE-SERVEUR — le palier du profil public', () => {
  it('arrive jusqu’à l’écran', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { ...PROFIL, cardRarity: 'legendary' } } });
    const profil = await getUserById('samia');
    expect(profil.cardRarity).toBe('legendary');
    expect(mockGet).toHaveBeenCalledWith('/firebase-auth/samia');
  });

  it('ancien serveur sans palier : le profil, sans palier', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: PROFIL } });
    const profil = await getUserById('samia');
    expect(profil.firstname).toBe('Samia');
    expect('cardRarity' in profil).toBe(false);
  });
});
