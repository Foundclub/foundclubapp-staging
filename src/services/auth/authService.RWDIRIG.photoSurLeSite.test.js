/**
 * RECETTE-WEB-DIRIGEANT (29/10) — SUR LE SITE, LA PHOTO DE PROFIL N'ARRIVAIT PAS.
 *
 * Même cause que le logo du club (« Files are empty », vu par Adel en production) : le service
 * confiait au `FormData` du navigateur la forme `{ uri, name, type }` du téléphone, écrite
 * « [object Object] ». Le choix d'image du site rend le vrai fichier dans `file`.
 * Au téléphone, rien ne change.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://localhost:1337/api'),
  getUploadEndpoint: jest.fn(() => 'http://localhost:1337/api/upload'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => ({ token: 't' })),
}));

// Mêmes doublures que authService.BH02datesEtPays.test.js.
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
  getDeviceLocaleCountry: jest.fn(() => 'FR'),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { defaults: { baseURL: 'http://localhost:1337/api' }, post: jest.fn(), put: jest.fn() },
}));

const { updateMe } = require('./authService');

/** Un FormData qui note ce qu'on lui confie, sans rien transformer. */
class FormDataNote {
  constructor() {
    /** @type {Array<[string, any]>} */
    this.parties = [];
  }

  /**
   * Garde la valeur telle quelle.
   * @param {string} nom
   * @param {any} valeur
   */
  append(nom, valeur) {
    this.parties.push([nom, valeur]);
  }
}

const partie = (/** @type {any} */ formData, /** @type {string} */ nom) => formData.parties
  .find((/** @type {any} */ [n]) => n === nom)?.[1];

beforeEach(() => {
  jest.clearAllMocks();
  global.FormData = /** @type {any} */ (FormDataNote);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = /** @type {any} */ (jest.fn(async () => ({
    json: async () => ({ id: 1 }), ok: true, status: 200, text: async () => '{"id":1}',
  })));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('photo de profil envoyée depuis le site (RWDIRIG)', () => {
  it('🔴 le fichier du navigateur part tel quel', async () => {
    const file = new File(['png'], 'moi.png', { type: 'image/png' });
    await updateMe(/** @type {any} */ ({
      avatar: {
        file, filename: 'moi.png', mime: 'image/png', path: 'blob:http://localhost:5303/abc',
      },
      firstname: 'Karim',
    })).catch(() => {});

    const [, init] = /** @type {any} */ (global.fetch).mock.calls[0];
    expect(partie(init.body, 'avatar')).toBe(file);
  });

  it('🔒 téléphone (sans `file`) : la forme { uri, name, type } part comme avant', async () => {
    await updateMe(/** @type {any} */ ({
      avatar: { filename: 'moi.jpg', mime: 'image/jpeg', path: 'file:///tmp/moi.jpg' },
      firstname: 'Karim',
    })).catch(() => {});

    const [, init] = /** @type {any} */ (global.fetch).mock.calls[0];
    expect(partie(init.body, 'avatar')).toEqual(expect.objectContaining({ uri: 'file:///tmp/moi.jpg' }));
  });
});
