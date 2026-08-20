// @ts-nocheck
/**
 * app/src/platform/visualRender/visualRender.native.js
 *
 * Implémentation NATIVE de la couche de rendu de visuels (affiches).
 * Reprend à l'identique le comportement historique de useEventShowcase :
 *   - fetchRenderBase64 : POST /api/visual-assets/render via react-native-blob-util,
 *     renvoie { base64, contentType } pour l'aperçu <Image> en data URI.
 *   - downloadAndShareRender : écrit le rendu dans le cache puis le confie au
 *     système via `shareLocalFile` (feuille de partage iOS / enregistrement
 *     Android), et renvoie { fileUri, opened, outcome }.
 */

import ReactNativeBlobUtil from 'react-native-blob-util';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { getApiBaseUrl } from '@/config/runtimeUrls';
import { FILE_SHARE_FAILURES } from '@/platform/share/fileShareContract';
// Suffixe de plateforme VOULU : il fait échouer bruyamment une importation depuis
// le web, qui n'a pas react-native-blob-util. Metro et Jest résolvent
// shareLocalFile.native.js ; le résolveur du linter, lui, ne connaît pas ce suffixe.
// eslint-disable-next-line import/extensions, import/no-unresolved -- cf. ci-dessus
import { shareLocalFile } from '@/platform/share/shareLocalFile';

// getApiBaseUrl() inclut déjà « /api » : le chemin ne doit PAS le répéter
// (sinon POST .../api/api/visual-assets/render -> 405). Même bug corrigé côté web.
const RENDER_PATH = '/visual-assets/render';

/**
 * AA08 — erreur porteuse du rendu serveur. Meme motif que `fileShareError` de
 * `shareLocalFile.native.js` : `reason` traverse jusqu'a l'ecran, qui en tire
 * une phrase juste au lieu du message generique de connexion.
 * @param {string} message
 * @returns {Error}
 */
const renderError = (message) => {
  const error = new Error(message);
  error.reason = FILE_SHARE_FAILURES.RENDER_FAILED;
  return error;
};

const buildRenderBody = ({
  format, overrides, subjectId, subjectType, template, variant,
}) => JSON.stringify({
  format,
  subjectId: String(subjectId),
  subjectType,
  template,
  ...(variant ? { variant } : {}),
  ...(overrides && Object.keys(overrides).length ? { overrides } : {}),
});

/**
 * Récupère le rendu en base64 (léger, pour l'aperçu <Image> en data URI).
 */
export const fetchRenderBase64 = async (params) => {
  const baseURL = getApiBaseUrl();
  const token = getAuthTokens()?.token;
  const res = await ReactNativeBlobUtil.fetch(
    'POST',
    `${baseURL}${RENDER_PATH}`,
    {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    buildRenderBody(params),
  );
  const { status } = res.info();
  if (status >= 400) {
    // AA08 : l'erreur PORTE sa cause, comme celles de `shareLocalFile`. Sans ce
    // champ, l'ecran retombait sur « Verifie ta connexion » pour un serveur de
    // rendu en panne — et l'utilisateur allait regarder son wifi pour rien.
    throw renderError(`render ${params.template}/${params.format} -> HTTP ${status}`);
  }
  const contentType = res.info().headers['Content-Type'] || res.info().headers['content-type'] || 'image/png';
  return { base64: res.base64(), contentType };
};

/**
 * Écrit le rendu dans un fichier de cache puis le confie au système.
 *
 * CONSTAT (L16, corrigé par L20) sur `Share.share` de React Native 0.78
 * (node_modules/react-native/Libraries/Share/Share.js, l.91-107) :
 *   - iOS   : `message` ET `url` sont transmis ensemble à la feuille de partage
 *             ⇒ le FICHIER et le texte voyagent dans le MÊME appel.
 *   - Android : seul `{ title, message }` atteint le module natif, `url` est PURGÉ
 *             ⇒ l'affiche disparaissait, SANS erreur (fenêtre de partage vide).
 * ⇒ La décision par plateforme n'est plus prise ici : elle est nommée une seule
 *   fois dans `@/platform/share/fileShareContract` et exécutée par `shareLocalFile`.
 *   Sur Android l'affiche est désormais ENREGISTRÉE (galerie / téléchargements)
 *   puis une application est proposée pour l'ouvrir.
 * T04 (2026-08-17) — ET ON NE REDEMANDE PAS CE QU'ON A DÉJÀ. Quand l'appelant
 * joint `cachedBase64` (l'aperçu affiché, même sujet / gabarit / style / format),
 * ces octets SONT le fichier : aucun aller-retour. Mesuré le 2026-08-17 en
 * rejouant `admin/src/api/visual-asset/services/visual-renderer.ts` : le repayer
 * coûtait **3,7 à 5,2 s de médiane** et **1,29 Mo**, pour une image identique.
 * ⚠️ La décision ne se prend PAS ici : c'est `useEventShowcase` qui sait si son
 * cache contient exactement ce format-là. Un `story` demandé depuis un aperçu
 * `post` n'a rien à joindre — et le serveur travaille, comme il le doit.
 * @param {object} params
 * @param {string} [params.cachedBase64] - Octets déjà à l'écran, s'ils existent.
 * @param {string} [params.cachedContentType] - Type MIME de ces octets.
 * @param {string} [params.dialogTitle] - Titre du sélecteur d'application (Android).
 * @param {string} params.format
 * @param {string} [params.message] - Texte joint au fichier (lien public).
 * @returns {Promise<{ fileUri: string, opened: boolean, outcome: string }>} - `outcome`
 *   vaut une valeur de FILE_SHARE_OUTCOMES ; l'écran s'en sert pour dire ce qui
 *   s'est passé. ⚠️ Le pendant web (`visualRender.web.js`) résout, lui, l'URL objet
 *   du téléchargement navigateur : un appelant partagé lit `result?.outcome`.
 */
export const downloadAndShareRender = async (params) => {
  const { base64, contentType } = params.cachedBase64
    ? { base64: params.cachedBase64, contentType: params.cachedContentType || 'image/png' }
    : await fetchRenderBase64(params);
  const ext = contentType.includes('pdf') ? 'pdf' : 'png';
  const dir = ReactNativeBlobUtil.fs.dirs.CacheDir;
  const variant = params.variant || 'defaut';
  const fileName = `foundclub-${params.template}-${variant}-${params.format}-${params.subjectId}.${ext}`;
  const path = `${dir}/${fileName}`;
  await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
  const fileUri = `file://${path}`;
  const message = typeof params.message === 'string' ? params.message : '';
  // Le type MIME décrit le fichier RÉELLEMENT écrit (l'extension), pas l'en-tête
  // serveur, qui peut porter un charset et ferait échouer l'intent Android.
  const { messageCopied, opened, outcome } = await shareLocalFile({
    dialogTitle: params.dialogTitle,
    fileName,
    fileUri,
    message,
    mimeType: ext === 'pdf' ? 'application/pdf' : 'image/png',
  });
  // R05 : `messageCopied` remonte jusqu'a l'ecran, sinon la phrase serait copiee
  // en silence — un geste invisible ne vaut pas mieux qu'un geste absent.
  return {
    fileUri, messageCopied, opened, outcome,
  };
};

export default {
  downloadAndShareRender,
  fetchRenderBase64,
};
