// C11 (BUGHUNT phase 2, 25/10/2026) — `login` réutilisait l'utilisateur Firebase
// déjà connecté sans vérifier le code, même quand le SMS avait été demandé pour
// un AUTRE numéro : la personne tapait le numéro B, recevait le code de B, et se
// retrouvait connectée au compte A (jeton Firebase de A envoyé au serveur).
// Le serveur vérifie le jeton (verifyIdToken) : on n'obtient jamais le compte B
// sans son code, mais on entre dans le mauvais compte, sans que le code compte.
//
// Le raccourci reste voulu dans deux cas : la reprise de session (`login({})`) et
// la vérification automatique d'Android, où Firebase connecte seul le numéro
// demandé avant que le code soit tapé.

const mockSendOtp = jest.fn();
const mockConfirmOtp = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockPost = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:1337'),
}));

jest.mock('@/platform/auth', () => ({
  confirmOtp: (...args) => mockConfirmOtp(...args),
  getCurrentUser: (...args) => mockGetCurrentUser(...args),
  logout: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendOtp: (...args) => mockSendOtp(...args),
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
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

jest.mock('./bypassPolicy', () => ({
  getResolvedAuthAppEnv: jest.fn(() => 'production'),
  isFirebaseBypassEnabled: jest.fn(() => false),
  isWebQaPhoneBypassEnabled: jest.fn(() => false),
}));

const { login, signInWithPhoneNumber } = require('./authService');
const { resetOtpSendThrottle } = require('./otpSendThrottle');

const NUMERO_A = '+33600000001';
const NUMERO_B = '+33600000002';

const utilisateurFirebase = (phoneNumber, idToken) => ({
  getIdToken: jest.fn(async () => idToken),
  phoneNumber,
});

describe('C11 — login ne réutilise l’utilisateur Firebase présent que pour le numéro demandé', () => {
  beforeEach(() => {
    resetOtpSendThrottle();
    mockSendOtp.mockReset();
    mockConfirmOtp.mockReset();
    mockGetCurrentUser.mockReset();
    mockPost.mockReset();
    mockPost.mockResolvedValue({ data: { data: { documentId: 'user' }, jwt: 'jwt' } });
  });

  test('A est encore connecté à Firebase, le SMS est demandé pour B : le code de B est vérifié', async () => {
    const confirmation = { verificationId: 'vid-B' };
    mockSendOtp.mockResolvedValue(confirmation);
    mockGetCurrentUser.mockReturnValue(utilisateurFirebase(NUMERO_A, 'jeton-A'));
    mockConfirmOtp.mockResolvedValue({ user: utilisateurFirebase(NUMERO_B, 'jeton-B') });

    const confirm = await signInWithPhoneNumber(NUMERO_B);
    await login({ code: '123456', confirm });

    expect(mockConfirmOtp).toHaveBeenCalledWith({ code: '123456', confirmation });
    expect(mockPost).toHaveBeenCalledWith('/firebase-auth/login', { idToken: 'jeton-B' });
  });

  test('vérification automatique d’Android : Firebase a déjà connecté le numéro demandé', async () => {
    mockSendOtp.mockResolvedValue({ verificationId: 'vid-B' });
    mockGetCurrentUser.mockReturnValue(utilisateurFirebase(NUMERO_B, 'jeton-B'));

    const confirm = await signInWithPhoneNumber('+33 6 00 00 00 02');
    await login({ code: '', confirm });

    expect(mockConfirmOtp).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith('/firebase-auth/login', { idToken: 'jeton-B' });
  });

  test('reprise de session sans code (SessionManager) : l’utilisateur Firebase présent sert', async () => {
    mockGetCurrentUser.mockReturnValue(utilisateurFirebase(NUMERO_A, 'jeton-A'));

    await login({});

    expect(mockConfirmOtp).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith('/firebase-auth/login', { idToken: 'jeton-A' });
  });
});
