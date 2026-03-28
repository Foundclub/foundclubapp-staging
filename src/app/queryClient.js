import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';

const isAxiosError = (error) => Boolean(
  error
  && typeof error === 'object'
  && /** @type {{ isAxiosError?: unknown }} */ (error).isAxiosError === true,
);

/**
 * @param {number} failureCount
 * @param {unknown} error
 * @returns {boolean}
 */
const shouldRetryQuery = (failureCount, error) => {
  if (failureCount >= 2) {
    return false;
  }

  const typedError = /** @type {any} */ (error);
  if (!isAxiosError(typedError)) {
    return true;
  }

  const method = String(typedError?.config?.method || 'get').trim().toUpperCase();
  if (method && method !== 'GET') {
    return false;
  }

  const status = typedError?.response?.status;
  if (!status) {
    return true;
  }

  if (status === 408 || status === 425 || status === 429) {
    return true;
  }

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
