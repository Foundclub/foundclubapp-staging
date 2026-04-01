import { Platform } from 'react-native';

const runtimeModule = Platform.OS === 'web' ? require('./runtimeUrls.web') : require('./runtimeUrls.native');

export const {
  assertRuntimeEndpointsReady,
  getApiBaseUrl,
  getPublicApiOrigin,
  getRuntimeEndpointsLog,
  getSocketBaseUrl,
  getUploadEndpoint,
  resolveRuntimeEndpoints,
  RUNTIME_ENDPOINTS,
} = runtimeModule;

export default runtimeModule.default || runtimeModule.RUNTIME_ENDPOINTS;
