// @ts-nocheck
/**
 * app/src/platform/visualRender/visualRender.web.js
 *
 * Implémentation WEB de la couche de rendu de visuels (affiches), SANS module
 * natif. react-native-blob-util n'existe pas sur le web : on passe par fetch().
 *   - fetchRenderBase64 : POST /api/visual-assets/render, Blob -> base64 (data URI aperçu).
 *   - downloadAndShareRender : Blob -> URL.createObjectURL -> <a download> pour
 *     déclencher un vrai téléchargement navigateur (PDF A4 / PNG story).
 */

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { getApiBaseUrl } from '@/config/runtimeUrls';

// getApiBaseUrl() inclut déjà « /api » : le chemin ne doit PAS le répéter
// (sinon POST .../api/api/visual-assets/render -> 405). Cf. axios client (chemins /xxx).
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

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Lecture du visuel impossible.'));
  reader.onloadend = () => {
    const result = String(reader.result || '');
    const commaIndex = result.indexOf(',');
    resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
  };
  reader.readAsDataURL(blob);
});

const requestRender = async (params) => {
  const baseURL = getApiBaseUrl();
  const token = getAuthTokens()?.token;
  const res = await fetch(`${baseURL}${RENDER_PATH}`, {
    body: buildRenderBody(params),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`render ${params.template}/${params.format} -> HTTP ${res.status}`);
  }
  const contentType = res.headers.get('Content-Type') || res.headers.get('content-type') || 'image/png';
  const blob = await res.blob();
  return { blob, contentType };
};

export const fetchRenderBase64 = async (params) => {
  const { blob, contentType } = await requestRender(params);
  const base64 = await blobToBase64(blob);
  return { base64, contentType };
};

export const downloadAndShareRender = async (params) => {
  const { blob, contentType } = await requestRender(params);
  const ext = contentType.includes('pdf') ? 'pdf' : 'png';
  const filename = `foundclub-${params.template}-${params.variant || 'defaut'}-${params.format}-${params.subjectId}.${ext}`;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.download = filename;
    link.href = objectUrl;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Laisse le navigateur amorcer le téléchargement avant de révoquer l'URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
  return objectUrl;
};

export default {
  downloadAndShareRender,
  fetchRenderBase64,
};
