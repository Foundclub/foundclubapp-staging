const WEB_RUNTIME_DEFAULTS = {
  backgroundHostsDelayMs: 2500,
  backgroundPollMs: 90000,
  fullUserFetchDelayMs: 350,
  notificationBootstrapDelayMs: 0,
  unreadBadgeDelayMs: 1200,
  unreadPollMs: 120000,
};

const clampFiniteNumber = (rawValue, fallbackValue, minValue = 0, maxValue = 300000) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  if (parsed < minValue) {
    return minValue;
  }

  if (parsed > maxValue) {
    return maxValue;
  }

  return parsed;
};

const readWebRuntime = () => {
  if (typeof window === 'undefined' || typeof window !== 'object') {
    return null;
  }

  const runtime = window?.foundClubWebRuntime;
  if (!runtime || typeof runtime !== 'object') {
    return null;
  }

  return runtime;
};

export const isAppBootstrapDisabledOnWeb = () => Boolean(
  readWebRuntime()?.disableAppBootstrap === true,
);

export const getWebBackgroundHostsDelayMs = () => clampFiniteNumber(
  readWebRuntime()?.backgroundHostsDelayMs,
  WEB_RUNTIME_DEFAULTS.backgroundHostsDelayMs,
);

export const getWebBackgroundPollMs = () => clampFiniteNumber(
  readWebRuntime()?.backgroundPollMs,
  WEB_RUNTIME_DEFAULTS.backgroundPollMs,
);

export const getWebFullUserFetchDelayMs = () => clampFiniteNumber(
  readWebRuntime()?.fullUserFetchDelayMs,
  WEB_RUNTIME_DEFAULTS.fullUserFetchDelayMs,
);

export const getWebNotificationBootstrapDelayMs = () => clampFiniteNumber(
  readWebRuntime()?.notificationBootstrapDelayMs,
  WEB_RUNTIME_DEFAULTS.notificationBootstrapDelayMs,
);

export const getWebUnreadBadgeDelayMs = () => clampFiniteNumber(
  readWebRuntime()?.unreadBadgeDelayMs,
  WEB_RUNTIME_DEFAULTS.unreadBadgeDelayMs,
);

export const getWebUnreadPollMs = () => clampFiniteNumber(
  readWebRuntime()?.unreadPollMs,
  WEB_RUNTIME_DEFAULTS.unreadPollMs,
);
