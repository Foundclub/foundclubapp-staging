import { createLogger } from '@/utils/logger/logger';

const eventDetailsPerfLogger = createLogger('event-details-perf');

const getAppEnv = () => String(process.env.APP_ENV || '').trim().toLowerCase();

export const isEventDetailsPerfEnabled = () => (
  __DEV__
  && ['local', 'staging'].includes(getAppEnv())
);

/**
 * @param {string} label
 * @param {Record<string, any>} [payload]
 */
export const markEventDetailsPerf = (label, payload = {}) => {
  if (!isEventDetailsPerfEnabled()) return;

  eventDetailsPerfLogger.info(label, payload);
};
