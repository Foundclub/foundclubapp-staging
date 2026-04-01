import {
  buildRuntimeEndpoints,
  describeRuntimeEndpointsForLog,
} from './runtimeUrls.shared';

export const resolveRuntimeEndpoints = () => buildRuntimeEndpoints({
  apiPublicUrlEnv: process.env.API_PUBLIC_URL,
  apiUrlEnv: process.env.API_URL,
  appEnv: process.env.APP_ENV || process.env.ENV,
  isDev: __DEV__,
  isEmulator: false,
  platformOs: 'web',
  socketUrlEnv: process.env.SOCKET_URL,
});

export const RUNTIME_ENDPOINTS = resolveRuntimeEndpoints();

export const getApiBaseUrl = () => resolveRuntimeEndpoints().apiUrl || '';
export const getSocketBaseUrl = () => resolveRuntimeEndpoints().socketUrl || '';
export const getPublicApiOrigin = () => resolveRuntimeEndpoints().publicOrigin || '';
export const getUploadEndpoint = () => resolveRuntimeEndpoints().uploadUrl || '';
export const getRuntimeEndpointsLog = () => describeRuntimeEndpointsForLog(resolveRuntimeEndpoints());

export const assertRuntimeEndpointsReady = () => {
  const runtimeEndpoints = resolveRuntimeEndpoints();
  if (!Array.isArray(runtimeEndpoints.errors) || runtimeEndpoints.errors.length === 0) {
    return;
  }

  throw new Error(`[CONFIG][runtime-endpoints] ${runtimeEndpoints.errors.join(' ')}`);
};

export default RUNTIME_ENDPOINTS;
