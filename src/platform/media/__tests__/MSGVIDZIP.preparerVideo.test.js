// MSGVIDZIP (29/10) — une vidéo est compressée par le téléphone AVANT l'envoi (décision
// d'Adel « 2- C »). La limite de 150 Mo s'applique APRÈS compression. Si la compression
// échoue : l'original part s'il pèse 150 Mo ou moins, sinon refus clair.
const mockCompress = jest.fn();
const mockGetFileSize = jest.fn();

jest.mock('react-native-compressor', () => ({
  getFileSize: (/** @type {string} */ uri) => mockGetFileSize(uri),
  Video: {
    compress: (/** @type {any[]} */ ...args) => mockCompress(...args),
  },
}), { virtual: true });
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
}));

const { preparerVideo, VIDEO_COMPRESSION_MAX_SIDE } = require('../preparerVideo');

const MO = 1024 * 1024;
const VIDEO = {
  duration: 180, fileName: 'match.mov', size: 420 * MO, type: 'video/quicktime', uri: 'file:///match.mov',
};

describe('MSGVIDZIP — préparer une vidéo avant l envoi', () => {
  beforeEach(() => {
    mockCompress.mockReset();
    mockGetFileSize.mockReset();
  });

  test('compression réussie : le fichier réduit part, en mp4, avec sa taille', async () => {
    mockCompress.mockResolvedValue('file:///cache/match-compresse.mp4');
    mockGetFileSize.mockResolvedValue(String(38 * MO));

    const resultat = await preparerVideo(VIDEO);

    expect(mockCompress).toHaveBeenCalledWith('file:///match.mov', expect.objectContaining({
      compressionMethod: 'auto',
      maxSize: VIDEO_COMPRESSION_MAX_SIDE,
    }));
    expect(resultat).toEqual({
      asset: {
        duration: 180,
        fileName: 'match.mp4',
        size: 38 * MO,
        type: 'video/mp4',
        uri: 'file:///cache/match-compresse.mp4',
      },
      compressee: true,
    });
  });

  test('trop lourde APRÈS compression : refus en français qui dit la limite', async () => {
    mockCompress.mockResolvedValue('file:///cache/enorme.mp4');
    mockGetFileSize.mockResolvedValue(String(160 * MO));

    const resultat = await preparerVideo(VIDEO);

    expect(resultat).toEqual({ refus: 'Vidéo trop lourde : 150 Mo maximum.' });
  });

  test('compression en échec, original léger : l original part tel quel', async () => {
    mockCompress.mockRejectedValue(new Error('codec'));
    const legere = { ...VIDEO, size: 90 * MO };

    const resultat = await preparerVideo(legere);

    expect(resultat).toEqual({ asset: legere, compressee: false });
  });

  test('compression en échec, original trop lourd : refus clair', async () => {
    mockCompress.mockRejectedValue(new Error('codec'));

    const resultat = await preparerVideo(VIDEO);

    expect(resultat).toEqual({
      refus: 'Vidéo trop lourde : 150 Mo maximum. Le téléphone n’a pas pu la réduire.',
    });
  });

  test('une photo ou un document ne passent pas par la compression', async () => {
    const photo = {
      fileName: 'p.jpg', size: 3 * MO, type: 'image/jpeg', uri: 'file:///p.jpg',
    };
    expect(await preparerVideo(photo)).toEqual({ asset: photo, compressee: false });
    expect(mockCompress).not.toHaveBeenCalled();
  });
});
