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
/**
 * PERF3 — Code dédié posé par les intercepteurs HTTP sur un ABANDON : la requête
 * a dépassé le timeout client de 15 s (client.native.js:26, client.web.js:24).
 * Avant, l'abandon était rejeté en CHAÎNE NUE ('Request timeout - please retry.')
 * — sans status ni code, la politique de reprise le retentait comme une panne
 * réseau : 15+1+15+2+15 = 48 s et 3 requêtes, précisément quand le serveur rame.
 */
export const REQUEST_TIMEOUT_ABANDON_CODE = 'REQUEST_TIMEOUT_ABANDONED';

/**
 * Construit l'objet d'abandon à rejeter par l'intercepteur, ou null si l'erreur
 * axios n'est pas un timeout.
 *
 * axios 1.13.5 : l'adaptateur XHR code un timeout `ECONNABORTED`, l'adaptateur
 * fetch `ETIMEDOUT` (message 'timeout of 15000ms exceeded'). L'ordre par défaut
 * ['xhr','http','fetch'] rend le premier quasi certain en React Native, mais un
 * client qui ne lit qu'un des deux codes rate l'autre.
 * @param {any} axiosError - L'erreur axios brute, AVANT déballage.
 * @returns {{ code: string, message: string, name: string, status: number } | null}
 */
export const buildRequestTimeoutAbandon = (axiosError) => {
  if (axiosError?.code !== 'ECONNABORTED' && axiosError?.code !== 'ETIMEDOUT') {
    return null;
  }
  return {
    code: REQUEST_TIMEOUT_ABANDON_CODE,
    message: 'Request timeout - please retry.',
    name: 'RequestTimeoutAbandonError',
    status: 0,
  };
};

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
