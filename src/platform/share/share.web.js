export const share = async (payload) => {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(payload);
    return;
  }

  const text = payload?.url || payload?.message || payload?.title || '';
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && text) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error('Le partage web n est pas disponible dans ce navigateur.');
};

export default {
  share,
};
