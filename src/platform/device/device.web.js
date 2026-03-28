const WEB_DEVICE_ID_STORAGE_KEY = 'platform.deviceId';

const createBrowserDeviceId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `web-${Date.now()}-${Math.round(Math.random() * 100000)}`;
};

export const getDeviceId = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'web-server-render';
  }

  const currentValue = window.localStorage.getItem(WEB_DEVICE_ID_STORAGE_KEY);
  if (currentValue) {
    return currentValue;
  }

  const nextValue = createBrowserDeviceId();
  window.localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, nextValue);
  return nextValue;
};

export const getAppVersion = () => String(process.env.WEB_APP_VERSION || process.env.APP_VERSION || 'web');

export const isDesktop = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
};

export const getDeviceInfo = () => ({
  appVersion: getAppVersion(),
  deviceId: getDeviceId(),
  isDesktop: isDesktop(),
  platform: 'web',
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
});

export default {
  getAppVersion,
  getDeviceId,
  getDeviceInfo,
  isDesktop,
};
