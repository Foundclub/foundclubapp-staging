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
// Suffixe de plateforme VOULU : il fait échouer bruyamment une importation depuis
// le web, qui n'a pas react-native-blob-util. Metro et Jest résolvent
// shareLocalFile.native.js ; le résolveur du linter, lui, ne connaît pas ce suffixe.
// eslint-disable-next-line import/extensions, import/no-unresolved -- cf. ci-dessus
import { shareLocalFile } from '@/platform/share/shareLocalFile';

// getApiBaseUrl() inclut déjà « /api » : le chemin ne doit PAS le répéter
// (sinon POST .../api/api/visual-assets/render -> 405). Même bug corrigé côté web.
const RENDER_PATH = '/visual-assets/render';

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
    throw new Error(`render ${params.template}/${params.format} -> HTTP ${status}`);
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
 * @param {object} params
 * @param {string} [params.dialogTitle] - Titre du sélecteur d'application (Android).
 * @param {string} params.format
 * @param {string} [params.message] - Texte joint au fichier (lien public).
 * @returns {Promise<{ fileUri: string, opened: boolean, outcome: string }>} - `outcome`
 *   vaut une valeur de FILE_SHARE_OUTCOMES ; l'écran s'en sert pour dire ce qui
 *   s'est passé. ⚠️ Le pendant web (`visualRender.web.js`) résout, lui, l'URL objet
 *   du téléchargement navigateur : un appelant partagé lit `result?.outcome`.
 */
export const downloadAndShareRender = async (params) => {
  const { base64, contentType } = await fetchRenderBase64(params);
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
  const { opened, outcome } = await shareLocalFile({
    dialogTitle: params.dialogTitle,
    fileName,
    fileUri,
    message,
    mimeType: ext === 'pdf' ? 'application/pdf' : 'image/png',
  });
  return { fileUri, opened, outcome };
};

export default {
  downloadAndShareRender,
  fetchRenderBase64,
};
