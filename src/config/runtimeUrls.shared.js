const DEFAULT_PUBLIC_ORIGIN = 'https://foundclub.com';
const LOOPBACK_HOSTS = new Set(['10.0.2.2', '127.0.0.1', 'localhost']);
const PRIVATE_IPV4_HOST_PATTERN = /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i;

const normalizeText = (value) => String(value || '').trim();
const isPrivateIpv4Host = (value) => PRIVATE_IPV4_HOST_PATTERN.test(normalizeText(value));
const isTruthyFlag = (value) => ['1', 'on', 'true', 'yes']
  .includes(normalizeText(value).toLowerCase());

export const normalizeAppEnv = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'production') return 'production';
  if (normalized === 'staging' || normalized === 'preview') return 'staging';
  return 'local';
};

export const normalizeApiUrl = (value) => {
  const candidate = normalizeText(value);
  if (!candidate) return '';
  return candidate.replace(/\/+$/g, '').replace(/\/api$/i, '/api');
};

export const toPublicOrigin = (value) => {
  const candidate = normalizeText(value);
  if (!candidate) return '';
  return candidate.replace(/\/api\/?$/i, '').replace(/\/+$/g, '');
};

export const normalizeSocketUrl = (value) => {
  const candidate = toPublicOrigin(value);
  if (!candidate) return '';
  return candidate;
};

const getHostname = (value) => {
  try {
    return new URL(value).hostname;
  } catch (_error) {
    return '';
  }
};

const getCurrentWebHostname = () => {
  if (typeof window === 'undefined') return '';
  return normalizeText(window.location?.hostname);
};

const rewriteLoopbackToCurrentWebHost = (value) => {
  const normalized = normalizeText(value);
  const currentHostname = getCurrentWebHostname();

  if (!normalized || !isPrivateIpv4Host(currentHostname)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const host = normalizeText(url.hostname).toLowerCase();
    if (!LOOPBACK_HOSTS.has(host)) {
      return normalized;
    }
    url.hostname = currentHostname;
    return url.toString();
  } catch (_error) {
    return normalized;
  }
};

const rewriteLoopbackForRuntime = ({
  isDev,
  isEmulator,
  normalizedEnv,
  platformOs,
  preferAndroidAdbReverse,
  value,
}) => {
  const normalized = normalizeText(value);
  if (!normalized || (!isDev && normalizedEnv !== 'local')) return normalized;

  try {
    const url = new URL(normalized);
    const host = String(url.hostname || '').trim().toLowerCase();
    if (!LOOPBACK_HOSTS.has(host)) return normalized;

    if (platformOs === 'android') {
      if (normalizedEnv === 'local' || isEmulator || preferAndroidAdbReverse) {
        url.hostname = 'localhost';
        return url.toString();
      }
      url.hostname = '10.0.2.2';
      return url.toString();
    }

    if (platformOs === 'ios' && isEmulator) {
      url.hostname = 'localhost';
      return url.toString();
    }
  } catch (_error) {
    return normalized;
  }

  return normalized;
};

const buildDevFallback = ({
  isEmulator,
  normalizedEnv,
  platformOs,
  preferAndroidAdbReverse,
}) => {
  if (platformOs === 'android') {
    if (normalizedEnv === 'local' || isEmulator || preferAndroidAdbReverse) {
      return {
        apiUrl: 'http://localhost:1337/api',
        publicOrigin: 'http://localhost:1337',
        socketUrl: 'http://localhost:1337',
        source: 'android-emulator-localhost-fallback',
      };
    }

    return {
      apiUrl: 'http://10.0.2.2:1337/api',
      publicOrigin: 'http://10.0.2.2:1337',
      socketUrl: 'http://10.0.2.2:1337',
      source: 'android-emulator-fallback',
    };
  }

  if (platformOs === 'ios' && isEmulator) {
    return {
      apiUrl: 'http://localhost:1337/api',
      publicOrigin: 'http://localhost:1337',
      socketUrl: 'http://localhost:1337',
      source: 'ios-simulator-fallback',
    };
  }

  if (platformOs === 'web') {
    const currentHostname = getCurrentWebHostname();
    const webHost = isPrivateIpv4Host(currentHostname) ? currentHostname : 'localhost';
    return {
      apiUrl: `http://${webHost}:1337/api`,
      publicOrigin: `http://${webHost}:1337`,
      socketUrl: `http://${webHost}:1337`,
      source: 'web-localhost-fallback',
    };
  }

  return null;
};

