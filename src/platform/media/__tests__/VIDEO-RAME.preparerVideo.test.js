// VIDEO-RAME (03/11) — iPhone, TestFlight 2.6.87 : après l'essai d'une lourde vidéo, l'app rame
// puis iOS la ferme. La compression tourne dans le téléphone AVANT tout envoi : ces témoins
// décrivent ce qu'elle doit éviter (travail perdu d'avance, doublon, impossible à arrêter,
// fichiers laissés derrière elle).
const mockCompress = jest.fn();
const mockGetFileSize = jest.fn();
const mockCancel = jest.fn();
const mockUnlink = jest.fn();

jest.mock('react-native-compressor', () => ({
  getFileSize: (/** @type {string} */ uri) => mockGetFileSize(uri),
  Video: {
    cancelCompression: (/** @type {string} */ id) => mockCancel(id),
    compress: (/** @type {any[]} */ ...args) => mockCompress(...args),
  },
}), { virtual: true });
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fs: { unlink: (/** @type {string} */ path) => mockUnlink(path) } },
}));
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
}));

const preparer = require('../preparerVideo');

const { preparerVideo } = preparer;

const MO = 1024 * 1024;
const video = (/** @type {object} */ champs) => ({
  duration: 30,
  fileName: 'match.mov',
  height: 1080,
  size: 420 * MO,
  type: 'video/quicktime',
  uri: 'file:///tmp/match.mov',
  width: 1920,
  ...champs,
});

/**
 * Une compression qui reste en cours tant que le témoin ne la termine pas.
 * @returns {{ finir: (uri: string) => void, echouer: () => void }}
 */
const compressionEnCours = () => {
  /** @type {{ finir: (uri: string) => void, echouer: () => void }} */
  const commandes = { echouer: () => {}, finir: () => {} };
  mockCompress.mockImplementation((_uri, options) => {
    options?.getCancellationId?.('id-compression');
    return new Promise((resolve, reject) => {
      commandes.finir = resolve;
      commandes.echouer = () => reject(new Error('Compression Failed'));
    });
  });
  return commandes;
};

