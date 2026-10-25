/* eslint-disable max-classes-per-file */
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

const { createTrainer, updateMe } = require('./authService');

// BH02 (BUGHUNT 24/10) — P1-18 : à l'ouest d'UTC, une date de naissance partait la veille.
// Sous Windows, jest n'applique pas TZ : on simule l'heure de New York (UTC-5 en hiver)
// par une Date dont l'heure locale = UTC-5.
const RealDate = Date;
const DECALAGE = 5 * 3600 * 1000;
class DateNewYork extends RealDate {
  constructor(...args) {
    if (args.length > 1) super(RealDate.UTC(...args) + DECALAGE);
    else super(...args);
  }

  getDate() { return this.local().getUTCDate(); }

  getFullYear() { return this.local().getUTCFullYear(); }

  getHours() { return this.local().getUTCHours(); }

  getMonth() { return this.local().getUTCMonth(); }

  local() { return new RealDate(this.getTime() - DECALAGE); }
}

class FormDataEspion {
  constructor() { this.champs = {}; }

  append(cle, valeur) { this.champs[cle] = valeur; }
}
const FormDataDOrigine = global.FormData;
const fetchDOrigine = global.fetch;
let dernierFormulaire;

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockRejectedValue(Object.assign(new Error('arret du temoin'), { status: 400 }));
  global.FormData = class extends FormDataEspion {
    constructor() { super(); dernierFormulaire = this; }
  };
  global.fetch = jest.fn(() => Promise.reject(new Error('arret du temoin')));
  global.Date = DateNewYork;
});

afterEach(() => {
  global.Date = RealDate;
  global.FormData = FormDataDOrigine;
  global.fetch = fetchDOrigine;
});

describe('BH02 P1-18 — date de naissance sans glissement de fuseau', () => {
  it('createTrainer garde le 15/01/2000', async () => {
    await expect(createTrainer({ birthdate: '15/01/2000', firstname: 'A', phoneNumber: '0600000000' })).rejects.toBeTruthy();
    expect(mockPost.mock.calls[0][1].champs.birthdate).toBe('2000-01-15');
  });

  it('updateMe garde 2000-01-15T00:00:00.000Z', async () => {
    await updateMe({ birthdate: '2000-01-15T00:00:00.000Z' }).catch(() => null);
    expect(dernierFormulaire.champs.birthdate).toBe('2000-01-15');
  });
});

describe('BH02 P1-18 — repli ISO de createTrainer', () => {
  it('garde 2000-01-15', async () => {
    await expect(createTrainer({ birthdate: '2000-01-15', firstname: 'A', phoneNumber: '0600000000' })).rejects.toBeTruthy();
    expect(mockPost.mock.calls[0][1].champs.birthdate).toBe('2000-01-15');
  });
});
