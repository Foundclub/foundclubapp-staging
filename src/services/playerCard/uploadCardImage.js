// @ts-nocheck
/**
 * uploadCardImage — upload d'un fichier image (carte capturee) vers Strapi /upload,
 * puis mise en forme des pieces jointes pour l'envoi dans une conversation
 * (pipeline chat-message attachments, identique a Conversation.js uploadAttachmentAsset).
 * Destination repo : app/src/services/playerCard/uploadCardImage.js
 *
 * Upload via fetch natif (PAS axios) : axios+FormData echoue sur Android RN —
 * meme contournement que Conversation.js#uploadAttachmentAssetWithFetch et
 * authService#updateMe.
 *
 * Retourne un tableau d'attachments prêts pour sendMessage(chatId, '', { attachments }).
 */
import { Platform } from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import client from '@/services/client';

import { getApiBaseUrl } from '@/config/runtimeUrls';

/**
 * Upload le PNG capture (fileUri tmpfile view-shot) vers /upload.
 * @param {object} params
 * @param {string} params.fileUri URI locale du PNG (result:'tmpfile')
 * @param {string} [params.fileName]
 * @returns {Promise<Array<object>>} media items Strapi (id, documentId, url, mime...)
 */
export const uploadCardImage = async ({ fileName = `carte-foundclub-${Date.now()}.png`, fileUri }) => {
  if (!fileUri) return [];

  const normalizedUri = Platform.OS === 'android' && !fileUri.startsWith('file://')
    ? `file://${fileUri}`
    : fileUri;

  const formData = new FormData();
  formData.append('files', /** @type {any} */ ({
    name: fileName,
    type: 'image/png',
    uri: normalizedUri,
  }));

  const apiBaseUrl = (client?.defaults?.baseURL || getApiBaseUrl() || '').replace(/\/$/, '');
  const token = getAuthTokens()?.token;
  const response = await fetch(`${apiBaseUrl}/upload`, {
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    method: 'POST',
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(rawBody);
      message = parsed?.error?.message || parsed?.message || message;
    } catch (_e) { /* corps non-JSON : on garde le statut HTTP */ }
    throw new Error(String(message));
  }

  const uploadItems = await response.json().catch(() => []);
  return Array.isArray(uploadItems) ? uploadItems : [];
};

export default uploadCardImage;
