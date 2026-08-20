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
 * Separe ce que l'on SAIT traduire de ce que l'on ne fait que recopier.
 *
 * L'ordre des trois cles est celui d'origine et il compte : un code explicite du
 * serveur bat le statut HTTP. Sans lui, `resolveMappedErrorKey` court-circuite sur
 * le statut et TOUT 403 devient « Acces refuse. » — un refus payant
 * (SUBSCRIPTION_PERMISSION_DENIED) perdrait son motif avant meme d'etre lu.
 * @param {any} errorInput
 * @returns {{ candidate: string, translated: string }} `translated` vide = rien de traduisible.
 */
const resolveApiError = (errorInput) => {
  const errorCode = extractErrorCode(errorInput);
  const errorMessage = extractErrorMessage(errorInput);
  const errorStatus = extractErrorStatus(errorInput);

  const mappedCode = resolveMappedErrorKey(errorCode, errorStatus);
  const mappedMessage = resolveMappedErrorKey(errorMessage, errorStatus);

  const translatableKey = [errorCode, mappedCode, mappedMessage]
    .find((key) => key && i18next.exists(`APIerrors.${key}`));

  return {
    candidate: mappedMessage || mappedCode,
    translated: translatableKey ? i18next.t(`APIerrors.${translatableKey}`) : '',
  };
};

/**
 * Le CODE que le serveur a explicitement envoye, ou chaine vide.
 *
 * AB05 — ouvert a la lecture parce qu'un ecran qui veut dire POURQUOI a besoin
 * de separer les deux : un code explicite est un motif, un statut HTTP n'est
 * qu'un mur. `getApiErrorTranslation` fusionne les deux volontairement (un 403
 * nu doit bien finir par dire quelque chose) ; qui veut trancher lit ce code-ci
 * d'abord. ⛔ Aucun comportement ne change : c'est le meme lecteur qu'avant,
 * simplement nomme.
 * @param {any} errorInput
 * @returns {string} Le code serveur, ou '' s'il n'y en a pas.
 */
export const getServerErrorCode = (errorInput) => extractErrorCode(errorInput);

/**
 * Le statut HTTP porte par l'erreur, ou `null`.
 *
 * AB05 — meme motif : l'ecran qui redige un refus a besoin de savoir s'il parle
 * d'un 403 (droit manquant), d'un 404 (l'objet a disparu) ou d'un 401 (session
 * finie). Ces trois-la ne se disent pas de la meme facon.
 * @param {any} errorInput
 * @returns {number | null} Le statut, ou null.
 */
export const getErrorStatus = (errorInput) => extractErrorStatus(errorInput);

/**
 * Traduction francaise d'une erreur API, ou chaine VIDE si aucune ne correspond.
 *
 * A preferer a `getErrorMessage` partout ou l'appelant dispose deja d'un repli
 * redige en francais : ce helper ne rend jamais la phrase brute du serveur.
 * @param {any} errorInput
 * @returns {string} La traduction, ou '' si le serveur n'a envoye aucun code connu.
 */
export const getApiErrorTranslation = (errorInput) => resolveApiError(errorInput).translated;

/**
 * Get the error message for the given error payload.
 * @param {string | { message?: string, details?: { error?: string, message?: string, code?: string }, response?: { status?: number, data?: { details?: { error?: string }, error?: { message?: string, details?: { error?: string, code?: string } } } }, error?: { status?: number, message?: string }, status?: number, code?: string }} errorInput
 * @param {string} [genericI18nKey] - The generic i18n key to use if the error code is not found.
 * @returns {string} The error message
 */
export const getErrorMessage = (errorInput, genericI18nKey = 'generic') => {
  const { candidate, translated } = resolveApiError(errorInput);

  if (translated) {
    return translated;
  }

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