export const buildRuntimeEndpoints = ({
  apiPublicUrlEnv,
  apiUrlEnv,
  appEnv,
  isDev,
  isEmulator,
  platformOs,
  preferAndroidAdbReverse,
  socketUrlEnv,
}) => {
  const normalizedEnv = normalizeAppEnv(appEnv);
  const shouldPreferAndroidAdbReverse = platformOs === 'android'
    && isTruthyFlag(preferAndroidAdbReverse);
  const rewrittenApiValue = rewriteLoopbackForRuntime({
    isDev,
    isEmulator,
    normalizedEnv,
    platformOs,
    preferAndroidAdbReverse: shouldPreferAndroidAdbReverse,
    value: apiUrlEnv,
  });
  const rewrittenSocketValue = rewriteLoopbackForRuntime({
    isDev,
    isEmulator,
    normalizedEnv,
    platformOs,
    preferAndroidAdbReverse: shouldPreferAndroidAdbReverse,
    value: socketUrlEnv,
  });
  const rewrittenPublicOriginValue = rewriteLoopbackForRuntime({
    isDev,
    isEmulator,
    normalizedEnv,
    platformOs,
    preferAndroidAdbReverse: shouldPreferAndroidAdbReverse,
    value: apiPublicUrlEnv,
  });
  const explicitApiUrl = normalizeApiUrl(
    platformOs === 'web' ? rewriteLoopbackToCurrentWebHost(rewrittenApiValue) : rewrittenApiValue,
  );
  const explicitSocketUrl = normalizeSocketUrl(
    platformOs === 'web' ? rewriteLoopbackToCurrentWebHost(rewrittenSocketValue) : rewrittenSocketValue,
  );
  const explicitPublicOrigin = normalizeSocketUrl(
    platformOs === 'web' ? rewriteLoopbackToCurrentWebHost(rewrittenPublicOriginValue) : rewrittenPublicOriginValue,
  );
  const errors = [];
  const warnings = [];
  let source = 'explicit-env';

  let apiUrl = explicitApiUrl;
  let socketUrl = explicitSocketUrl;
  let publicOrigin = explicitPublicOrigin;

  if (!apiUrl && (isDev || normalizedEnv === 'local')) {
    const devFallback = buildDevFallback({
      isEmulator,
      normalizedEnv,
      platformOs,
      preferAndroidAdbReverse: shouldPreferAndroidAdbReverse,
    });
    if (devFallback) {
      apiUrl = devFallback.apiUrl;
      socketUrl = socketUrl || devFallback.socketUrl;
      publicOrigin = publicOrigin || devFallback.publicOrigin;
      source = devFallback.source;
    } else {
      source = 'missing-local-config';
    }
  }

  if (!publicOrigin && apiUrl) {
    publicOrigin = toPublicOrigin(apiUrl);
  }

  if (!socketUrl && publicOrigin) {
    socketUrl = publicOrigin;
    if (explicitApiUrl || explicitPublicOrigin) {
      warnings.push('SOCKET_URL missing, derived from API_URL/API_PUBLIC_URL.');
    }
  }

  const missingApiUrl = !apiUrl;
  const missingSocketUrl = !socketUrl;
  const isStrictEnv = normalizedEnv === 'staging' || normalizedEnv === 'production';
  const isNativeReleaseBuild = !isDev && (platformOs === 'android' || platformOs === 'ios');

  if (missingApiUrl) {
    errors.push(
      isStrictEnv
        ? 'API_URL is required for staging/production builds.'
        : 'API_URL is missing and no local fallback was available for this device.',
    );
  }

  if (missingSocketUrl) {
    errors.push(
      isStrictEnv
        ? 'SOCKET_URL is required for staging/production builds.'
        : 'SOCKET_URL is missing and could not be derived from the API origin.',
    );
  }

  const resolvedApiHost = getHostname(apiUrl);
  if (isNativeReleaseBuild && normalizedEnv === 'local') {
    errors.push(
      'Release builds cannot use APP_ENV=local. Build this app with staging or production runtime configuration.',
    );
  }

  if (isNativeReleaseBuild && resolvedApiHost && LOOPBACK_HOSTS.has(resolvedApiHost)) {
    errors.push(
      'Release builds cannot point API_URL to a loopback host such as localhost or 10.0.2.2.',
    );
  }

  if (resolvedApiHost && LOOPBACK_HOSTS.has(resolvedApiHost) && isDev && !isEmulator) {
    errors.push(
      'API_URL points to a loopback host on a physical device. Use a LAN or remote backend URL.',
    );
  }

  let uploadUrl = '';
  if (apiUrl) {
    uploadUrl = `${apiUrl}/upload`;
  } else if (publicOrigin) {
    uploadUrl = `${publicOrigin}/api/upload`;
  }

  return {
    apiUrl,
    appEnv: normalizedEnv,
    errors,
    isEmulator: Boolean(isEmulator),
    isStrictEnv,
    platformOs,
    publicOrigin: publicOrigin || DEFAULT_PUBLIC_ORIGIN,
    socketUrl,
    source,
    uploadUrl,
    warnings,
  };
};

export const describeRuntimeEndpointsForLog = (runtime) => ({
  apiUrl: runtime?.apiUrl || null,
  appEnv: runtime?.appEnv || 'local',
  errors: Array.isArray(runtime?.errors) ? runtime.errors : [],
  platformOs: runtime?.platformOs || 'unknown',
  publicOrigin: runtime?.publicOrigin || DEFAULT_PUBLIC_ORIGIN,
  socketUrl: runtime?.socketUrl || null,
  source: runtime?.source || 'unknown',
  warnings: Array.isArray(runtime?.warnings) ? runtime.warnings : [],
});
