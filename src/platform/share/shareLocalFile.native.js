// @ts-nocheck
/**
 * app/src/platform/share/shareLocalFile.native.js
 *
 * La fonction qui FAIT ce que `getFileShareCapability()` annonce, pour un fichier
 * deja ecrit sur le telephone. Un seul appelant possible par plateforme :
 *
 *   - `share-sheet` (iOS) : `Share.share({ url })` — LE FICHIER SEUL. La phrase
 *     part au presse-papiers, comme sur Android (voir U06 plus bas).
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
 * Fichier `.native` volontaire : il importe `react-native-blob-util`, qui n'a de
 * sens que sur mobile. Le web resout le jumeau `shareLocalFile.web.js` — ajoute
 * par L27, parce que `useShareCard.js` (carte joueur) est compile par Vite ET
 * par Metro, et que `.native.js` n'est PAS dans `resolve.extensions` de
 * web/vite.config.ts : sans ce jumeau, la seule importation depuis un fichier
 * sans suffixe de plateforme casse la compilation du site.
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

/**
 * Presse-papiers, charge a la demande — MEME motif que `Conversation.js:300` et
 * `SuperAdminEntryList.js:44`, qui le font deja pour la meme raison : la
 * dependance est facultative, un build sans elle ne doit pas casser l ecran.
 * @returns {any | null}
 */
let clipboardModule;
const getClipboardModule = () => {
  if (clipboardModule !== undefined) return clipboardModule;
  try {
    // eslint-disable-next-line global-require
    const maybeModule = require('@react-native-clipboard/clipboard');
    clipboardModule = maybeModule?.default || maybeModule;
    return clipboardModule;
  } catch (_error) {
    clipboardModule = null;
    return null;
  }
};

/**
 * R05 : SAUVE LA PHRASE QUE `actionViewIntent` NE SAIT PAS TRANSPORTER.
 *
 * 🧨 Le defaut mesure : sur Android, `message` arrivait jusqu ici et n etait
 * JAMAIS LU. Un ACTION_VIEW ouvre un fichier, il ne porte aucun texte — les
 * 7 phrases par type d evenement (D94) mouraient donc a cette ligne, sans
 * erreur. Un vrai ACTION_SEND demanderait une dependance de plus (note L20) ;
 * le presse-papiers, lui, est deja la.
 *
 * ⛔ TOUJOURS un BONUS : quand on arrive ici le fichier est deja a l abri. Un
 * presse-papiers absent ou en echec ne transforme pas un enregistrement reussi
 * en echec — il rend seulement `false`, et l ecran se tait.
 * @param {string} [message]
 * @returns {boolean} La phrase est-elle collable ?
 */
const copyMessageToClipboard = (message) => {
  if (!message) return false;
  try {
    const clipboard = getClipboardModule();
    if (!clipboard?.setString) return false;
    clipboard.setString(message);
    return true;
  } catch (_error) {
    return false;
  }
};

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
 * @param {string} [params.title] - Titre de la charge partagee (feuille de partage).
 * @returns {Promise<{ opened: boolean, outcome: string }>}
 */
export const shareLocalFile = async ({
  dialogTitle, fileName, fileUri, message, mimeType, title,
}) => {
  if (getFileShareCapability() !== FILE_SHARE_CAPABILITIES.SAVE_THEN_OPEN) {
    // 🍏 U06 — LE FICHIER SEUL, ET C'EST UNE CORRECTION, PAS UN APPAUVRISSEMENT.
    //
    // 🧨 Mesure (recette du 18/08, iPhone) : `Share.share({ message, url })`
    // construit sur iOS DEUX elements a partager — une NSString et une NSURL.
    //   · « Enregistrer l'image » n'accepte que des images : la chaine fait
    //     echouer TOUT le geste -> « echec du telechargement » ;
    //   · « Enregistrer dans Fichiers » accepte les deux, et ecrit donc le
    //     fichier PLUS la chaine, cette derniere en `.txt`.
    //     ⇒ LE SECOND FICHIER INUTILE, C'ETAIT LE MESSAGE.
    //
    // La phrase n'est pas perdue pour autant : elle part au presse-papiers,
    // exactement la voie deja retenue pour Android (R05). Un partage de LIEN ne
    // passe pas par ici et garde son `message`.
    //
    // `title` reste transmis, et pour une raison mesuree : iOS ne le lit pas
    // (Share.js l.113-141 n'envoie que message/url/options.subject) mais le WEB,
    // si (`share.web.js` -> `navigator.share({ title })`).
    const messageCopied = copyMessageToClipboard(message);
    await SharePlatform.share({
      ...(title ? { title } : {}),
      url: fileUri,
    });
    return { messageCopied, opened: true, outcome: FILE_SHARE_OUTCOMES.SHARE_SHEET };
  }

  const path = stripFileScheme(fileUri);
  const isImage = String(mimeType || '').startsWith('image/');

  if (!await ensureLegacyWritePermission()) {
    throw fileShareError(FILE_SHARE_FAILURES.PERMISSION_DENIED);
  }

  const outcome = await saveToDevice({
    fileName, isImage, mimeType, path,
  });

  // R05 : la phrase AVANT l'ouverture — elle doit etre collable au moment ou
  // l'utilisateur arrive dans l'application qu'il a choisie.
  const messageCopied = copyMessageToClipboard(message);

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

  return { messageCopied, opened, outcome };
};

export default {
  shareLocalFile,
};
