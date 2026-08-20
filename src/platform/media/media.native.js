import { pick } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import { PHOTO_PICKER_LIMITS } from './photoLimits';

// Y01 — les limites sont posées AVANT `...options` : la bibliothèque
// redimensionne nativement, et un appelant qui a besoin d'autre chose (l'avatar
// se contente de 1000 px) reste libre de les remplacer.
export const pickImage = async (options = {}) => launchImageLibrary({
  mediaType: 'photo',
  selectionLimit: 1,
  ...PHOTO_PICKER_LIMITS,
  ...options,
});

export const pickDocument = async (options = {}) => pick(options);

export const capturePhoto = async (options = {}) => launchCamera({
  mediaType: 'photo',
  saveToPhotos: false,
  ...PHOTO_PICKER_LIMITS,
  ...options,
});

/**
 * Y01 — taille RÉELLE d'un fichier local, en octets.
 *
 * Le dé-miroir C01 fabrique un nouveau fichier : la taille annoncée par
 * l'appareil photo ne décrit plus rien. On la remesure au lieu de l'effacer,
 * sinon le garde-fou de taille n'a plus rien à comparer.
 * @param {string} uri Chemin local (`file://…` ou chemin nu iOS).
 * @returns {Promise<number | undefined>} La taille, ou `undefined` si illisible.
 */
export const getLocalFileSize = async (uri) => {
  const chemin = String(uri || '').replace(/^file:\/\//, '');
  if (!chemin) return undefined;

  try {
    const infos = await ReactNativeBlobUtil.fs.stat(chemin);
    const taille = Number(infos?.size || 0);
    return taille > 0 ? taille : undefined;
  } catch (_error) {
    // Illisible : on ne devine pas. `undefined` = « non mesuré », et le
    // garde-fou ne refuse jamais ce qu'il n'a pas mesuré.
    return undefined;
  }
};

export const recordVoiceNote = async () => {
  throw new Error('L enregistrement vocal n est pas encore adapte via platform/media.');
};

export default {
  capturePhoto,
  getLocalFileSize,
  pickDocument,
  pickImage,
  recordVoiceNote,
};
