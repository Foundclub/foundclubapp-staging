import i18next from 'i18next';
import { Alert } from 'react-native';

/**
 * Get the error message for the given error code.
 * @param {string} errorCode - The error code to get the message for.
 * @param {string} [genericI18nKey] - The generic i18n key to use if the error code is not found.
 * @returns {string} The error message
 */
export const getErrorMessage = (errorCode, genericI18nKey = 'generic') => {
  if (!errorCode || typeof errorCode !== 'string') {
    return i18next.t(`APIerrors.${genericI18nKey}`);
  }
  if (errorCode.startsWith('API response do not match')) {
    return i18next.t('APIerrors.schemaMismatch');
  }
  if (i18next.exists(`APIerrors.${errorCode}`)) {
    return i18next.t(`APIerrors.${errorCode}`);
  }
  return __DEV__ ? errorCode : i18next.t(`APIerrors.${genericI18nKey}`);
};

/**
 * Display an error alert with the given error code.
 * @param {{message: string, details?: {message: string, code: string}}} error
 * @param {string} [genericI18nKey] - The generic i18n key to use if the error code is not found.
 * @returns {void}
 */
export const displayErrorAlert = (error, genericI18nKey = 'generic') => {
  const code = error?.details?.code || error?.message;
  const message = getErrorMessage(code, genericI18nKey);
  return Alert.alert(i18next.t('APIerrors.title'), message);
};
