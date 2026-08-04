// @ts-nocheck
/**
 * app/src/platform/share/shareLocalFile.native.js
 *
 * La fonction qui FAIT ce que `getFileShareCapability()` annonce, pour un fichier
 * deja ecrit sur le telephone. Un seul appelant possible par plateforme :
 *
 *   - `share-sheet` (iOS) : `Share.share({ message, url })` — INCHANGE. La feuille
 *     de partage iOS transporte le fichier ET le texte dans le meme appel.
 *   - `save-then-open` (Android) : le fichier est d'abord MIS A L'ABRI (galerie
 *     pour une image, telechargements pour le reste), puis une application est
 *     proposee pour l'ouvrir. L'ordre compte : le selecteur peut echouer, pas
 *     l'enregistrement.
 *
 * ⚠️ `actionViewIntent` envoie un ACTION_VIEW (« ouvrir avec »), PAS un
 * ACTION_SEND (« envoyer vers Instagram / WhatsApp »). Un vrai partage sortant
 * Android demande un intent ACTION_SEND avec un URI `content://`, que ni React
 * Native ni `react-native-blob-util` ne fournissent — cf. la note `react-native-share`
 * du compte rendu L20. Le libelle de l'ecran dit donc « enregistrer puis ouvrir »,
 * il ne promet pas d'envoyer.
 *
 * Fichier `.native` volontaire : il importe `react-native-blob-util`, qui n'existe
 * pas sur le web. Le web resout `visualRender.web.js`, qui telecharge via <a download>
 * et ne passe jamais ici — une importation web echouerait bruyamment a la compilation
 * (`.native.js` n'est pas dans `resolve.extensions` de web/vite.config.ts), ce qui
 * est exactement le garde-fou voulu.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  FILE_SHARE_CAPABILITIES, FILE_SHARE_FAILURES, FILE_SHARE_OUTCOMES, getFileShareCapability,
} from './fileShareContract';
// Même suffixe de plateforme que `share/index.js` : Metro et Jest résolvent
// share.native.js, le résolveur du linter non (mêmes 2 alertes sur tous les
// index.js de `src/platform/`). On passe par ce module plutôt que d'appeler
// `Share.share` en direct : un seul point d'entrée vers l'API de React Native.
// eslint-disable-next-line import/extensions, import/no-unresolved -- cf. ci-dessus
import SharePlatform from './share';

/** Sous-dossier des affiches dans la galerie / les telechargements du telephone. */
const MEDIA_PARENT_FOLDER = 'FoundClub';

/** Android 10 (API 29) : MediaStore ecrit sans permission. En deca, il en faut une. */
const ANDROID_SCOPED_STORAGE_VERSION = 29;

/**
 * Erreur porteuse : `reason` traverse jusqu'a l'ecran, qui en tire une phrase.
 * Une erreur nue produirait le message generique « verifie ta connexion » alors
 * que la connexion n'est pas en cause.
 * @param {string} reason - Une valeur de FILE_SHARE_FAILURES.
 * @param {Error} [cause]
 * @returns {Error}
 */
const fileShareError = (reason, cause) => {
  const error = new Error(cause?.message ? `${reason}: ${cause.message}` : reason);
  error.reason = reason;
  return error;
};

/**
 * `file:///a/b` -> `/a/b` : les API Android de blob-util attendent un chemin nu.
 * @param {string} fileUri
 * @returns {string}
 */
const stripFileScheme = (fileUri) => String(fileUri || '').replace(/^file:\/\//, '');

/**
 * Android 9 et anterieur (API < 29) : ecrire dans les dossiers publics exige encore
 * WRITE_EXTERNAL_STORAGE. A partir d'Android 10, MediaStore s'en passe.
 * Meme regle que `useShareCard.ensureLegacyWritePermission` (enregistrement de la
 * carte joueur) — la version d'Android decide, pas la fonctionnalite.
 * @returns {Promise<boolean>}
 */
const ensureLegacyWritePermission = async () => {
  if (Number(Platform.Version) >= ANDROID_SCOPED_STORAGE_VERSION) return true;
  const status = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  return status === PermissionsAndroid.RESULTS.GRANTED;
};

/**
 * Met le fichier a l'abri dans un dossier que l'utilisateur sait retrouver.
 * @param {{ fileName: string, isImage: boolean, mimeType: string, path: string }} params
 * @returns {Promise<string>} - Une valeur de FILE_SHARE_OUTCOMES.
 */
const saveToDevice = async ({
  fileName, isImage, mimeType, path,
}) => {
  try {
    await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
      { mimeType, name: fileName, parentFolder: MEDIA_PARENT_FOLDER },
      isImage ? 'Image' : 'Download',
      path,
    );
    return isImage ? FILE_SHARE_OUTCOMES.GALLERY : FILE_SHARE_OUTCOMES.DOWNLOADS;
  } catch (mediaStoreError) {
    // MediaStore.Downloads n'existe qu'a partir d'Android 10 : en deca, la
    // collection est absente et l'entree ne peut pas etre creee. Le gestionnaire
    // de telechargements du systeme, lui, existe depuis toujours.
    if (isImage) throw fileShareError(FILE_SHARE_FAILURES.SAVE_FAILED, mediaStoreError);
    try {
      await ReactNativeBlobUtil.android.addCompleteDownload({
        description: fileName,
        mime: mimeType,
        path,
        showNotification: true,
        title: fileName,
      });
      return FILE_SHARE_OUTCOMES.DOWNLOADS;
    } catch (downloadManagerError) {
      throw fileShareError(FILE_SHARE_FAILURES.SAVE_FAILED, downloadManagerError);
    }
  }
};

/**
 * Confie un fichier local au systeme, selon ce que la plateforme sait faire.
 * @param {object} params
 * @param {string} [params.dialogTitle] - Titre du selecteur d'application (Android).
 * @param {string} params.fileName - Nom vu par l'utilisateur dans sa galerie.
 * @param {string} params.fileUri - `file://…` du fichier deja ecrit.
 * @param {string} [params.message] - Texte joint au fichier (feuille de partage).
 * @param {string} params.mimeType
 * @returns {Promise<{ opened: boolean, outcome: string }>}
 */
export const shareLocalFile = async ({
  dialogTitle, fileName, fileUri, message, mimeType,
}) => {
  if (getFileShareCapability() !== FILE_SHARE_CAPABILITIES.SAVE_THEN_OPEN) {
    // iOS : charge identique a celle livree avant L20 — `message` reste optionnel.
    await SharePlatform.share({ ...(message ? { message } : {}), url: fileUri });
    return { opened: true, outcome: FILE_SHARE_OUTCOMES.SHARE_SHEET };
  }

  const path = stripFileScheme(fileUri);
  const isImage = String(mimeType || '').startsWith('image/');

  if (!await ensureLegacyWritePermission()) {
    throw fileShareError(FILE_SHARE_FAILURES.PERMISSION_DENIED);
  }

  const outcome = await saveToDevice({
    fileName, isImage, mimeType, path,
  });

  // Le fichier est deja a l'abri : proposer une application est un BONUS.
  // Aucune application pour ce type (ENOAPP) ou retour en arriere de l'utilisateur
  // n'annule un enregistrement reussi — sinon l'ecran afficherait un echec faux.
  let opened = false;
  try {
    await ReactNativeBlobUtil.android.actionViewIntent(path, mimeType, dialogTitle);
    opened = true;
  } catch (openError) {
    opened = false;
  }

  return { opened, outcome };
};

export default {
  shareLocalFile,
};
