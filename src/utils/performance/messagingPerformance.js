import { createLogger } from '@/utils/logger/logger';

const messagingPerfLogger = createLogger('messaging-perf');

const getAppEnv = () => String(process.env.APP_ENV || '').trim().toLowerCase();

export const isMessagingPerfEnabled = () => (
  __DEV__
  && ['local', 'staging'].includes(getAppEnv())
);

/**
 * @param {string} label
 * @param {Record<string, any>} [payload]
 */
export const markMessagingPerf = (label, payload = {}) => {
  if (!isMessagingPerfEnabled()) return;

  messagingPerfLogger.info(label, payload);
};
