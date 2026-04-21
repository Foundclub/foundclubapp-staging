import axios from 'axios/dist/browser/axios.cjs';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';
import {
  dispatchAuthRuntimeAction,
  getAuthRuntimeSnapshot,
} from '@/store/authRuntime';

import { trackBootNetworkRequest } from '@/utils/performance/bootPerformance';

import { assertRuntimeEndpointsReady, getApiBaseUrl } from '@/config/runtimeUrls';

assertRuntimeEndpointsReady();

const instance = axios.create({
  baseURL: getApiBaseUrl() || undefined,
  // Some custom actions (league score/validation) can exceed 5s on local dev.
  timeout: 15000,
});

/**
 * Axios interceptor to pass the JWT token if exists
 * @param {import('axios').InternalAxiosRequestConfig} axiosConfig - The axios config.
 * @returns {import('axios').InternalAxiosRequestConfig} The axios config with the token.
 */
const onRequest = (axiosConfig) => {
  const token = getAuthTokens()?.token;
  const newConfig = { ...axiosConfig };

  if (token) {
    newConfig.headers.Authorization = `Bearer ${token}`;
  }

  trackBootNetworkRequest({
    method: newConfig.method,
    url: `${newConfig.baseURL || ''}${newConfig.url || ''}`,
  });

  return newConfig;
};

/**
 * Refresh the access token
 * @param {import('axios').AxiosError
 * & { config: { _retry?: boolean }}} axiosError - The axios error.
 * @returns {Promise<import('axios')
 * .AxiosResponse|import('axios').AxiosError>} The axios response or error.
 */
const resetAuth = async (axiosError) => {
  const requestAuthorizationHeader = axiosError?.config?.headers?.Authorization;
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  const currentAuthorizationHeader = runtimeSnapshot?.auth?.token
    ? `Bearer ${runtimeSnapshot.auth.token}`
    : undefined;
  if (axiosError.response
    && axiosError.response.status === 401
    && typeof requestAuthorizationHeader === 'string'
    && requestAuthorizationHeader === currentAuthorizationHeader
  ) {
    const didDispatch = dispatchAuthRuntimeAction({ type: 'LOGOUT_CURRENT_SESSION' });
    if (!didDispatch) {
      storage.delete('activeSessionDocumentId');
      storage.delete('auth');
      storage.delete('authSessions');
    }
  }

  const timeoutMessage = axiosError?.code === 'ECONNABORTED'
    ? 'Request timeout - please retry.'
    : null;

  return Promise.reject(
    axiosError?.response?.data?.error
    || axiosError?.response?.data
    || timeoutMessage
    || axiosError?.message
    || 'Unknown error',
  );
};

/**
 * Axios interceptor to manage API response
 * @param {import('axios').AxiosError<any, any>
 * & { config: { _retry?: boolean; }; }} error - The axios error.
 * @returns {Promise<any>} The axios response.
 */
const onRejected = (error) => resetAuth(error);

instance.interceptors.request.use(onRequest);
instance.interceptors.response.use((res) => res, onRejected);

export default instance;
