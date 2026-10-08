import i18next from 'i18next';

// SITE-VILLE-FINITIONS (T19) : un message qui CONTIENT deja le lien ne le renvoie pas une
// deuxieme fois (navigator.share colle le texte puis l adresse : le lien s ecrivait deux fois).
const lienDejaDansLeTexte = (payload = {}) => Boolean(
  payload?.url && String(payload?.message || payload?.text || '').includes(payload.url),
);

const buildShareText = (payload = {}) => [
  payload?.title,
  payload?.message || payload?.text,
  lienDejaDansLeTexte(payload) ? null : payload?.url,
].filter(Boolean).join('\n\n');

const normalizeWebSharePayload = (payload = {}) => {
  const normalized = {};

  if (payload?.title) {
    normalized.title = payload.title;
  }

  if (payload?.message || payload?.text) {
    normalized.text = payload.message || payload.text;
  }

  if (payload?.url && !lienDejaDansLeTexte(payload)) {
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

  throw new Error(i18next.t(
    'share.errors.webUnavailable',
    'Le partage web n est pas disponible dans ce navigateur.',
  ));
};

export default {
  share,
};
