// 🧪 COLL-AFFICHE (03/10/2026) — `downloadRemoteFile`, les deux jumeaux.
//
// Ces fichiers n'avaient AUCUN témoin (CLAUDE.md E6) : les cas « CARACTÉRISATION » décrivent
// ce qu'ils faisaient avant le lot (adresse absente, rapatriement, refus du serveur, fichier
// vide, le site qui confie l'adresse au navigateur) et restent verts. Les cas « NEUF » : un
// en-tête (le jeton d'une route GARDÉE, l'affiche de l'installation, planche 30 B) voyage avec
// la requête ; sur le site, le fichier est alors lu avec cet en-tête puis téléchargé, au lieu
// d'ouvrir une adresse que le navigateur demanderait sans jeton.

import { downloadRemoteFile as telechargerNatif } from '../downloadRemoteFile.native';
import { downloadRemoteFile as telechargerSite } from '../downloadRemoteFile.web';

// Les issues nommées, lues dans le contrat lui-même (jamais recopiées).
const { FILE_SHARE_OUTCOMES } = jest.requireActual('@/platform/share/fileShareContract');

const mockFetch = jest.fn();
const mockStat = jest.fn();
const mockConfig = jest.fn();
const mockPartager = jest.fn();
const mockOuvrir = jest.fn();

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: (/** @type {any} */ options) => {
      mockConfig(options);
      return { fetch: (/** @type {any[]} */ ...args) => mockFetch(...args) };
    },
    fs: {
      dirs: { CacheDir: '/cache' },
      stat: (/** @type {any} */ chemin) => mockStat(chemin),
    },
  },
}));
jest.mock('@/platform/share/shareLocalFile', () => ({
  shareLocalFile: (/** @type {any} */ params) => mockPartager(params),
}));
jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrl: (/** @type {any} */ url) => mockOuvrir(url) },
}));

/**
 * Une réponse de `react-native-blob-util`.
 * @param {number} status - Le code HTTP.
 * @returns {object} La réponse.
 */
const reponseNative = (status) => ({
  info: () => ({ status }),
  path: () => '/cache/fichier.pdf',
});

const AFFICHE = 'affiche-gymnase-des-tilleuls-2026-09-28.pdf';
const ROUTE = 'https://api.test/api/collectivites/v/chiffres/affiche?installation=g&semaine=2026-09-28';

beforeEach(() => {
  [mockFetch, mockStat, mockConfig, mockPartager, mockOuvrir].forEach((d) => d.mockReset());
});

