import i18next from 'i18next';

// SITE-VILLE-FINITIONS (T19) : un message qui CONTIENT deja le lien ne le renvoie pas une
// deuxieme fois (navigator.share colle le texte puis l adresse : le lien s ecrivait deux fois).
/**
 * Le texte partage contient-il deja le lien ?
 * @param {{ message?: string, text?: string, url?: string }} [payload] - Ce qui part.
 * @returns {boolean} Le lien est-il deja dans le texte ?
 */
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

/**
 * RESA-L6B-2 (20/10/2026) — copie un texte dans le presse-papiers du navigateur.
 * @param {string} texte - Le texte.
 * @returns {Promise<boolean>} Vrai si la copie a eu lieu.
 */
export const copier = async (texte) => {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(String(texte ?? ''));
    return true;
  } catch (_erreur) {
    return false;
  }
};

export default {
  copier,
  share,
};
