// @ts-nocheck
/**
 * app/src/platform/media/downloadRemoteFile.native.js
 *
 * AA07 / K2 — TELECHARGER un fichier qui vit sur le SERVEUR.
 *
 * 🗣️ Adel, recette du 2026-08-20 : « on doit pouvoir telecharger le document ».
 * L app ne savait faire qu une chose des documents de cotisation :
 * `LinksPlatform.openUrl(url)`, c est-a-dire les OUVRIR dans le navigateur. Le
 * fichier ne se posait jamais dans le telephone — et un bouton nomme
 * « Telecharger le modele » faisait donc autre chose que ce qu il disait.
 *
 * 🧩 CE QUI EXISTAIT DEJA, ET QU ON NE REECRIT PAS (§1 bis, barreau 2) :
 * `shareLocalFile` sait deja mettre un fichier LOCAL a l abri — galerie ou
 * telechargements sur Android, feuille de partage sur iOS — et rend une issue
 * NOMMEE (`FILE_SHARE_OUTCOMES`). Il ne lui manquait qu une chose : le fichier
 * n etait pas local. Ce module ne fait donc QUE le rapatrier, puis lui passe la
 * main. ⛔ Aucune regle de plateforme dupliquee ici : le `Platform.OS` de la
 * chaine reste l unique de `fileShareContract`.
 *
 * ⚠️ Le repli en cache est volontairement dans `CacheDir` : le fichier definitif
 * est celui que `shareLocalFile` ecrit. Laisser une copie dans les documents de
 * l app ferait grossir le telephone sans que personne ne puisse l effacer.
 */

/**
 * `shareLocalFile` et `react-native-blob-util`, charges A LA DEMANDE — MEME motif que le
 * presse-papiers de `shareLocalFile.native.js:50` et que `Conversation.js:300`.
 *
 * — MEME motif que le presse-papiers de `shareLocalFile.native.js:50` et que
 * `Conversation.js:300`, qui le font deja pour la meme raison.
 *
 * 🔬 POURQUOI, ET C EST MESURE : `react-native-blob-util` n est pas dans les
 * `transformIgnorePatterns` du projet, et 9 suites le mockent deja une par une.
 * Atteint par un import EN TETE, il remontait la chaine
 * `downloadRemoteFile` -> `MyLicense` / `ClubLicenseMemberDetail` et faisait
 * tomber 2 suites qui n avaient aucune raison de le connaitre
 * (`ClubLicenseMemberDetail.aPaye` et `.aPayer`).
 *
 * ⛔ CE QU ON NE FAIT PAS, ET POURQUOI : ni elargir `jest.config.js` (il sert
 * les 303 suites), ni retoucher `shareLocalFile.native.js` (il sert la carte
 * joueur et les affiches). Le detour reste DANS ce fichier neuf, la ou il ne
 * peut casser que lui. Effet de bord utile : un build sans la dependance
 * n emporte plus l ecran de cotisation avec lui.
 * @returns {any} le module natif
 */
const blobUtil = () => {
  // eslint-disable-next-line global-require -- chargement a la demande, cf. ci-dessus
  const module = require('react-native-blob-util');
  return module?.default || module;
};

/**
 * @returns {(params: any) => Promise<any>} la remise du fichier a la plateforme
 */
const getShareLocalFile = () => {
  // Meme suffixe de plateforme que `share/index.js` : Metro et Jest resolvent
  // le jumeau `.native`, le resolveur du linter non.
  // eslint-disable-next-line global-require, import/extensions, import/no-unresolved -- cf. ci-dessus
  return require('@/platform/share/shareLocalFile').shareLocalFile;
};

/** Ce qui a empeche le telechargement — porte par `error.reason`, jamais un silence. */
export const DOWNLOAD_FAILURES = {
  EMPTY_FILE: 'empty_file',
  HTTP_ERROR: 'http_error',
  NO_URL: 'no_url',
};

/**
 * Extension deduite de l URL, pour que le fichier pose dans le telephone garde
 * un nom qu une application sait ouvrir.
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
 * Rapatrie un fichier distant puis le confie a la plateforme.
 * @param {object} params
 * @param {string} params.url adresse du fichier sur le serveur
 * @param {string} [params.fileName] nom souhaite dans le telephone
 * @param {string} [params.mimeType] type du fichier, pour le selecteur Android
 * @returns {Promise<{ opened: boolean, outcome: string }>} l issue, nommee
 */
export const downloadRemoteFile = async ({ fileName, mimeType, url }) => {
  const adresse = String(url || '').trim();
  if (!adresse) {
    const erreur = new Error('Aucune adresse de fichier a telecharger.');
    erreur.reason = DOWNLOAD_FAILURES.NO_URL;
    throw erreur;
  }

  const extension = extensionDeLUrl(adresse);
  const blob = blobUtil();
  const dossierCache = blob?.fs?.dirs?.CacheDir
    || blob?.fs?.dirs?.DocumentDir;
  const nomLocal = String(fileName || `foundclub-document.${extension}`);
  const cheminCible = `${dossierCache}/${Date.now()}-${nomLocal}`;

  const reponse = await blob
    .config({ fileCache: true, overwrite: true, path: cheminCible })
    .fetch('GET', adresse);

  const infos = reponse?.info?.() || {};
  const code = Number(infos?.status || 0);
  if (code >= 400) {
    const erreur = new Error(`Le serveur a refuse le fichier (${code}).`);
    erreur.reason = DOWNLOAD_FAILURES.HTTP_ERROR;
    erreur.status = code;
    throw erreur;
  }

  const cheminTelecharge = String(reponse?.path?.() || cheminCible);
  const stat = await blob.fs.stat(
    cheminTelecharge.replace(/^file:\/\//, ''),
  );
  if (!Number(stat?.size || 0)) {
    const erreur = new Error('Le fichier telecharge est vide.');
    erreur.reason = DOWNLOAD_FAILURES.EMPTY_FILE;
    throw erreur;
  }

  return getShareLocalFile()({
    fileName: nomLocal,
    fileUri: cheminTelecharge.startsWith('file://') ? cheminTelecharge : `file://${cheminTelecharge}`,
    mimeType: mimeType || undefined,
  });
};

export default {
  DOWNLOAD_FAILURES,
  downloadRemoteFile,
  extensionDeLUrl,
};
