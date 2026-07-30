import axios from 'axios/dist/browser/axios.cjs';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';
import {
  dispatchAuthRuntimeAction,
  getAuthRuntimeSnapshot,
} from '@/store/authRuntime';

import {
  assertBootRequestAllowed,
  assertSessionRequestAllowed,
  recordBootRequestFailure,
  recordBootRequestSuccess,
} from '@/services/bootRequestGuard';

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
  // Rejette sans réseau quand le circuit anti-rafale du boot est ouvert
  // (et avant trackBootNetworkRequest : un appel bloqué n'est pas une requête).
  assertBootRequestAllowed(axiosConfig);

  const token = getAuthTokens()?.token;

  // Rejette sans réseau les routes qui exigent une session quand il n'y a pas
  // de jeton : sans ça le serveur répond 403 et l'app recommence en boucle.
  assertSessionRequestAllowed(axiosConfig, { hasToken: Boolean(token) });

  const newConfig = { ...axiosConfig };

  if (token && !newConfig.headers?.Authorization) {
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
const onRejected = (error) => {
  recordBootRequestFailure(error);
  return resetAuth(error);
};

const onFulfilled = (/** @type {import('axios').AxiosResponse} */ res) => {
  recordBootRequestSuccess(res?.config);
  return res;
};

instance.interceptors.request.use(onRequest);
instance.interceptors.response.use(onFulfilled, onRejected);

export default instance;
