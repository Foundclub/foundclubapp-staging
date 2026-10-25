// C04 Q2-06 (BUGHUNT phase 2, 25/10) — un entraineur cree depuis l equipe avec « 31/02/2010 »
// etait enregistre ne le 2010-03-03 (`new Date(2010, 1, 31)` deborde sur le mois suivant).
// Un jour qui n existe pas n est plus envoye ; une vraie date l est toujours.
// Harnais repris de authService.INTL1paysDuNumero.test.js.

const mockPost = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:1337'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => ({ token: 'jeton-de-test' })),
}));

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

jest.mock('@/utils/device/deviceInfo', () => ({
  getDeviceLocaleCountry: jest.fn(() => 'BE'),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: 'http://127.0.0.1:1337' },
    post: mockPost,
  },
}));

const { createTrainer } = require('./authService');

class FormDataEspion {
  constructor() {
    /** @type {Record<string, string>} */
    this.champs = {};
  }

  /**
   * Retient le dernier champ ajoute sous sa cle.
   * @param {string} cle
   * @param {string} valeur
   */
  append(cle, valeur) {
    this.champs[cle] = valeur;
  }
}

const FormDataDOrigine = global.FormData;

beforeEach(() => {
  mockPost.mockReset();
  // Le serveur refuse : on ne regarde que ce qui est PARTI.
  mockPost.mockRejectedValue(Object.assign(new Error('arret du temoin'), { status: 400 }));
  // @ts-expect-error espion minimal de FormData
  global.FormData = FormDataEspion;
});

afterAll(() => {
  global.FormData = FormDataDOrigine;
});

describe('🔴 C04 Q2-06 — createTrainer et la date de naissance', () => {
  it('« 31/02/2010 » n est pas envoye comme le 3 mars', async () => {
    await expect(createTrainer({ birthdate: '31/02/2010', phoneNumber: '0470123456' }))
      .rejects.toBeTruthy();

    expect(mockPost.mock.calls[0][1].champs.birthdate).toBeUndefined();
  });

  it('« 15/01/2010 » part en 2010-01-15', async () => {
    await expect(createTrainer({ birthdate: '15/01/2010', phoneNumber: '0470123456' }))
      .rejects.toBeTruthy();

    expect(mockPost.mock.calls[0][1].champs.birthdate).toBe('2010-01-15');
  });
});
