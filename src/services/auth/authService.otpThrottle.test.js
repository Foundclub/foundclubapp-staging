const mockSendOtp = jest.fn();

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
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendOtp: mockSendOtp,
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

// Le contournement de développement doit rester hors verrou : il n'envoie
// aucun SMS, donc il ne consomme aucun quota Firebase.
jest.mock('./bypassPolicy', () => ({
  getResolvedAuthAppEnv: jest.fn(() => 'staging'),
  isFirebaseBypassEnabled: jest.fn(() => false),
  isWebQaPhoneBypassEnabled: jest.fn(() => false),
}));

const { signInWithPhoneNumber } = require('./authService');
const {
  OTP_SEND_THROTTLED_CODE,
  resetOtpSendThrottle,
} = require('./otpSendThrottle');

const NUMERO = '+33750840728';

describe('signInWithPhoneNumber : un seul SMS par action utilisateur', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-07-30T02:00:00Z') });
    mockSendOtp.mockReset();
    mockSendOtp.mockResolvedValue({ verificationId: 'vid' });
    resetOtpSendThrottle();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('le premier envoi atteint Firebase', async () => {
    await signInWithPhoneNumber(NUMERO);
    expect(mockSendOtp).toHaveBeenCalledTimes(1);
  });

  test('le second envoi immédiat est refusé AVANT d\'atteindre Firebase', async () => {
    await signInWithPhoneNumber(NUMERO);

    await expect(signInWithPhoneNumber(NUMERO)).rejects.toMatchObject({
      code: OTP_SEND_THROTTLED_CODE,
    });
    expect(mockSendOtp).toHaveBeenCalledTimes(1);
  });

  test('deux appels lancés en parallèle : un seul SMS part', async () => {
    // Le double-tap : le verrou est armé avant l'attente, pas après.
    const resultats = await Promise.allSettled([
      signInWithPhoneNumber(NUMERO),
      signInWithPhoneNumber(NUMERO),
    ]);

    expect(mockSendOtp).toHaveBeenCalledTimes(1);
    expect(resultats.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  });

  test('un envoi REFUSÉ par Firebase arme quand même le délai', async () => {
    // Firebase compte la tentative même quand elle échoue : sans ça, un échec
    // rouvrait la vanne et 4 essais en 45 s redevenaient possibles.
    mockSendOtp.mockRejectedValueOnce(Object.assign(new Error('bad number'), {
      code: 'auth/invalid-phone-number',
    }));

    await expect(signInWithPhoneNumber(NUMERO)).rejects.toBeDefined();
    await expect(signInWithPhoneNumber(NUMERO)).rejects.toMatchObject({
      code: OTP_SEND_THROTTLED_CODE,
    });
    expect(mockSendOtp).toHaveBeenCalledTimes(1);
  });

  test('après 60 s, un nouvel envoi part', async () => {
    await signInWithPhoneNumber(NUMERO);
    jest.setSystemTime(Date.now() + 60000);

    await signInWithPhoneNumber(NUMERO);
    expect(mockSendOtp).toHaveBeenCalledTimes(2);
  });
});
