// FCMSTORM (2026-08-28) — LA REGLE QUI DIT QUAND SE TAIRE.
//
// Mesure du chef sur les journaux de la recette : le meme POST
// /api/user-fcm-token/me/device repart plusieurs fois par seconde, en continu,
// pendant que le serveur repond 429 (27 refus dans la fenetre observee). La
// veille, le meme appel rendait 403 six fois d'affilee.
//
// Le risque n'est PAS la notification perdue : c'est que la protection
// anti-abus du serveur, saturee par ce bruit, rejette D'AUTRES appels
// legitimes du meme utilisateur au meme moment.
//
// Ces trois fonctions sont pures : elles ne decident rien toutes seules, elles
// disent seulement de quelle NATURE est un refus et combien de temps attendre.

/** Nombre d'essais avant de se taire pour de bon sur un « tu tapes trop vite ». */
export const TOKEN_SYNC_MAX_ATTEMPTS = 4;

/** Premiere attente apres un 429. Elle double ensuite : 1 s, 2 s, 4 s… */
export const TOKEN_SYNC_BASE_DELAY_MS = 1000;

/** Plafond d'attente : au-dela, doubler n'apporte plus rien. */
export const TOKEN_SYNC_MAX_DELAY_MS = 60000;

/**
 * De quelle nature est ce refus ?
 *
 * - `denied`    : refus de DROIT (401 / 403). Definitif tant que rien ne change
 *   du cote du compte — le reessayer est une faute, pas une precaution.
 * - `throttled` : « tu tapes trop vite » (429). On espace, on plafonne, on
 *   s'arrete.
 * - `retryable` : coupure reseau ou panne serveur (5xx). Celui-la, on le
 *   reessaie : il se repare tout seul.
 * @param {any} error - Erreur remontee par le client HTTP.
 * @returns {'denied' | 'throttled' | 'retryable'} - La nature du refus.
 */
export const classifyTokenSyncError = (error) => {
  const statusCode = Number(error?.status || error?.response?.status || 0);

  if (statusCode === 401 || statusCode === 403) return 'denied';
  if (statusCode === 429) return 'throttled';

  return 'retryable';
};

/**
 * Le serveur a-t-il dit combien de temps attendre ?
 *
 * `Retry-After` s'ecrit soit en secondes, soit en date HTTP. Quand il est la,
 * il fait autorite : c'est le serveur qui sait, pas nous.
 * @param {any} error - Erreur remontee par le client HTTP.
 * @param {number} [now] - Instant de reference, pour la forme « date HTTP ».
 * @returns {number | null} - Attente demandee en millisecondes, ou null.
 */
export const getRetryAfterMs = (error, now = Date.now()) => {
  const headers = error?.response?.headers || error?.headers;
  const rawValue = headers?.['retry-after']
    ?? headers?.['Retry-After']
    ?? (typeof headers?.get === 'function' ? headers.get('retry-after') : undefined);

  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

  const asSeconds = Number(rawValue);
  if (Number.isFinite(asSeconds)) {
    return asSeconds > 0 ? Math.round(asSeconds * 1000) : 0;
  }

  const asDate = Date.parse(String(rawValue));
  if (Number.isNaN(asDate)) return null;

  return Math.max(0, asDate - now);
};

/**
 * Combien de temps se taire avant le prochain essai.
 *
 * L'attente double a chaque essai et reste sous le plafond. Un `Retry-After`
 * envoye par le serveur l'emporte, mais il est lui aussi plafonne : un serveur
 * qui demanderait une heure ne doit pas geler le jeton pour une heure.
 * @param {number} attempt - Numero de l'essai deja consomme (1 = le premier).
 * @param {number | null} [retryAfterMs] - Attente imposee par le serveur.
 * @returns {number} - Attente en millisecondes.
 */
export const getBackoffDelayMs = (attempt, retryAfterMs = null) => {
  if (Number.isFinite(retryAfterMs) && Number(retryAfterMs) >= 0) {
    return Math.min(Number(retryAfterMs), TOKEN_SYNC_MAX_DELAY_MS);
  }

  const safeAttempt = Math.max(1, Math.floor(Number(attempt) || 1));
  const doubled = TOKEN_SYNC_BASE_DELAY_MS * (2 ** (safeAttempt - 1));

  return Math.min(doubled, TOKEN_SYNC_MAX_DELAY_MS);
};
