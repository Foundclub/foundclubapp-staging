import { createLogger } from '@/utils/logger/logger';

const searchPerfLogger = createLogger('search-perf');

const getAppEnv = () => String(process.env.APP_ENV || '').trim().toLowerCase();

export const isSearchPerfEnabled = () => (
  __DEV__
  && ['local', 'staging'].includes(getAppEnv())
);

/**
 * @param {string} label
 * @param {Record<string, any>} [payload]
 */
export const markSearchPerf = (label, payload = {}) => {
  if (!isSearchPerfEnabled()) return;

  searchPerfLogger.info(label, payload);
};
