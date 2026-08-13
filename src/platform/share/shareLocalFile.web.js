// @ts-nocheck
/**
 * app/src/platform/share/shareLocalFile.web.js
 *
 * Jumeau WEB de `shareLocalFile.native.js`. Il existe pour une raison de
 * RESOLUTION, pas de comportement : `useShareCard.js` (carte joueur) est compile
 * par Metro ET par Vite (`PlayerCardScreen` est enregistre dans
 * web/src/routes/screenRegistry.tsx), or `.native.js` n'est pas dans
 * `resolve.extensions` de web/vite.config.ts. Sans ce fichier, la seule presence
 * de l'import casserait la compilation du site.
 *
 * Le comportement web, lui, est INCHANGE par L27 : `getFileShareCapability()`
 * rend `SHARE_SHEET` sur le web, et `share.web.js` fait deja exactement ce que
 * faisait l'appel direct — `navigator.share`, puis repli sur le presse-papier.
 *
 * `dialogTitle`, `fileName` et `mimeType` ne sont pas utilises ici : ils
 * decrivent le selecteur d'application et l'entree de galerie ANDROID. Ils sont
 * acceptes pour que la signature reste la meme des deux cotes.
 */

import { FILE_SHARE_OUTCOMES } from './fileShareContract';
// Meme suffixe de plateforme que `shareLocalFile.native.js` : Vite resout
// share.web.js, le resolveur du linter non (memes 2 alertes sur tous les
// index.js de `src/platform/`).
// eslint-disable-next-line import/extensions, import/no-unresolved -- cf. ci-dessus
import SharePlatform from './share';

/**
 * Confie un fichier local au navigateur : feuille de partage native quand elle
 * existe, presse-papier sinon (`share.web.js`).
 * @param {object} params
 * @param {string} params.fileUri - URL du fichier (objet blob ou data URI).
 * @param {string} [params.message] - Texte joint au fichier.
 * @param {string} [params.title] - Titre de la charge partagee.
 * @returns {Promise<{ opened: boolean, outcome: string }>}
 */
export const shareLocalFile = async ({ fileUri, message, title }) => {
  await SharePlatform.share({
    ...(message ? { message } : {}),
    ...(title ? { title } : {}),
    url: fileUri,
  });
  // R05 : meme forme de retour que le jumeau natif. Le web n'a pas besoin du
  // presse-papiers (navigator.share porte le texte, le telechargement n'en a pas),
  // mais un contrat identique evite un `undefined` qui se lit comme un oubli.
  return { messageCopied: false, opened: true, outcome: FILE_SHARE_OUTCOMES.SHARE_SHEET };
};

export default {
  shareLocalFile,
};
