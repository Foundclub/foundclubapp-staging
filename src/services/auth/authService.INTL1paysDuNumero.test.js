// INTL1 — LE PAYS DU TELEPHONE VOYAGE AVEC LE NUMERO D UN ENTRAINEUR CREE.
//
// La fenetre « Creer un entraineur » (CreateTrainerModal) est un champ texte
// libre : un dirigeant belge y tape « 0470 12 34 56 », sans indicatif. Le
// serveur n a que ce texte, et le lisait comme un numero FRANCAIS (+33...).
// Le compte cree n etait alors jamais retrouve quand l entraineur se
// connectait par SMS avec son vrai +32 : un second compte naissait.
//
// Le serveur accepte desormais `phoneCountry` (liste blanche FR/BE/CH/AE,
// tout le reste = FR : admin tests/authz/INTL1-numeros-etrangers.test.js).
// Ce temoin fige que l app l ENVOIE, pour les deux portes.

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

const { createManager, createTrainer } = require('./authService');

class FormDataEspion {
  constructor() {
    /** @type {Record<string, string>} */
    this.champs = {};
  }

  /**
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

describe.each([
  ['createTrainer', createTrainer, '/firebase-auth/create-trainer'],
  ['createManager', createManager, '/firebase-auth/create-manager'],
])('INTL1 — %s', (_nom, creer, route) => {
  it('envoie le pays du telephone a cote du numero tape sans indicatif', async () => {
    await expect(creer({
      firstname: 'Lotte',
      lastname: 'Peeters',
      phoneNumber: '0470 12 34 56',
    })).rejects.toBeTruthy();

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [routeAppelee, corps] = mockPost.mock.calls[0];
    expect(routeAppelee).toBe(route);
    expect(corps.champs).toEqual(expect.objectContaining({
      phoneCountry: 'BE',
      phoneNumber: '0470 12 34 56',
      username: '0470 12 34 56',
    }));
  });
});
