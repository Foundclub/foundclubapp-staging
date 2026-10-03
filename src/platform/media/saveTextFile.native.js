// @ts-nocheck
/**
 * app/src/platform/media/saveTextFile.native.js
 *
 * COLL-C5 (03/10/2026) — ENREGISTRER un fichier TEXTE déjà en mémoire (l'export CSV des chiffres de
 * la Ville, planche 30 : « Un tableau pour le service »).
 *
 * 🧩 Jumeau de `downloadRemoteFile.native.js`, qui RAPATRIE un fichier du serveur par son
 * adresse. Ici le fichier est lu par le client HTTP de l'app (avec le jeton du compte : la route
 * est gardée), il n'y a donc rien à rapatrier : on l'écrit dans le cache, puis `shareLocalFile`
 * le pose (Téléchargements sur Android, feuille de partage sur iOS) et rend une issue NOMMÉE.
 * ⛔ Aucune règle de plateforme ici : le `Platform.OS` reste l'unique de `fileShareContract`.
 * `react-native-blob-util` et `shareLocalFile` sont chargés À LA DEMANDE, pour la raison
 * écrite dans `downloadRemoteFile.native.js` (un import en tête fait tomber des suites qui ne le
 * doublent pas).
 */

const blobUtil = () => {
  // eslint-disable-next-line global-require -- chargement a la demande, cf. ci-dessus
  const module = require('react-native-blob-util');
  return module?.default || module;
};

const getShareLocalFile = () => {
  // eslint-disable-next-line global-require -- cf. ci-dessus
  const module = require('@/platform/share/shareLocalFile');
  return module.shareLocalFile;
};

/**
 * Écrit le texte dans le cache, puis le confie à la plateforme.
 * @param {object} params
 * @param {string} params.contenu - Le texte (UTF-8 ; la marque d'un CSV est déjà dedans).
 * @param {string} params.fileName - Le nom du fichier dans le téléphone.
 * @param {string} [params.mimeType] - Le type, pour le sélecteur Android.
 * @returns {Promise<{ opened: boolean, outcome: string }>} L'issue, nommée.
 */
export const saveTextFile = async ({ contenu, fileName, mimeType = 'text/plain' }) => {
  const blob = blobUtil();
  const dossier = blob?.fs?.dirs?.CacheDir || blob?.fs?.dirs?.DocumentDir;
  const chemin = `${dossier}/${Date.now()}-${fileName}`;
  await blob.fs.writeFile(chemin, String(contenu ?? ''), 'utf8');
  return getShareLocalFile()({ fileName, fileUri: `file://${chemin}`, mimeType });
};

export default { saveTextFile };
