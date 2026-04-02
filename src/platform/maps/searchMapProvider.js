const normalizeProvider = (value) => String(value || '').trim().toLowerCase();
const isTestRuntime = process.env.NODE_ENV === 'test';
const TEST_OVERRIDE_KEY = 'fcSearchMapTestOverrides';
const getGlobalOverrides = () => (global?.[TEST_OVERRIDE_KEY] || {});
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

// Keep explicit env accesses so Babel inline-dotenv can replace them in app builds.
const STATIC_SEARCH_MAP_PROVIDER = String(process.env.FC_SEARCH_MAP_PROVIDER || '').trim();
const STATIC_TOMTOM_API_KEY = String(process.env.TOMTOM_API_KEY || '').trim();

export const SEARCH_MAP_PROVIDERS = Object.freeze({
  legacy: 'legacy',
  tomtom: 'tomtom',
});

export const getTomTomApiKey = () => {
  const testOverrides = getGlobalOverrides();
  const testOverride = hasOwn(testOverrides, 'TOMTOM_API_KEY')
    ? String(testOverrides.TOMTOM_API_KEY || '').trim()
    : null;
  if (isTestRuntime) {
    return testOverride ?? String(process.env.TOMTOM_API_KEY || '').trim();
  }

  const runtimeValue = String(process.env.TOMTOM_API_KEY || '').trim();
  return String(runtimeValue || STATIC_TOMTOM_API_KEY || '').trim();
};

export const getConfiguredSearchMapProvider = () => {
  const testOverrides = getGlobalOverrides();
  const testOverride = hasOwn(testOverrides, 'FC_SEARCH_MAP_PROVIDER')
    ? String(testOverrides.FC_SEARCH_MAP_PROVIDER || '').trim()
    : null;
  const configuredProvider = normalizeProvider(
    isTestRuntime
      ? ((testOverride ?? process.env.FC_SEARCH_MAP_PROVIDER) || '')
      : process.env.FC_SEARCH_MAP_PROVIDER || STATIC_SEARCH_MAP_PROVIDER,
  );

  if (configuredProvider === SEARCH_MAP_PROVIDERS.legacy) {
    return SEARCH_MAP_PROVIDERS.legacy;
  }

  if (configuredProvider === SEARCH_MAP_PROVIDERS.tomtom) {
    return SEARCH_MAP_PROVIDERS.tomtom;
  }

  return '';
};

export const getSearchMapProvider = () => {
  const configuredProvider = getConfiguredSearchMapProvider();

  if (configuredProvider) {
    return configuredProvider;
  }

  return SEARCH_MAP_PROVIDERS.tomtom;
};

export const isTomTomSearchMapEnabled = () => getSearchMapProvider() === SEARCH_MAP_PROVIDERS.tomtom;

export const isTomTomSearchMapMisconfigured = () => (
  getSearchMapProvider() === SEARCH_MAP_PROVIDERS.tomtom && !getTomTomApiKey()
);

export default {
  getConfiguredSearchMapProvider,
  getSearchMapProvider,
  getTomTomApiKey,
  isTomTomSearchMapEnabled,
  isTomTomSearchMapMisconfigured,
  SEARCH_MAP_PROVIDERS,
};
