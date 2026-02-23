import axios from 'axios/dist/browser/axios.cjs';
import { Platform } from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

// Fix for Android Emulator Localhost
// Only use 10.0.2.2 fallback if NO environment variable is provided
const baseURL = (__DEV__ && Platform.OS === 'android')
  ? (process.env.API_URL || 'http://10.0.2.2:1337/api')
  : process.env.API_URL;

const instance = axios.create({
  baseURL,
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

  // add current phone locale to the headers
  // newConfig.headers.locale = 'fr';

  if (token) {
    newConfig.headers.Authorization = `Bearer ${token}`;
  }

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
  if (axiosError.response
    && axiosError.response.status === 401
  ) {
    storage.delete('auth');
  }

  const timeoutMessage = axiosError?.code === 'ECONNABORTED'
    ? 'Request timeout - please retry.'
    : null;

  // Return the specific error object if available, otherwise the whole data, or the axios message
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
// const onRejected = (error) => Promise.reject(error?.response?.data);

instance.interceptors.request.use(onRequest);
instance.interceptors.response.use((res) => res, onRejected);

export default instance;
