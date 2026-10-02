import { keepLocalCopy, pick } from '@react-native-documents/picker';
import i18next from 'i18next';
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

/**
 * Le sélecteur de documents.
 *
 * 🐞 COLL-FIX-PLANNING (02/10/2026, tournée T9) — `localCopy: true` : chaque document choisi est
 * d'abord COPIÉ dans le cache de l'app, et le fichier rendu porte l'adresse de la copie
 * (`file://`) au lieu de l'adresse `content://` du sélecteur. C'est le chemin de la messagerie
 * (Conversation.js, handlePickFile), qui envoie des documents ; l'actualité de la Ville, qui
 * envoyait l'adresse du sélecteur, échouait sans qu'aucune requête parte. Une copie ratée garde
 * l'adresse d'origine (même repli que la messagerie). Sans l'option, rien ne change.
 * @param {Record<string, any> & { localCopy?: boolean }} [options]
 * @returns {Promise<any[]>} Les documents choisis.
 */
export const pickDocument = async ({ localCopy = false, ...options } = {}) => {
  const choisis = await pick(/** @type {any} */ (options));
  if (!localCopy) return choisis;
  const copies = await keepLocalCopy({
    destination: 'cachesDirectory',
    files: /** @type {any} */ (choisis.map((fichier) => ({
      fileName: fichier.name || `document-${Date.now()}`,
      uri: fichier.uri,
    }))),
  });
  return choisis.map((fichier, rang) => {
    const copie = copies[rang];
    return copie?.status === 'success' ? { ...fichier, uri: copie.localUri } : fichier;
  });
};

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
  throw new Error(i18next.t(
    'media.errors.voiceNoteNotAdapted',
    'L enregistrement vocal n est pas encore adapte via platform/media.',
  ));
};

export default {
  capturePhoto,
  getLocalFileSize,
  pickDocument,
  pickImage,
  recordVoiceNote,
};
