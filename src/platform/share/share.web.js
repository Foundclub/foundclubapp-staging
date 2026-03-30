const buildShareText = (payload = {}) => [
  payload?.title,
  payload?.message || payload?.text,
  payload?.url,
].filter(Boolean).join('\n\n');

const normalizeWebSharePayload = (payload = {}) => {
  const normalized = {};

  if (payload?.title) {
    normalized.title = payload.title;
  }

  if (payload?.message || payload?.text) {
    normalized.text = payload.message || payload.text;
  }

  if (payload?.url) {
    normalized.url = payload.url;
  }

  return normalized;
};

export const share = async (payload = {}) => {
  const normalizedPayload = normalizeWebSharePayload(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(normalizedPayload);
    return;
  }

  const text = buildShareText(payload);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && text) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error('Le partage web n est pas disponible dans ce navigateur.');
};

export default {
  share,
};
