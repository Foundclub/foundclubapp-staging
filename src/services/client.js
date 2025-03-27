/* eslint-disable no-underscore-dangle */
import axios from 'axios';
// Utils
import { getAuthTokens } from '../domains/EXAMPLE-auth/EXAMPLE-authUseCases';
import { storage } from '../store/appContext';

const instance = axios.create({
  baseURL: process.env.API_URL,
  timeout: 5000,
});

/**
 * Axios interceptor to pass the JWT token if exists
 * @param {import('axios').InternalAxiosRequestConfig} axiosConfig - The axios config.
 * @returns {import('axios').InternalAxiosRequestConfig} The axios config with the token.
 */
const onRequest = (axiosConfig) => {
  const token = getAuthTokens()?.accessToken;
  const newConfig = { ...axiosConfig };

  // add current phone locale to the headers
  newConfig.headers.locale = 'fr';

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
const refreshAccessToken = async (axiosError) => {
  const originalRequest = axiosError.config;

  if (axiosError.response
    && axiosError.response.status === 401
    && !originalRequest._retry
    && originalRequest.url !== '/login'
    && originalRequest.url !== '/token/refresh'
  ) {
    originalRequest._retry = true;

    try {
      const response = await instance.post(
        '/token/refresh',
        { refresh_token: getAuthTokens().refreshToken },
      );
      const newAccessToken = response.data.token;
      storage.set('auth', JSON.stringify(response.data));
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return axios(originalRequest);
    } catch (refreshError) {
      // eslint-disable-next-line no-console
      console.error('Unable to refresh token:', refreshError);
      storage.delete('auth');
    }
  }
  if (axiosError.response
    && axiosError.response.status === 401
    && originalRequest.url === '/token/refresh') {
    storage.delete('auth');
  }

  return Promise.reject(axiosError);
};

/**
 * Axios interceptor to manage API response
 * @param {import('axios').AxiosError<any, any>
 * & { config: { _retry?: boolean; }; }} error - The axios error.
 * @returns {Promise<any>} The axios response.
 */
const onRejected = (error) => refreshAccessToken(error);
// const onRejected = (error) => Promise.reject(error?.response?.data);

instance.interceptors.request.use(onRequest);
instance.interceptors.response.use((res) => res, onRejected);

export default instance;
