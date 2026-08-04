// @ts-nocheck
/**
 * app/src/platform/visualRender/__tests__/visualRender.native.test.js
 *
 * L20 (E6) : visualRender.native.js n'avait AUCUN test alors qu'il porte le geste
 * le plus visible de l'ecran d'affiche. Ce fichier caracterise d'abord le
 * comportement LIVRE sur Android — le fichier ne part pas — puis verrouille la
 * correction, avec un TEMOIN POSITIF iOS pour qu'une regression y soit visible.
 *
 * Ce qui est mocke : la frontiere plateforme uniquement (react-native,
 * react-native-blob-util, jetons, URL d'API). Le chemin reel
 * downloadAndShareRender -> shareLocalFile -> OS est donc reellement observe.
 */

import { PermissionsAndroid, Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { FILE_SHARE_CAPABILITIES, getFileShareCapability } from '../../share/fileShareContract';
import { downloadAndShareRender } from '../visualRender.native';

jest.mock('react-native', () => ({
  PermissionsAndroid: {
    PERMISSIONS: { WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE' },
    request: jest.fn(),
    RESULTS: { DENIED: 'denied', GRANTED: 'granted' },
  },
  // Platform.OS et Platform.Version sont mutes test par test : toute la decision
  // du lot en depend (iOS = feuille de partage, Android = enregistrer puis ouvrir).
  Platform: { OS: 'ios', Version: 34 },
  Share: { share: jest.fn() },
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    android: { actionViewIntent: jest.fn(), addCompleteDownload: jest.fn() },
    fetch: jest.fn(),
    fs: { dirs: { CacheDir: '/data/cache' }, writeFile: jest.fn() },
    MediaCollection: { copyToMediaStore: jest.fn() },
  },
}));

jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jeton' }) }));

jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'https://api.test.foundclub/api' }));

const PNG_PARAMS = {
  format: 'post',
  message: 'Viens nous rejoindre !',
  subjectId: 'club-1',
  subjectType: 'club',
  template: 'affiche-club',
  variant: 'ecusson',
};

const PNG_PATH = '/data/cache/foundclub-affiche-club-ecusson-post-club-1.png';
const PDF_PARAMS = { ...PNG_PARAMS, format: 'a4' };
const PDF_PATH = '/data/cache/foundclub-affiche-club-ecusson-a4-club-1.pdf';

/**
 * Reponse de rendu serveur : le type MIME decide de l'extension ecrite au cache.
 * @param {string} contentType
 * @returns {object}
 */
const renderResponse = (contentType) => ({
  base64: () => 'QUJD',
  info: () => ({ headers: { 'Content-Type': contentType }, status: 200 }),
});

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  Platform.Version = 34;
  ReactNativeBlobUtil.fetch.mockResolvedValue(renderResponse('image/png'));
  ReactNativeBlobUtil.fs.writeFile.mockResolvedValue(undefined);
  ReactNativeBlobUtil.MediaCollection.copyToMediaStore.mockResolvedValue('content://media/1');
  ReactNativeBlobUtil.android.actionViewIntent.mockResolvedValue(true);
  ReactNativeBlobUtil.android.addCompleteDownload.mockResolvedValue(undefined);
  PermissionsAndroid.request.mockResolvedValue('granted');
  Share.share.mockResolvedValue({ action: 'sharedAction' });
});

describe('L20 — la capacite annoncee est l UNIQUE Platform.OS de la chaine', () => {
  it('Android annonce « enregistrer puis ouvrir »', () => {
    Platform.OS = 'android';
    expect(getFileShareCapability()).toBe(FILE_SHARE_CAPABILITIES.SAVE_THEN_OPEN);
  });

  it('iOS annonce « feuille de partage »', () => {
    Platform.OS = 'ios';
    expect(getFileShareCapability()).toBe(FILE_SHARE_CAPABILITIES.SHARE_SHEET);
  });

  it('le web annonce aussi « feuille de partage » (navigator.share / telechargement)', () => {
    Platform.OS = 'web';
    expect(getFileShareCapability()).toBe(FILE_SHARE_CAPABILITIES.SHARE_SHEET);
  });
});

describe('L20 — le defaut caracterise (E6) ne peut plus revenir', () => {
  // CARACTERISATION E6, ecrite AVANT la correction et VERTE sur le code livre :
  //   « sur Android, le fichier est confie a Share.share, et rien ne l enregistre
  //     ni ne l ouvre » -> Share.share appele avec { message, url }, et
  //     copyToMediaStore / actionViewIntent / addCompleteDownload jamais appeles.
  // RN 0.78 (node_modules/react-native/Libraries/Share/Share.js l.91-107) purge
  // `url` sur Android : l'app croyait avoir partage l'affiche, le fichier restait
  // au cache et la fenetre de partage s'ouvrait VIDE. Le test ci-dessous est
  // l'exacte inversion de cette caracterisation.
  it('sur Android, l affiche n est plus confiee a la feuille de partage qui la jette', async () => {
    Platform.OS = 'android';

    await downloadAndShareRender(PNG_PARAMS);

    expect(Share.share).not.toHaveBeenCalled();
    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalled();
  });
});

