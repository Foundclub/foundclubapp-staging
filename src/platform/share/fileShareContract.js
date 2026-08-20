// @ts-nocheck
/**
 * app/src/platform/share/fileShareContract.js
 *
 * LE SEUL endroit ou la plateforme decide du sort d'un FICHIER LOCAL.
 *
 * Pourquoi ce fichier existe : le defaut corrige par L20 vient d'un `Platform.OS`
 * pose au milieu d'un appel de partage (visualRender.native.js), sans que personne
 * ne puisse voir, depuis l'ecran, ce que la plateforme allait reellement faire.
 * Ici la decision est nommee UNE fois :
 *   - `getFileShareCapability()` dit CE QUI VA SE PASSER (les libelles s'y accrochent) ;
 *   - `shareLocalFile.native.js` FAIT ce que cette capacite annonce ;
 *   - `FILE_SHARE_OUTCOMES` / `FILE_SHARE_FAILURES` disent ce qui s'est passe,
 *     pour qu'un succes comme un refus arrive a l'ecran au lieu de se taire.
 *
 * Fichier volontairement SANS suffixe de plateforme (ni `.native`, ni `.web`) :
 * il est resolu a l'identique par Metro, Jest et Vite, donc un ecran partage
 * (EventPublishedShowcase.js) peut l'importer sans casser la compilation web.
 */

import { Platform } from 'react-native';

/** Ce que l'utilisateur va obtenir en pressant le bouton — base des libelles. */
export const FILE_SHARE_CAPABILITIES = {
  /** Android : le fichier est enregistre dans le telephone, puis une application l'ouvre. */
  SAVE_THEN_OPEN: 'save-then-open',
  /** iOS / web : la feuille de partage du systeme transporte le fichier elle-meme. */
  SHARE_SHEET: 'share-sheet',
};

/** Ce qui s'est reellement passe — l'ecran en tire sa phrase de confirmation. */
export const FILE_SHARE_OUTCOMES = {
  DOWNLOADS: 'downloads',
  GALLERY: 'gallery',
  SHARE_SHEET: 'shareSheet',
};

/** Pourquoi ca n'a pas marche — porte par `error.reason`, jamais un silence. */
export const FILE_SHARE_FAILURES = {
  PERMISSION_DENIED: 'permission_denied',
  /**
   * AA08 : le SERVEUR de rendu n'a pas rendu le fichier (HTTP >= 400).
   * 🧨 Pourquoi cette cause manquait : sans elle, un rendu A4 refuse retombait
   * sur le message generique « Verifie ta connexion » — alors que l'apercu
   * venait d'arriver par le MEME reseau et le MEME jeton. On envoyait
   * l'utilisateur regarder son wifi pendant que la panne etait ailleurs.
   */
  RENDER_FAILED: 'render_failed',
  SAVE_FAILED: 'save_failed',
};

/**
 * L'UNIQUE `Platform.OS` de la chaine de partage de fichier.
 *
 * Android : `Share.share` de React Native 0.78 PURGE `url` avant d'appeler le
 * module natif (node_modules/react-native/Libraries/Share/Share.js, l.91-107),
 * la ou iOS transmet `message` ET `url`. Un fichier confie a la feuille de
 * partage y disparait donc sans erreur — d'ou une capacite differente, assumee
 * et nommee, plutot qu'un partage qui echoue en silence.
 * @returns {string} - Une valeur de FILE_SHARE_CAPABILITIES.
 */
export const getFileShareCapability = () => (Platform.OS === 'android'
  ? FILE_SHARE_CAPABILITIES.SAVE_THEN_OPEN
  : FILE_SHARE_CAPABILITIES.SHARE_SHEET);

export default {
  FILE_SHARE_CAPABILITIES,
  FILE_SHARE_FAILURES,
  FILE_SHARE_OUTCOMES,
  getFileShareCapability,
};