describe('downloadRemoteFile.native', () => {
  it('CARACTÉRISATION — sans adresse : une erreur nommée, aucun réseau', async () => {
    await expect(telechargerNatif({ url: '  ' })).rejects.toMatchObject({ reason: 'no_url' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('CARACTÉRISATION — rapatrie en GET dans le cache, puis confie le fichier', async () => {
    mockFetch.mockResolvedValue(reponseNative(200));
    mockStat.mockResolvedValue({ size: 1234 });
    mockPartager.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const issue = await telechargerNatif({
      fileName: 'modele.pdf', mimeType: 'application/pdf', url: 'https://api.test/uploads/modele.pdf',
    });
    expect(mockFetch.mock.calls[0].slice(0, 2)).toEqual(['GET', 'https://api.test/uploads/modele.pdf']);
    expect(mockConfig).toHaveBeenCalledWith(
      expect.objectContaining({ fileCache: true, overwrite: true }),
    );
    expect(mockPartager).toHaveBeenCalledWith({
      fileName: 'modele.pdf', fileUri: 'file:///cache/fichier.pdf', mimeType: 'application/pdf',
    });
    expect(issue).toEqual({ opened: true, outcome: 'downloads' });
  });

  it('CARACTÉRISATION — un refus du serveur porte son code, un fichier vide le dit', async () => {
    mockFetch.mockResolvedValue(reponseNative(403));
    await expect(telechargerNatif({ url: 'https://api.test/x' }))
      .rejects.toMatchObject({ reason: 'http_error', status: 403 });
    mockFetch.mockResolvedValue(reponseNative(200));
    mockStat.mockResolvedValue({ size: 0 });
    await expect(telechargerNatif({ url: 'https://api.test/x' }))
      .rejects.toMatchObject({ reason: 'empty_file' });
    expect(mockPartager).not.toHaveBeenCalled();
  });

  it('NEUF — l’en-tête d’une route gardée (le jeton) voyage avec la requête', async () => {
    mockFetch.mockResolvedValue(reponseNative(200));
    mockStat.mockResolvedValue({ size: 1234 });
    mockPartager.mockResolvedValue({ opened: true, outcome: 'downloads' });
    await telechargerNatif({
      fileName: AFFICHE,
      headers: { Authorization: 'Bearer jeton' },
      mimeType: 'application/pdf',
      url: ROUTE,
    });
    expect(mockFetch).toHaveBeenCalledWith('GET', ROUTE, { Authorization: 'Bearer jeton' });
    expect(mockPartager).toHaveBeenCalledWith(expect.objectContaining({ fileName: AFFICHE }));
  });

  // PAYE-LIMITE (04/11, ligne M0157) — sur iPhone, le reçu s'ouvrait comme
  // « 1793815150589-recu-FC-2026-86651-001387 · données » : sans extension, iOS ne sait pas
  // ce qu'est le fichier. Les trois écrans du reçu passent un nom sans extension.
  describe('PAYE-LIMITE — un nom que le téléphone sait ouvrir', () => {
    const URL_RECU = 'https://api.test/uploads/recu_FC_2026_86651_001387_abc.pdf';

    beforeEach(() => {
      mockFetch.mockResolvedValue(reponseNative(200));
      mockStat.mockResolvedValue({ size: 50000 });
      mockPartager.mockResolvedValue({ opened: true, outcome: 'share-sheet' });
    });

    it('un nom sans extension prend celle de l’adresse, et le type PDF', async () => {
      await telechargerNatif({ fileName: 'recu-FC-2026-86651-001387', url: URL_RECU });
      expect(mockPartager).toHaveBeenCalledWith(expect.objectContaining({
        fileName: 'recu-FC-2026-86651-001387.pdf', mimeType: 'application/pdf',
      }));
      expect(mockConfig.mock.calls[0][0].path).toMatch(/recu-FC-2026-86651-001387.pdf$/);
    });

    it('une adresse sans extension : PDF par défaut, comme le nom de secours', async () => {
      await telechargerNatif({ fileName: 'recu-FC-1', url: 'https://api.test/fichier?x=1' });
      expect(mockPartager).toHaveBeenCalledWith(expect.objectContaining({
        fileName: 'recu-FC-1.pdf', mimeType: 'application/pdf',
      }));
    });

    it('un nom qui a déjà son extension n est pas doublé, ni son type imposé', async () => {
      await telechargerNatif({ fileName: 'modele.docx', url: 'https://api.test/uploads/x.docx' });
      expect(mockPartager).toHaveBeenCalledWith(expect.objectContaining({
        fileName: 'modele.docx', mimeType: undefined,
      }));
    });
  });
});

describe('downloadRemoteFile.web', () => {
  /** @type {any} */
  let lien;
  const fetchAvant = global.fetch;
  const documentAvant = global.document;
  const creerAvant = URL.createObjectURL;
  const revoquerAvant = URL.revokeObjectURL;

  beforeEach(() => {
    lien = { click: jest.fn() };
    // @ts-ignore -- un document minimal : le banc des témoins n'a pas de DOM.
    global.document = {
      body: { appendChild: jest.fn(), removeChild: jest.fn() },
      createElement: jest.fn(() => lien),
    };
    URL.createObjectURL = jest.fn(() => 'blob:affiche');
    URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = fetchAvant;
    // @ts-ignore -- rendu tel qu'il était
    global.document = documentAvant;
    URL.createObjectURL = creerAvant;
    URL.revokeObjectURL = revoquerAvant;
  });

  it('CARACTÉRISATION — sans en-tête : le navigateur reçoit l’adresse, aucun fetch', async () => {
    const issue = await telechargerSite({ url: 'https://api.test/uploads/modele.pdf' });
    expect(mockOuvrir).toHaveBeenCalledWith('https://api.test/uploads/modele.pdf');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(issue).toEqual({ opened: true, outcome: FILE_SHARE_OUTCOMES.SHARE_SHEET });
  });

  it('NEUF — avec l’en-tête : lu avec le jeton, puis téléchargé sous son nom', async () => {
    // @ts-ignore -- une réponse minimale
    global.fetch.mockResolvedValue({ blob: async () => 'octets', ok: true, status: 200 });
    const issue = await telechargerSite({
      fileName: AFFICHE,
      headers: { Authorization: 'Bearer jeton' },
      url: 'https://api.test/api/collectivites/v/chiffres/affiche',
    });
    expect(global.fetch).toHaveBeenCalledWith('https://api.test/api/collectivites/v/chiffres/affiche', {
      headers: { Authorization: 'Bearer jeton' },
    });
    expect(mockOuvrir).not.toHaveBeenCalled();
    expect(lien.download).toBe(AFFICHE);
    expect(lien.href).toBe('blob:affiche');
    expect(lien.click).toHaveBeenCalled();
    expect(issue).toEqual({ opened: true, outcome: FILE_SHARE_OUTCOMES.DOWNLOADS });
  });

  it('NEUF — avec l’en-tête, un refus porte son code, rien n’est téléchargé', async () => {
    // @ts-ignore -- une réponse minimale
    global.fetch.mockResolvedValue({ blob: async () => '', ok: false, status: 403 });
    await expect(telechargerSite({ headers: { Authorization: 'Bearer x' }, url: 'https://api.test/a' }))
      .rejects.toMatchObject({ reason: 'http_error', status: 403 });
    expect(lien.click).not.toHaveBeenCalled();
  });
});