describe('L20 — sur Android, l affiche est ENREGISTREE au lieu d etre perdue', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('une image part dans la galerie du telephone', async () => {
    const result = await downloadAndShareRender(PNG_PARAMS);

    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/png' }),
      'Image',
      PNG_PATH,
    );
    expect(result.outcome).toBe('gallery');
  });

  it('un PDF part dans les telechargements', async () => {
    ReactNativeBlobUtil.fetch.mockResolvedValue(renderResponse('application/pdf'));

    const result = await downloadAndShareRender(PDF_PARAMS);

    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf' }),
      'Download',
      PDF_PATH,
    );
    expect(result.outcome).toBe('downloads');
  });

  it('puis le selecteur d application s ouvre sur le fichier enregistre', async () => {
    const result = await downloadAndShareRender({ ...PNG_PARAMS, dialogTitle: 'Ouvrir avec…' });

    expect(ReactNativeBlobUtil.android.actionViewIntent).toHaveBeenCalledWith(
      PNG_PATH,
      'image/png',
      'Ouvrir avec…',
    );
    expect(result.opened).toBe(true);
  });

  it('Android 9 et anterieur : MediaStore.Downloads n existe pas, le gestionnaire de telechargements prend le relais', async () => {
    Platform.Version = 28;
    ReactNativeBlobUtil.fetch.mockResolvedValue(renderResponse('application/pdf'));
    ReactNativeBlobUtil.MediaCollection.copyToMediaStore.mockRejectedValue(
      new Error('File could not be created'),
    );

    const result = await downloadAndShareRender(PDF_PARAMS);

    expect(ReactNativeBlobUtil.android.addCompleteDownload).toHaveBeenCalledWith(
      expect.objectContaining({ mime: 'application/pdf', path: PDF_PATH }),
    );
    expect(result.outcome).toBe('downloads');
  });
});

describe('L20 — un refus se dit, il ne se tait pas', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('permission d ecriture refusee (Android 9 et anterieur) : erreur porteuse, rien n est ecrit', async () => {
    Platform.Version = 28;
    PermissionsAndroid.request.mockResolvedValue('denied');

    await expect(downloadAndShareRender(PNG_PARAMS)).rejects.toMatchObject({
      reason: 'permission_denied',
    });
    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).not.toHaveBeenCalled();
  });

  it('Android 10 et au-dela : aucune permission n est demandee', async () => {
    Platform.Version = 29;

    await downloadAndShareRender(PNG_PARAMS);

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });

  it('enregistrement impossible (disque plein) : erreur porteuse', async () => {
    ReactNativeBlobUtil.MediaCollection.copyToMediaStore.mockRejectedValue(new Error('ENOSPC'));

    await expect(downloadAndShareRender(PNG_PARAMS)).rejects.toMatchObject({
      reason: 'save_failed',
    });
  });

  it('aucune application pour ouvrir le fichier : l enregistrement RESTE un succes', async () => {
    ReactNativeBlobUtil.android.actionViewIntent.mockRejectedValue(new Error('ENOAPP'));

    const result = await downloadAndShareRender(PNG_PARAMS);

    expect(result).toMatchObject({ opened: false, outcome: 'gallery' });
  });
});

describe('TEMOIN POSITIF — iOS ne change pas', () => {
  it('le fichier part toujours par la feuille de partage native, avec son message', async () => {
    const result = await downloadAndShareRender(PNG_PARAMS);

    expect(Share.share).toHaveBeenCalledWith({
      message: PNG_PARAMS.message,
      url: `file://${PNG_PATH}`,
    });
    expect(result.outcome).toBe('shareSheet');
  });

  it('sans message a joindre, la charge reste reduite au fichier (comportement livre)', async () => {
    await downloadAndShareRender({ ...PNG_PARAMS, message: undefined });

    expect(Share.share).toHaveBeenCalledWith({ url: `file://${PNG_PATH}` });
  });

  it('aucune ecriture Android n est declenchee sur iOS', async () => {
    await downloadAndShareRender(PNG_PARAMS);

    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).not.toHaveBeenCalled();
    expect(ReactNativeBlobUtil.android.actionViewIntent).not.toHaveBeenCalled();
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });
});
