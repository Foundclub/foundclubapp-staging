// @ts-nocheck
/**
 * app/src/platform/media/downloadRemoteFile.web.js
 *
 * Jumeau WEB de `downloadRemoteFile.native.js`. Il existe pour une raison de
 * RESOLUTION autant que de comportement : `MyLicense.js` est compile par Metro
 * ET par Vite (`web/vite.config.ts` pointe `../app/src`), or `.native.js` n est
 * pas dans `resolve.extensions` du site. Sans ce fichier, la seule presence de
 * l import casserait la compilation web — exactement le defaut deja paye par
 * `shareLocalFile.web.js` (L27) et par la carte joueur.
 *
 * 🌐 CE QUE FAIT LE WEB, ET POURQUOI C EST DIFFERENT : le navigateur SAIT deja
 * telecharger. On ne rapatrie donc rien a la main — on lui confie l adresse, et
 * il applique sa propre regle (enregistrement ou affichage selon le type). Le
 * detour par le cache de `react-native-blob-util` n aurait aucun sens ici : ce
 * module n existe pas sur le web.
 *
 * La forme de retour est IDENTIQUE au jumeau natif, pour qu un ecran partage
 * n ait jamais a demander sur quelle plateforme il tourne.
 */

import { FILE_SHARE_OUTCOMES } from '@/platform/share/fileShareContract';

// Meme suffixe de plateforme que les autres modules de `src/platform/` : Vite
// resout le jumeau `.web`, le resolveur du linter non.

import LinksPlatform from '@/platform/links';

/** Meme vocabulaire d echec que le jumeau natif. */
export const DOWNLOAD_FAILURES = {
  EMPTY_FILE: 'empty_file',
  HTTP_ERROR: 'http_error',
  NO_URL: 'no_url',
};

/**
 * Extension deduite de l URL — meme regle que le jumeau natif.
 * @param {string} url adresse du fichier
 * @param {string} secours extension a utiliser si l URL n en porte pas
 * @returns {string} l extension, sans le point
 */
export const extensionDeLUrl = (url, secours = 'pdf') => {
  const chemin = String(url || '').split('?')[0].split('#')[0];
  const trouvee = chemin.match(/\.([a-z0-9]{2,5})$/i);
  return trouvee ? trouvee[1].toLowerCase() : secours;
};

/**
 * Confie l adresse au navigateur, qui applique sa propre regle de
 * telechargement.
 * @param {object} params
 * @param {string} params.url adresse du fichier sur le serveur
 * @returns {Promise<{ opened: boolean, outcome: string }>} l issue, nommee
 */
export const downloadRemoteFile = async ({ url }) => {
  const adresse = String(url || '').trim();
  if (!adresse) {
    const erreur = new Error('Aucune adresse de fichier a telecharger.');
    erreur.reason = DOWNLOAD_FAILURES.NO_URL;
    throw erreur;
  }

  await LinksPlatform.openUrl(adresse);
  return { opened: true, outcome: FILE_SHARE_OUTCOMES.SHARE_SHEET };
};

export default {
  DOWNLOAD_FAILURES,
  downloadRemoteFile,
  extensionDeLUrl,
};
