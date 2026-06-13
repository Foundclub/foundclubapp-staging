import { Platform } from 'react-native';

import {
  buildRuntimeEndpoints,
  describeRuntimeEndpointsForLog,
} from './runtimeUrls.shared';

const readIsEmulator = () => {
  try {
    // Lazy require keeps tests and non-native environments from crashing.
    // eslint-disable-next-line global-require
    const { isEmulatorSync } = require('react-native-device-info');
    return Boolean(isEmulatorSync());
  } catch (_error) {
    return false;
  }
};

export const resolveRuntimeEndpoints = () => buildRuntimeEndpoints({
  apiPublicUrlEnv: process.env.API_PUBLIC_URL,
  apiUrlEnv: process.env.API_URL,
  appEnv: process.env.APP_ENV || process.env.ENV,
  isDev: __DEV__,
  isEmulator: readIsEmulator(),
  platformOs: Platform.OS,
  preferAndroidAdbReverse: (
    String(process.env.APP_ENV || process.env.ENV || '').trim().toLowerCase() === 'local'
      ? (process.env.LOCAL_ANDROID_USE_ADB_REVERSE || 'true')
      : process.env.LOCAL_ANDROID_USE_ADB_REVERSE
  ),
  socketUrlEnv: process.env.SOCKET_URL,
});

export const RUNTIME_ENDPOINTS = resolveRuntimeEndpoints();

export const getApiBaseUrl = () => resolveRuntimeEndpoints().apiUrl || '';
export const getSocketBaseUrl = () => resolveRuntimeEndpoints().socketUrl || '';
export const getPublicApiOrigin = () => resolveRuntimeEndpoints().publicOrigin || '';
export const getUploadEndpoint = () => resolveRuntimeEndpoints().uploadUrl || '';
export const getRuntimeEndpointsLog = () => describeRuntimeEndpointsForLog(
  resolveRuntimeEndpoints(),
);

export const assertRuntimeEndpointsReady = () => {
  const runtimeEndpoints = resolveRuntimeEndpoints();
  if (!Array.isArray(runtimeEndpoints.errors) || runtimeEndpoints.errors.length === 0) {
    return;
  }

  throw new Error(`[CONFIG][runtime-endpoints] ${runtimeEndpoints.errors.join(' ')}`);
};

export default RUNTIME_ENDPOINTS;