describe('VIDEO-RAME — la compression d une vidéo lourde', () => {
  beforeEach(() => {
    mockCompress.mockReset();
    mockGetFileSize.mockReset();
    mockCancel.mockReset();
    mockUnlink.mockReset();
    mockUnlink.mockResolvedValue(undefined);
    mockCompress.mockResolvedValue('file:///tmp/reduit.mp4');
    mockGetFileSize.mockResolvedValue(String(20 * MO));
  });

  test('juste au-dessus de la limite (151 Mo, 30 s) : compressée, elle part', async () => {
    const resultat = await preparerVideo(video({ size: 151 * MO }));
    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(resultat).toMatchObject({ compressee: true });
  });

  test('loin au-dessus mais courte (4 Go, 3 min de 4K) : compressée, elle tiendra', async () => {
    const resultat = await preparerVideo(video({
      duration: 180, height: 2160, size: 4096 * MO, width: 3840,
    }));
    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(resultat).toMatchObject({ compressee: true });
  });

  test('longue mais petite image (20 min en 640 px) : tentée, elle peut tenir', async () => {
    const resultat = await preparerVideo(video({
      duration: 1200, height: 360, size: 400 * MO, width: 640,
    }));
    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(resultat).toMatchObject({ compressee: true });
  });

  test('sous la limite et longue : jamais refusée d avance, l original peut partir', async () => {
    await preparerVideo(video({ duration: 3600, size: 140 * MO }));
    expect(mockCompress).toHaveBeenCalledTimes(1);
  });

  test('1 h en 1080p, 10 Go : refus AVANT de compresser, elle ne tiendrait jamais', async () => {
    const resultat = await preparerVideo(video({ duration: 3600, size: 10240 * MO }));
    expect(mockCompress).not.toHaveBeenCalled();
    expect(resultat).toEqual({ refus: expect.stringContaining('150') });
  });

  test('20 min en 1080p, 1 Go : tentée, une image fixe peut passer dessous', async () => {
    await preparerVideo(video({ duration: 1200, size: 1024 * MO }));
    expect(mockCompress).toHaveBeenCalledTimes(1);
  });

  test('durée inconnue, 10 Go : tentée, on ne refuse pas ce qu on n a pas mesuré', async () => {
    await preparerVideo(video({ duration: 0, size: 10240 * MO }));
    expect(mockCompress).toHaveBeenCalledTimes(1);
  });

  test('une seule compression à la fois : la seconde est refusée', async () => {
    const enCours = compressionEnCours();
    const premiere = preparerVideo(video());
    const seconde = await preparerVideo(video({ fileName: 'autre.mov', uri: 'file:///tmp/autre.mov' }));

    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(seconde).toEqual({ refus: expect.any(String) });

    enCours.finir('file:///tmp/reduit.mp4');
    expect(await premiere).toMatchObject({ compressee: true });

    // Finie : la suivante passe.
    mockCompress.mockResolvedValue('file:///tmp/reduit2.mp4');
    expect(await preparerVideo(video())).toMatchObject({ compressee: true });
  });

  test('une compression qui échoue libère la place', async () => {
    const enCours = compressionEnCours();
    const premiere = preparerVideo(video());
    enCours.echouer();
    await premiere;

    mockCompress.mockResolvedValue('file:///tmp/reduit2.mp4');
    expect(await preparerVideo(video())).toMatchObject({ compressee: true });
  });

  test('annuler arrête le téléphone, et RIEN ne part (pas même l original)', async () => {
    const enCours = compressionEnCours();
    const resultat = preparerVideo(video({ size: 100 * MO }));

    preparer.annulerPreparationVideo();
    expect(mockCancel).toHaveBeenCalledWith('id-compression');

    enCours.echouer();
    expect(await resultat).toEqual({ annulee: true });
  });

  test('annulée trop tard : le fichier réduit ne part pas et ne reste pas', async () => {
    const enCours = compressionEnCours();
    const resultat = preparerVideo(video());

    preparer.annulerPreparationVideo();
    enCours.finir('file:///tmp/reduit.mp4');

    expect(await resultat).toEqual({ annulee: true });
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/reduit.mp4');
  });

  test('une compression annulée qui ne répond plus ne bloque pas la suivante', async () => {
    mockCompress.mockImplementationOnce((_uri, options) => {
      options.getCancellationId('id-muette');
      return new Promise(() => {});
    });
    preparerVideo(video());
    preparer.annulerPreparationVideo();

    expect(await preparerVideo(video())).toMatchObject({ compressee: true });
  });

  test('annuler sans compression en cours ne fait rien', () => {
    preparer.annulerPreparationVideo();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  test('réduite mais encore trop lourde : refus, et le fichier réduit est effacé', async () => {
    mockGetFileSize.mockResolvedValue(String(151 * MO));
    const resultat = await preparerVideo(video());
    expect(resultat).toEqual({ refus: expect.any(String) });
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/reduit.mp4');
  });

  test('oublierFichierVideo efface un temporaire, jamais une adresse distante', async () => {
    await preparer.oublierFichierVideo('file:///tmp/reduit%20bis.mp4');
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/reduit bis.mp4');

    mockUnlink.mockClear();
    await preparer.oublierFichierVideo('https://foundclub.app/uploads/a.mp4');
    await preparer.oublierFichierVideo('');
    await preparer.oublierFichierVideo('file:///var/mobile/Documents/match.mov');
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  test('un effacement qui échoue ne casse pas l envoi', async () => {
    mockUnlink.mockRejectedValue(new Error('absent'));
    await expect(preparer.oublierFichierVideo('file:///tmp/a.mp4')).resolves.toBeUndefined();
  });
});
