const bootStartedAt = Date.now();
const BOOT_NETWORK_WINDOW_MS = 5000;
const MAX_BOOT_LOG_VALUE_LENGTH = 180;
let bootNetworkRequestCount = 0;
let didLogBootNetworkSummary = false;
const seenLabels = new Set();

const serializeBootLogValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  if (typeof value === 'string') {
    return value.length > MAX_BOOT_LOG_VALUE_LENGTH
      ? `${value.slice(0, MAX_BOOT_LOG_VALUE_LENGTH)}...`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      return String(value);
    }
    return serialized.length > MAX_BOOT_LOG_VALUE_LENGTH
      ? `${serialized.slice(0, MAX_BOOT_LOG_VALUE_LENGTH)}...`
      : serialized;
  } catch (_error) {
    return String(value);
  }
};

/**
 * @param {Record<string, any> | undefined} meta
 * @returns {string}
 */
export const formatBootMeta = (meta = undefined) => {
  if (!meta || typeof meta !== 'object') {
    return '';
  }

  return Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const serializedValue = serializeBootLogValue(value);
      return serializedValue === undefined ? null : `${key}=${serializedValue}`;
    })
    .filter(Boolean)
    .join(' ');
};

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
  const formattedMeta = formatBootMeta({
    ...(meta || {}),
    label,
    sinceBootMs: Date.now() - bootStartedAt,
  });
  console.info(formattedMeta ? `[BOOT][PERF] ${formattedMeta}` : '[BOOT][PERF]');
};

const scheduleBootNetworkSummary = () => {
  if (didLogBootNetworkSummary) {
    return;
  }

  didLogBootNetworkSummary = true;
  const remainingMs = Math.max(0, BOOT_NETWORK_WINDOW_MS - (Date.now() - bootStartedAt));
  setTimeout(() => {
    const formattedMeta = formatBootMeta({
      requestCount: bootNetworkRequestCount,
      windowMs: BOOT_NETWORK_WINDOW_MS,
    });
    console.info(
      formattedMeta
        ? `[BOOT][PERF][NETWORK_SUMMARY] ${formattedMeta}`
        : '[BOOT][PERF][NETWORK_SUMMARY]',
    );
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
  const formattedMeta = formatBootMeta({
    count: bootNetworkRequestCount,
    method: String(request?.method || 'get').toUpperCase(),
    sinceBootMs: Date.now() - bootStartedAt,
    url: request?.url || 'unknown',
  });
  console.info(formattedMeta ? `[BOOT][PERF][NETWORK] ${formattedMeta}` : '[BOOT][PERF][NETWORK]');
  scheduleBootNetworkSummary();
};

export const getBootStartedAt = () => bootStartedAt;
