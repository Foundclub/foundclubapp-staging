import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';

import {
  BOOT_REQUEST_BLOCKED_CODE,
  BOOT_REQUEST_NO_SESSION_CODE,
} from '@/services/bootRequestGuard';

// Les intercepteurs de réponse (client.native.js / client.web.js) rejettent la
// charge DÉBALLÉE `error.response.data.error`, jamais l'erreur axios : une
// erreur applicative Strapi arrive donc ici sans `isAxiosError` et sans
// `response`, avec son code dans `error.status`. Lire les deux formes est
// indispensable, sinon tout 4xx retombe dans « inconnu => on retente ».
// Mesuré sur staging le 2026-07-29 : chaque 403 partait 3 fois (1 + 2 reprises
// à 1,13 s et 2,07 s d'écart) pour cette seule raison.
const getErrorStatus = (/** @type {any} */ error) => {
  const rawStatus = error?.status
    ?? error?.response?.status
    ?? error?.error?.status;
  const parsed = Number(rawStatus);
  return Number.isFinite(parsed) ? parsed : null;
};

const getErrorMethod = (/** @type {any} */ error) => String(
  error?.config?.method || error?.response?.config?.method || 'get',
).trim().toUpperCase();

const isLocallyBlocked = (/** @type {any} */ error) => (
  error?.code === BOOT_REQUEST_BLOCKED_CODE
  || error?.code === BOOT_REQUEST_NO_SESSION_CODE
);

/**
 * @param {number} failureCount
 * @param {unknown} error
 * @returns {boolean}
 */
export const shouldRetryQuery = (failureCount, error) => {
  if (failureCount >= 2) {
    return false;
  }

  const typedError = /** @type {any} */ (error);

  // Refus posé par le client lui-même (circuit anti-rafale, absence de session) :
  // retenter ne fait que rejouer le même refus, sans jamais toucher le réseau.
  if (isLocallyBlocked(typedError)) {
    return false;
  }

  if (getErrorMethod(typedError) !== 'GET') {
    return false;
  }

  const status = getErrorStatus(typedError);
  if (status === null || status === 0) {
    // Panne réseau ou timeout : aucun status, ça vaut le coup de retenter.
    return true;
  }

  // 429 exclu : le retryDelay (max 4 s) retombe dans la fenêtre de blocage du
  // rate-limiter (60 s) et ne fait qu'amplifier la charge.
  if (status === 408 || status === 425) {
    return true;
  }

  // Tout autre 4xx est un refus définitif (permission, jeton, validation) :
  // le retenter triple le trafic sans jamais changer la réponse.
  return status >= 500;
};

/**
 * @param {{
 *   captureQueryError?: (error: unknown) => void,
 *   onMutationError?: (error: unknown, fallbackMessage?: string) => void
 * }} [options]
 * @returns {import('@tanstack/react-query').QueryClient}
 */
export const createFoundClubQueryClient = (options = {}) => {
  const {
    captureQueryError,
    onMutationError,
  } = options;

  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
      },
    },
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        if (!mutation?.options?.meta?.preventToastError && typeof onMutationError === 'function') {
          onMutationError(
            error,
            mutation?.options?.meta?.errorMessageFallback?.toString(),
          );
        }
      },
    }),
    queryCache: new QueryCache({
      onError: (error) => {
        if (typeof captureQueryError === 'function') {
          captureQueryError(error);
        }
      },
    }),
  });
};

export default createFoundClubQueryClient;
