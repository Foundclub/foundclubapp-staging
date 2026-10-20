// 🧪 MSGIMG (20/10/2026) — `enregistrerLImage`, les deux jumeaux.
//
// Telephone : l'image distante est rapatriee dans le cache (la galerie d'Android n'accepte
// qu'un fichier local), puis confiee a CameraRoll — album FoundClub sur Android, pellicule
// sur iPhone (l'acces « ajout » ne permet pas de toucher a un album). Un refus d'acces
// porte une raison NOMMEE, dont l'ecran tire « Ouvrir les reglages ».
// Site : l'image est lue puis telechargee sous un nom de fichier ; si le stockage refuse la
// lecture (CORS), elle s'ouvre dans un nouvel onglet.

import { PermissionsAndroid, Platform } from 'react-native';

import { enregistrerLImage as enregistrerNatif } from '../enregistrerLImage.native';
import { enregistrerLImage as enregistrerSite } from '../enregistrerLImage.web';

const mockFetch = jest.fn();
const mockConfig = jest.fn();
const mockSaveAsset = jest.fn();

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: (/** @type {any} */ options) => {
      mockConfig(options);
      return { fetch: (/** @type {any[]} */ ...args) => mockFetch(...args) };
    },
    fs: { dirs: { CacheDir: '/cache' } },
  },
}));
jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: { saveAsset: (/** @type {any[]} */ ...args) => mockSaveAsset(...args) },
}));

const PHOTO = 'https://cdn.example.test/uploads/terrain_ab12.png?v=2';

/**
 * Une reponse de `react-native-blob-util`.
 * @param {number} status Le code HTTP.
 * @returns {object} La reponse.
 */
const reponseNative = (status) => ({
  info: () => ({ status }),
  path: () => '/cache/foundclub-image.png',
});

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = Platform.Version;

/**
 * Fait passer le temoin pour un telephone donne.
 * @param {string} os 'ios' ou 'android'.
 * @param {number} [version] La version d'Android.
 */
const telephone = (os, version = 34) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};

beforeEach(() => {
  [mockFetch, mockConfig, mockSaveAsset].forEach((d) => d.mockReset());
});

afterEach(() => {
  telephone(OS_D_ORIGINE, /** @type {number} */ (VERSION_D_ORIGINE));
  jest.restoreAllMocks();
});

describe('MSGIMG — enregistrerLImage (telephone)', () => {
  test('sans adresse : une raison nommee, aucun reseau', async () => {
    await expect(enregistrerNatif('  ')).rejects.toMatchObject({ reason: 'no_url' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('Android : rapatrie l image dans le cache, puis l album FoundClub', async () => {
    telephone('android', 34);
    mockFetch.mockResolvedValue(reponseNative(200));
    mockSaveAsset.mockResolvedValue({ node: {} });

    await expect(enregistrerNatif(PHOTO)).resolves.toEqual({ issue: 'enregistree' });

    expect(mockFetch).toHaveBeenCalledWith('GET', PHOTO);
    expect(mockConfig.mock.calls[0][0]).toEqual(expect.objectContaining({
      fileCache: true,
      path: expect.stringMatching(/^\/cache\/foundclub-image-\d+\.png$/),
    }));
    expect(mockSaveAsset).toHaveBeenCalledWith(
      'file:///cache/foundclub-image.png',
      { album: 'FoundClub', type: 'photo' },
    );
  });

  test('iPhone : pellicule, SANS album (l acces « ajout » n y donne pas droit)', async () => {
    telephone('ios');
    mockFetch.mockResolvedValue(reponseNative(200));
    mockSaveAsset.mockResolvedValue({ node: {} });

    await enregistrerNatif(PHOTO);

    expect(mockSaveAsset).toHaveBeenCalledWith(
      'file:///cache/foundclub-image.png',
      { album: '', type: 'photo' },
    );
  });

  test('iPhone : l acces aux photos refuse devient la raison « permission_refusee »', async () => {
    telephone('ios');
    mockFetch.mockResolvedValue(reponseNative(200));
    mockSaveAsset.mockRejectedValue(Object.assign(new Error('Access to photo library was denied'), {
      code: 'E_PHOTO_LIBRARY_AUTH_DENIED',
    }));

    await expect(enregistrerNatif(PHOTO)).rejects.toMatchObject({ reason: 'permission_refusee' });
  });

  test('Android 9 : permission d ecriture demandee ; refusee, rien n est telecharge', async () => {
    telephone('android', 28);
    const demande = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');

    await expect(enregistrerNatif(PHOTO)).rejects.toMatchObject({ reason: 'permission_refusee' });

    expect(demande).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('le serveur refuse l image : raison « http_error », rien dans la galerie', async () => {
    telephone('android', 34);
    mockFetch.mockResolvedValue(reponseNative(404));

    await expect(enregistrerNatif(PHOTO)).rejects.toMatchObject({ reason: 'http_error' });
    expect(mockSaveAsset).not.toHaveBeenCalled();
  });
});

describe('MSGIMG — enregistrerLImage (site)', () => {
  /** @type {any[]} */
  let liens;

  beforeEach(() => {
    liens = [];
    const corps = { appendChild: jest.fn(), removeChild: jest.fn() };
    // @ts-ignore — un document minimal : Jest tourne ici sans navigateur.
    global.document = {
      body: corps,
      createElement: () => {
        /** @type {Record<string, string>} */
        const attributs = {};
        const lien = {
          attributs,
          click: jest.fn(),
          setAttribute: (/** @type {string} */ n, /** @type {string} */ v) => {
            attributs[n] = v;
          },
        };
        liens.push(lien);
        return lien;
      },
    };
    // @ts-ignore
    global.URL.createObjectURL = jest.fn(() => 'blob:image-1');
    // @ts-ignore
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    // @ts-ignore
    delete global.document;
    // @ts-ignore
    delete global.fetch;
  });

  test('l image lue est TELECHARGEE sous un nom de fichier (pas ouverte)', async () => {
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      blob: async () => 'octets', ok: true, status: 200,
    });

    await expect(enregistrerSite(PHOTO)).resolves.toEqual({ issue: 'telechargee' });

    expect(global.fetch).toHaveBeenCalledWith(PHOTO, { mode: 'cors' });
    expect(liens).toHaveLength(1);
    expect(liens[0].attributs).toEqual(expect.objectContaining({
      download: 'foundclub-image.png', href: 'blob:image-1',
    }));
    expect(liens[0].click).toHaveBeenCalled();
  });

  test('le stockage refuse la lecture (CORS) : l image s ouvre dans un nouvel onglet', async () => {
    // @ts-ignore
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(enregistrerSite(PHOTO)).resolves.toEqual({ issue: 'ouverte' });

    expect(liens[0].attributs).toEqual(expect.objectContaining({ href: PHOTO, target: '_blank' }));
  });

  test('une erreur HTTP n ouvre rien : raison « http_error »', async () => {
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

    await expect(enregistrerSite(PHOTO)).rejects.toMatchObject({
      reason: 'http_error', status: 403,
    });
    expect(liens).toHaveLength(0);
  });
});
