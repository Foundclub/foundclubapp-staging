// 🐞 BUGHUNT P1-09 (BH06) — un export refusé (401, jeton expiré) était enregistré
// en `.xlsx` et son chemin rendu comme un succès : le corps d'erreur devenait « le fichier ».

const mockFetch = jest.fn();
const mockUnlink = jest.fn(async () => {});

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: () => ({ fetch: mockFetch }),
    fs: {
      dirs: { DocumentDir: '/documents', DownloadDir: '/telechargements' },
      scanFile: jest.fn(async () => {}),
      unlink: mockUnlink,
    },
  },
}));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'perime' }) }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'https://api.test' }));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));

const { exportEventParticipants } = require('../eventService');

const reponse = (/** @type {number} */ status) => ({
  info: () => ({ status }),
  path: () => '/telechargements/participants_U15.xlsx',
});

describe('BH06 P1-09 — export en erreur', () => {
  it('401 : rejette, et efface le faux fichier', async () => {
    mockFetch.mockResolvedValueOnce(reponse(401));
    await expect(exportEventParticipants('evt', 'U15')).rejects.toThrow();
    expect(mockUnlink).toHaveBeenCalledWith('/telechargements/participants_U15.xlsx');
  });

  it('200 : rend le chemin du fichier', async () => {
    mockFetch.mockResolvedValueOnce(reponse(200));
    await expect(exportEventParticipants('evt', 'U15')).resolves.toBe('/telechargements/participants_U15.xlsx');
  });
});
