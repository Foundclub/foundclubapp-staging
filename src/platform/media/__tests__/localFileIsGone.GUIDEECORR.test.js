import ReactNativeBlobUtil from 'react-native-blob-util';

import { localFileIsGone } from '../media.native';

// GUIDE-E-CORR (TG-03, tournée du 07/11) : le logo choisi, copié dans le cache par
// react-native-image-picker, avait disparu au moment de l'envoi (ENOENT). L'écran relit le fichier.

jest.mock('@react-native-documents/picker', () => ({ keepLocalCopy: jest.fn(), pick: jest.fn() }));
jest.mock('react-native-blob-util', () => ({ fs: { exists: jest.fn(), stat: jest.fn() } }));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

const { fs: { exists } } = /** @type {any} */ (ReactNativeBlobUtil);
const CACHE = 'file:///data/user/0/com.foundclub/cache/rn_image_picker_lib_temp_1.png';

beforeEach(() => exists.mockReset());

it('fichier du cache disparu : vrai, et le chemin est lu sans « file:// »', async () => {
  exists.mockResolvedValue(false);
  await expect(localFileIsGone(CACHE)).resolves.toBe(true);
  expect(exists).toHaveBeenCalledWith('/data/user/0/com.foundclub/cache/rn_image_picker_lib_temp_1.png');
});

it('fichier présent : faux', async () => {
  exists.mockResolvedValue(true);
  await expect(localFileIsGone(CACHE)).resolves.toBe(false);
});

it.each([undefined, '', 'https://cdn.foundclub.app/logo.png', 'content://media/42'])(
  'adresse non locale (%s) : faux, rien n est lu',
  async (uri) => {
    await expect(localFileIsGone(uri)).resolves.toBe(false);
    expect(exists).not.toHaveBeenCalled();
  },
);

it('lecture impossible : faux, on ne bloque pas l envoi sur une supposition', async () => {
  exists.mockRejectedValue(new Error('EACCES'));
  await expect(localFileIsGone(CACHE)).resolves.toBe(false);
});
