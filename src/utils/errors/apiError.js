/**
 * Reconstruit une erreur de service SANS perdre ce que le serveur a dit.
 *
 * Pourquoi ce fichier existe : l'intercepteur HTTP (client.native.js:93, client.web.js)
 * rejette la charge Strapi DEBALLEE — `{ status, name, message, details }` — et non l'erreur
 * axios. Un service qui fait `throw new Error(texte)` dans son `catch` jette donc `details.code`
 * et `details.decision` avec le reste. L'ecran recoit un 403 nu, `extractSubscriptionDecisionFromError`
 * rend `null`, et le mur payant ne peut pas s'ouvrir alors que le serveur venait justement de dire
 * quelle offre debloque l'action.
 *
 * @param {any} error - L'erreur telle que rejetee par le client HTTP.
 * @param {string} messagePrefix - Le prefixe de journalisation, ex. 'Failed to update club'.
 * @returns {Error & { code: any, decision: any, details: any, status: number | null }}
 */
export const buildPreservedApiError = (error, messagePrefix) => {
  const responseError = error?.response?.data?.error;
  const responseData = error?.response?.data;
  const details = responseError?.details || responseData?.details || error?.details || null;

  const errorToDisplay = responseError?.message
    || responseData?.message
    || (error && typeof error === 'object' && 'message' in error ? error.message : error)
    || 'Unknown error';

  const nextError = /** @type {any} */ (new Error(`${messagePrefix}: ${errorToDisplay}`));
  nextError.code = responseError?.code || responseData?.code || error?.code || details?.code || null;
  nextError.details = details;
  nextError.status = Number(
    error?.status
    || error?.response?.status
    || responseError?.status
    || responseData?.status
    || 0,
  ) || null;
  if (details?.decision) {
    nextError.decision = details.decision;
  }

  return nextError;
};

export default buildPreservedApiError;
