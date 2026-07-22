// @ts-nocheck
/**
 * app/src/platform/visualRender/visualRender.native.js
 *
 * Implémentation NATIVE de la couche de rendu de visuels (affiches).
 * Reprend à l'identique le comportement historique de useEventShowcase :
 *   - fetchRenderBase64 : POST /api/visual-assets/render via react-native-blob-util,
 *     renvoie { base64, contentType } pour l'aperçu <Image> en data URI.
 *   - downloadAndShareRender : écrit le rendu dans le cache puis déclenche le
 *     partage système (SharePlatform), renvoie le chemin file://.
 */

import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { getApiBaseUrl } from '@/config/runtimeUrls';
import SharePlatform from '@/platform/share';

const RENDER_PATH = '/api/visual-assets/render';

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
 * Écrit le rendu dans un fichier de cache puis déclenche le partage système.
 * Renvoie le chemin file:// du fichier généré.
 */
export const downloadAndShareRender = async (params) => {
  const { base64, contentType } = await fetchRenderBase64(params);
  const ext = contentType.includes('pdf') ? 'pdf' : 'png';
  const dir = ReactNativeBlobUtil.fs.dirs.CacheDir;
  const path = `${dir}/foundclub-${params.template}-${params.variant || 'defaut'}-${params.format}-${params.subjectId}.${ext}`;
  await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
  const fileUri = `file://${path}`;
  await SharePlatform.share(
    Platform.OS === 'ios' ? { url: fileUri } : { message: '', url: fileUri },
  );
  return fileUri;
};

export default {
  downloadAndShareRender,
  fetchRenderBase64,
};
