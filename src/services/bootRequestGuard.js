/**
 * Garde anti-rafale des requêtes de démarrage (GET /firebase-auth/me et
 * GET /app/bootstrap).
 *
 * Mesure du 2026-07-20 (rendu web, API injoignable) : ces deux requêtes
 * partaient à ~37/s au boot alors que leurs queries react-query sont déjà
 * `retry: false` — la rafale vient de re-déclenchements en amont (remontages
 * d'observateurs, churn de clés), pas de retries. La borne doit donc vivre ici,
 * au niveau du client HTTP, pour tenir quel que soit le déclencheur :
 * au-delà de MAX_FAILURES_IN_WINDOW échecs réseau dans la fenêtre, le circuit
 * s'ouvre et les appels suivants sont rejetés immédiatement (sans réseau)
 * pendant un délai qui double à chaque réouverture (plafonné), en respectant
 * le retryAfterSeconds renvoyé par le serveur dans error.details.
 */

export const BOOT_REQUEST_BLOCKED_CODE = 'BOOT_REQUEST_BLOCKED';

const GUARDED_PATHS = ['/app/bootstrap', '/firebase-auth/me'];

const FAILURE_WINDOW_MS = 10000;
const MAX_FAILURES_IN_WINDOW = 5;
const BASE_COOLDOWN_MS = 5000;
const MAX_COOLDOWN_MS = 60000;
// Un retryAfterSeconds serveur peut dépasser le plafond local (rate-limiter
// 60 s côté serveur) : on le respecte, borné pour ne jamais geler l'app.
const MAX_SERVER_RETRY_AFTER_MS = 300000;

/** @type {Map<string, { failureTimestamps: number[], openCount: number, openUntil: number }>} */
const guardStateByPath = new Map();

const getGuardState = (/** @type {string} */ path) => {
  const existing = guardStateByPath.get(path);
  if (existing) return existing;

  const created = { failureTimestamps: [], openCount: 0, openUntil: 0 };
  guardStateByPath.set(path, created);
  return created;
};

const toGuardedPath = (/** @type {unknown} */ rawUrl) => {
  const withoutOrigin = String(rawUrl || '').replace(/^https?:\/\/[^/]+/i, '');
  const path = withoutOrigin.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return GUARDED_PATHS.includes(path) ? path : null;
};

const getGuardedBootPath = (/** @type {any} */ config) => {
  const method = String(config?.method || 'get').trim().toLowerCase();
  if (method !== 'get') return null;
  return toGuardedPath(config?.url);
};

/**
 * Lit le retryAfterSeconds d'une erreur, quelle que soit sa forme :
 * erreur déballée par l'intercepteur (error.details) ou erreur axios brute
 * (error.response.data.error.details).
 * @param {any} error
 * @returns {number} 0 si absent ou invalide.
 */
export const getRetryAfterSeconds = (error) => {
  const rawValue = error?.details?.retryAfterSeconds
    ?? error?.response?.data?.error?.details?.retryAfterSeconds;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const buildBlockedError = (/** @type {string} */ path, /** @type {number} */ retryInMs) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryInMs / 1000));
  const message = `Appels de démarrage suspendus ${retryAfterSeconds}s `
    + `après une rafale d'échecs réseau (${path}).`;
  const errorPayload = {
    code: BOOT_REQUEST_BLOCKED_CODE,
    details: { retryAfterSeconds },
    message,
    name: 'BootRequestBlockedError',
    status: 0,
  };

  return {
    code: BOOT_REQUEST_BLOCKED_CODE,
    isBootRequestBlocked: true,
    message,
    // Même forme qu'une erreur API : l'intercepteur de réponse déballera
    // response.data.error et les couches du dessus verront details.retryAfterSeconds.
    response: { data: { error: errorPayload } },
  };
};

const isCountableFailure = (/** @type {any} */ error) => {
  if (!error?.response) return true;
  const status = Number(error.response.status);
  return status === 429 || status >= 500;
};

/**
 * À appeler en tête d'intercepteur de requête : rejette immédiatement (sans
 * réseau) si le circuit est ouvert pour cet endpoint de démarrage.
 * @param {any} config
 * @returns {void}
 * @throws l'erreur structurée BOOT_REQUEST_BLOCKED quand le circuit est ouvert.
 */
export const assertBootRequestAllowed = (config) => {
  const path = getGuardedBootPath(config);
  if (!path) return;

  const state = getGuardState(path);
  const now = Date.now();
  if (now < state.openUntil) {
    throw buildBlockedError(path, state.openUntil - now);
  }
};

/**
 * À appeler dans l'intercepteur d'erreur de réponse, AVANT le déballage.
 * @param {any} error - Erreur axios brute (error.config présent).
 * @returns {void}
 */
export const recordBootRequestFailure = (error) => {
  if (error?.isBootRequestBlocked) return;

  const path = getGuardedBootPath(error?.config);
  if (!path || !isCountableFailure(error)) return;

  const state = getGuardState(path);
  const now = Date.now();
  state.failureTimestamps = state.failureTimestamps
    .filter((timestamp) => now - timestamp < FAILURE_WINDOW_MS);
  state.failureTimestamps.push(now);

  if (state.failureTimestamps.length < MAX_FAILURES_IN_WINDOW) {
    return;
  }

  const backoffMs = Math.min(BASE_COOLDOWN_MS * 2 ** state.openCount, MAX_COOLDOWN_MS);
  const serverMs = Math.min(getRetryAfterSeconds(error) * 1000, MAX_SERVER_RETRY_AFTER_MS);
  const cooldownMs = Math.max(backoffMs, serverMs);

  state.failureTimestamps = [];
  state.openCount += 1;
  state.openUntil = now + cooldownMs;
  console.warn('[BOOT][NETWORK_GUARD] circuit ouvert '
    + `path=${path} cooldownMs=${cooldownMs} ouvertures=${state.openCount}`);
};

/**
 * À appeler sur toute réponse en succès : referme et réarme le circuit.
 * @param {any} config
 * @returns {void}
 */
export const recordBootRequestSuccess = (config) => {
  const path = getGuardedBootPath(config);
  if (!path) return;
  guardStateByPath.delete(path);
};

/**
 * Réarme tout (bouton « Réessayer », tests).
 * @returns {void}
 */
export const resetBootRequestGuard = () => {
  guardStateByPath.clear();
};

/**
 * État courant du garde, pour les tests et le diagnostic.
 * @returns {Record<string, { failureCount: number, openCount: number, openUntil: number }>}
 */
export const getBootRequestGuardSnapshot = () => {
  /** @type {Record<string, { failureCount: number, openCount: number, openUntil: number }>} */
  const snapshot = {};
  guardStateByPath.forEach((state, path) => {
    snapshot[path] = {
      failureCount: state.failureTimestamps.length,
      openCount: state.openCount,
      openUntil: state.openUntil,
    };
  });
  return snapshot;
};
