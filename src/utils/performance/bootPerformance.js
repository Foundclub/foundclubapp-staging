const bootStartedAt = Date.now();
const BOOT_NETWORK_WINDOW_MS = 5000;
let bootNetworkRequestCount = 0;
let didLogBootNetworkSummary = false;
const seenLabels = new Set();

/**
 * @param {string} label
 * @param {Record<string, any>} [meta]
 * @returns {void}
 */
export const markBootStep = (label, meta = undefined) => {
  if (!label || seenLabels.has(label)) {
    return;
  }

  seenLabels.add(label);
  console.info('[BOOT][PERF]', {
    ...(meta || {}),
    label,
    sinceBootMs: Date.now() - bootStartedAt,
  });
};

const scheduleBootNetworkSummary = () => {
  if (didLogBootNetworkSummary) {
    return;
  }

  didLogBootNetworkSummary = true;
  const remainingMs = Math.max(0, BOOT_NETWORK_WINDOW_MS - (Date.now() - bootStartedAt));
  setTimeout(() => {
    console.info('[BOOT][PERF][NETWORK_SUMMARY]', {
      requestCount: bootNetworkRequestCount,
      windowMs: BOOT_NETWORK_WINDOW_MS,
    });
  }, remainingMs);
};

/**
 * @param {{
 *   method?: string;
 *   url?: string;
 * }} request
 * @returns {void}
 */
export const trackBootNetworkRequest = (request) => {
  if (Date.now() - bootStartedAt > BOOT_NETWORK_WINDOW_MS) {
    return;
  }

  bootNetworkRequestCount += 1;
  console.info('[BOOT][PERF][NETWORK]', {
    count: bootNetworkRequestCount,
    method: String(request?.method || 'get').toUpperCase(),
    sinceBootMs: Date.now() - bootStartedAt,
    url: request?.url || 'unknown',
  });
  scheduleBootNetworkSummary();
};

export const getBootStartedAt = () => bootStartedAt;
