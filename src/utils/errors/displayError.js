import i18next from 'i18next';
import { Alert } from 'react-native';

const TECHNICAL_ERROR_PATTERNS = [
  /^HTTP(?: error)? \d+$/i,
  /^Request failed with status code \d+$/i,
  /^Network Error$/i,
  /^Network request failed$/i,
  /^Only club managers can process facility override requests$/i,
  /^Unexpected token </i,
  /^Rendered more hooks than during the previous render/i,
  /^Cannot read propert(?:y|ies) of/i,
  /^\[object Object\]$/i,
];

const STATUS_TO_I18N_KEY = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'Request failed with status code 404',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'INTERNAL_SERVER_ERROR',
  503: 'INTERNAL_SERVER_ERROR',
  504: 'INTERNAL_SERVER_ERROR',
};

const normalizeString = (value) => String(value || '').trim();

const extractErrorCode = (error) => {
  if (!error || typeof error === 'string') {
    return normalizeString(error);
  }

  return normalizeString(
    error?.details?.code
    || error?.response?.data?.error?.details?.code
    || error?.code,
  );
};

const extractErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return normalizeString(error);

  return normalizeString(
    error?.response?.data?.details?.error
    || error?.response?.data?.error?.details?.error
    || error?.details?.error
    || error?.response?.data?.error?.message
    || error?.error?.message
    || error?.details?.message
    || error?.message,
  );
};

const extractErrorStatus = (error) => {
  if (!error) return null;

  if (typeof error === 'number' && Number.isFinite(error)) {
    return error;
  }

  if (typeof error === 'string') {
    const statusMatch = error.match(/status code (\d{3})/i) || error.match(/^HTTP(?: error)? (\d{3})$/i);
    return statusMatch ? Number(statusMatch[1]) : null;
  }

  const rawStatus = error?.status || error?.response?.status || error?.error?.status;
  const parsedStatus = Number(rawStatus);
  return Number.isFinite(parsedStatus) ? parsedStatus : null;
};

const resolveMappedErrorKey = (rawCodeOrMessage, status) => {
  if (status && STATUS_TO_I18N_KEY[status]) {
    return STATUS_TO_I18N_KEY[status];
  }

  const normalized = normalizeString(rawCodeOrMessage);
  if (!normalized) return '';

  if (/^Only club managers can process facility override requests$/i.test(normalized)) {
    return 'FORBIDDEN';
  }

  if (/^Network (Error|request failed)$/i.test(normalized)) {
    return 'generic';
  }

  return normalized;
};

const isTechnicalErrorMessage = (message) => (
  TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(normalizeString(message)))
);

/**
 * Get the error message for the given error payload.
 * @param {string | { message?: string, details?: { error?: string, message?: string, code?: string }, response?: { status?: number, data?: { details?: { error?: string }, error?: { message?: string, details?: { error?: string, code?: string } } } }, error?: { status?: number, message?: string }, status?: number, code?: string }} errorInput
 * @param {string} [genericI18nKey] - The generic i18n key to use if the error code is not found.
 * @returns {string} The error message
 */
export const getErrorMessage = (errorInput, genericI18nKey = 'generic') => {
  const errorCode = extractErrorCode(errorInput);
  const errorMessage = extractErrorMessage(errorInput);
  const errorStatus = extractErrorStatus(errorInput);
  const mappedCode = resolveMappedErrorKey(errorCode, errorStatus);
  const mappedMessage = resolveMappedErrorKey(errorMessage, errorStatus);

  if (mappedCode && i18next.exists(`APIerrors.${mappedCode}`)) {
    return i18next.t(`APIerrors.${mappedCode}`);
  }

  if (mappedMessage && i18next.exists(`APIerrors.${mappedMessage}`)) {
    return i18next.t(`APIerrors.${mappedMessage}`);
  }

  const candidate = mappedMessage || mappedCode;
  if (!candidate || typeof candidate !== 'string') {
    return i18next.t(`APIerrors.${genericI18nKey}`);
  }

  if (candidate.startsWith('API response do not match')) {
    return i18next.t('APIerrors.schemaMismatch');
  }

  if (__DEV__ && !isTechnicalErrorMessage(candidate)) {
    return candidate;
  }

  return i18next.t(`APIerrors.${genericI18nKey}`);
};

/**
 * Display an error alert with the given error code.
 * @param {{message: string, details?: {message: string, code: string}}} error
 * @param {string} [genericI18nKey] - The generic i18n key to use if the error code is not found.
 * @returns {void}
 */
export const displayErrorAlert = (error, genericI18nKey = 'generic') => {
  const message = getErrorMessage(error, genericI18nKey);
  return Alert.alert(i18next.t('APIerrors.title'), message);
};
