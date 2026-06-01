// @ts-nocheck
import { format } from 'date-fns';
import Joi from 'joi';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/config/runtimeUrls';
import {
  confirmOtp,
  getCurrentUser,
  logout as platformLogout,
  onAuthStateChanged as subscribeToPlatformAuthState,
  sendOtp,
} from '@/platform/auth';
import client from '@/services/client';
import { formatBootMeta } from '@/utils/performance/bootPerformance';
import { getAppVersion, getDeviceId } from '@/platform/device';

import {
  getResolvedAuthAppEnv,
  isFirebaseBypassEnabled,
  isWebQaPhoneBypassEnabled,
} from './bypassPolicy';

const isLocalAppEnvironment = () => getResolvedAuthAppEnv() === 'local';
const isNetworkError = (error) => {
  const statusCode = error?.status || error?.response?.status;
  const message = String(error?.message || error || '').toLowerCase();
  return !statusCode && message.includes('network');
};

const WEB_QA_BYPASS_FLAG = '__webQaBypass';
const LOCAL_FIREBASE_FALLBACK_FLAG = '__localFirebaseFallbackBypass';
const BYPASS_LOGIN_RETRY_DELAYS_MS = [0, 800, 1800];

const createBypassConfirmation = (phoneNumber, extra = {}) => ({
  confirm: async () => ({ phoneNumber }),
  phoneNumber,
  verificationId: 'bypass-verification-id',
  ...extra,
});

const wait = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

/**
 * @param {any} error
 * @returns {boolean}
 */
const shouldFallbackToLocalBypass = (error) => {
  if (!isLocalAppEnvironment()) return false;

  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('auth/app-not-authorized')
    || message.includes('play_integrity_token')
    || message.includes('invalid app info')
  );
};

/**
 * @param {any} confirmation
 * @param {string} flag
 * @returns {boolean}
 */
const hasBypassConfirmationFlag = (confirmation, flag) => (
  Boolean(confirmation && confirmation[flag] === true)
);

/**
 * @param {...any} args
 */
const logAuthDebug = (...args) => {
  if (isLocalAppEnvironment()) {
    // Keep verbose auth logs strictly local to avoid noisy production runtime logs.
    console.log(...args);
  }
};

/**
 * User validation schema
 */
const userSchema = Joi.object({
  avatar: Joi.object().allow(null).optional(),
  bestLevel: Joi.string().allow(null, '').optional(),
  birthdate: Joi.string().isoDate().allow(null).optional(),
  category: Joi.string().allow(null, '').optional(),
  clubMembershipRequests: Joi.array().items(Joi.object({
    club: Joi.object().optional(),
    documentId: Joi.string().required(),
    state: Joi.string().required(),
  })).optional(),
  documentId: Joi.string().allow(null, '').optional(),
  email: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().allow(null, '').optional(),
  geohash: Joi.string().allow(null, '').optional(),
  height: Joi.number().allow(null, '').optional(),
  id: Joi.number().required(),
  isLookingForClub: Joi.boolean().allow(null).optional(),
  lastname: Joi.string().allow(null, '').optional(),
  nonPartnerCoachPublishingAccess: Joi.object({
    canPublish: Joi.boolean().allow(null).optional(),
    clubDocumentId: Joi.string().allow(null, '').optional(),
    isNonPartnerCoach: Joi.boolean().allow(null).optional(),
    overrideAllowed: Joi.boolean().allow(null).optional(),
    reason: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  parentalDeclarantUserDocumentId: Joi.string().allow(null, '').optional(),
  parentalDeclarationAccepted: Joi.boolean().allow(null).optional(),
  parentalDeclarationAcceptedAt: Joi.string().isoDate().allow(null).optional(),
  phoneNumber: Joi.string().required(),
  position: Joi.string().allow(null, '').optional(),
  preferredSport: Joi.string().allow(null, '').optional(),
  section: Joi.object().allow(null).optional(),
  weight: Joi.number().allow(null, '').optional(),
}).required();

/**
 * Public user profile schema (for getUserById on another user profile)
 * Keep this schema independent from "me" to allow strict field minimization
 * on backend without breaking profile views.
 */
const appImageSummarySchema = Joi.object({
  url: Joi.string().allow(null, '').optional(),
}).allow(null);

const appEntitySummarySchema = Joi.object({
  documentId: Joi.string().allow(null, '').optional(),
  id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null).optional(),
  name: Joi.string().allow(null, '').optional(),
}).allow(null);

const appClubSummarySchema = Joi.object({
  documentId: Joi.string().allow(null, '').optional(),
  id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null).optional(),
  isCustomer: Joi.boolean().allow(null).optional(),
  logo: appImageSummarySchema.optional(),
  name: Joi.string().allow(null, '').optional(),
  parentMultisport: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
    id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null).optional(),
    isCustomer: Joi.boolean().allow(null).optional(),
    logo: appImageSummarySchema.optional(),
    name: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
}).allow(null);

const appTeamSummarySchema = Joi.object({
  activities: Joi.array().items(appEntitySummarySchema).optional(),
  category: appEntitySummarySchema.optional(),
  club: appClubSummarySchema.optional(),
  documentId: Joi.string().allow(null, '').optional(),
  externalCompetitionEligible: Joi.boolean().allow(null).optional(),
  externalProvider: Joi.string().valid('fff', 'ffbb').allow(null, '').optional(),
  externalStandingUrl: Joi.string().allow(null, '').optional(),
  externalSyncStatus: Joi.string().allow(null, '').optional(),
  id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null).optional(),
  level: appEntitySummarySchema.optional(),
  name: Joi.string().allow(null, '').optional(),
  section: appEntitySummarySchema.optional(),
}).allow(null);

const publicUserSchema = Joi.object({
  avatar: appImageSummarySchema.optional(),
  bestLevel: Joi.string().allow(null, '').optional(),
  birthdate: Joi.string().isoDate().allow(null).optional(),
  category: Joi.string().allow(null, '').optional(),
  club: appClubSummarySchema.optional(),
  documentId: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().allow(null, '').optional(),
  height: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
  id: Joi.number().required(),
  isLookingForClub: Joi.boolean().allow(null).optional(),
  lastname: Joi.string().allow(null, '').optional(),
  myTeams: Joi.array().items(appTeamSummarySchema).optional(),
  parentAccount: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  position: Joi.string().allow(null, '').optional(),
  preferredSport: Joi.string().allow(null, '').optional(),
  role: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
    id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null).optional(),
    name: Joi.string().allow(null, '').optional(),
    type: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  section: appEntitySummarySchema.optional(),
  sportsHistory: Joi.string().allow(null, '').optional(),
  trainedTeams: Joi.array().items(appTeamSummarySchema).optional(),
  weight: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
}).required();

/**
 * Role validation schema
 */
const roleSchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Sign in with phone number
 * @param {string} phoneNumber - The phone number
 * @returns {Promise<import('@react-native-firebase/auth')
 * .FirebaseAuthTypes.ConfirmationResult>} The promise
 */
export const signInWithPhoneNumber = async (phoneNumber) => {
  // BYPASS MODE: Skip Firebase and return fake confirmation
  if (isFirebaseBypassEnabled()) {
    logAuthDebug('[BYPASS] Firebase Auth bypassed - returning fake confirmation');
    return Promise.resolve(createBypassConfirmation(phoneNumber, {
      [LOCAL_FIREBASE_FALLBACK_FLAG]: true,
      verificationId: 'local-bypass-verification-id',
    }));
  }

  if (Platform.OS === 'web' && isWebQaPhoneBypassEnabled(phoneNumber)) {
    return Promise.resolve({
      [WEB_QA_BYPASS_FLAG]: true,
      ...createBypassConfirmation(phoneNumber, {
        verificationId: 'web-qa-bypass-verification-id',
      }),
    });
  }

  try {
    const result = await sendOtp(phoneNumber);
    return Promise.resolve(result);
  } catch (e) {
    if (shouldFallbackToLocalBypass(e)) {
      logAuthDebug('[BYPASS] Firebase local fallback engaged after native auth rejection');
      return Promise.resolve(createBypassConfirmation(phoneNumber, {
        [LOCAL_FIREBASE_FALLBACK_FLAG]: true,
        verificationId: 'local-fallback-bypass-verification-id',
      }));
    }
    return Promise.reject(e);
  }
};

/**
 * Confirm OTP code and login
 * @param {object} params
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.ConfirmationResult
 * } params.confirm - The confirmation object
 * @param {string} params.code - The OTP code
 * @returns {Promise<{
 *   idToken: string,
 *   idUser?: import('@react-native-firebase/auth').FirebaseAuthTypes.User,
 *   token: string
 * }>} The promise
 */
export const login = async ({ code, confirm }) => {
  // BYPASS MODE: Skip Firebase and login directly with phone number
  if (
    isFirebaseBypassEnabled()
    || hasBypassConfirmationFlag(confirm, WEB_QA_BYPASS_FLAG)
    || hasBypassConfirmationFlag(confirm, LOCAL_FIREBASE_FALLBACK_FLAG)
  ) {
    logAuthDebug('[BYPASS] Firebase Auth bypassed - logging in directly with phone number');
    logAuthDebug('[BYPASS] confirm object received:', JSON.stringify(confirm));
    const phoneNumber = typeof confirm?.phoneNumber === 'string' ? confirm.phoneNumber.trim() : '';
    if (!phoneNumber) {
      throw new Error('Missing phone number in confirmation. Please restart login.');
    }
    logAuthDebug('[BYPASS] phoneNumber to send to API:', phoneNumber);

    try {
      /** @type {any} */
      let result;
      /** @type {any} */
      let lastNetworkError;

      for (let index = 0; index < BYPASS_LOGIN_RETRY_DELAYS_MS.length; index += 1) {
        const retryDelayMs = BYPASS_LOGIN_RETRY_DELAYS_MS[index];
        if (retryDelayMs > 0) {
          await wait(retryDelayMs);
        }

        try {
          result = await client.post('/firebase-auth/login-bypass', { code, phoneNumber });
          lastNetworkError = undefined;
          break;
        } catch (error) {
          if (!isNetworkError(error) || index === BYPASS_LOGIN_RETRY_DELAYS_MS.length - 1) {
            throw error;
          }

          lastNetworkError = error;
          logAuthDebug(
            `[BYPASS] login-bypass network retry ${index + 1}/${BYPASS_LOGIN_RETRY_DELAYS_MS.length - 1}`,
            error?.message || error,
          );
        }
      }

      if (!result && lastNetworkError) {
        throw lastNetworkError;
      }

      logAuthDebug('[BYPASS] Login API response received, jwt:', !!result.data?.jwt);
      const schema = Joi.object({
        data: Joi.object().required(),
        jwt: Joi.string().required(),
      }).required();
      await schema.validateAsync(result.data, { allowUnknown: true });

      const userData = result.data.data || result.data.user;
      logAuthDebug('[BYPASS] User data extracted, documentId:', userData?.documentId);

      const authResult = {
        idToken: 'bypass-token',
        idUser: { phoneNumber },
        token: result.data.jwt,
        user: userData,
      };
      logAuthDebug('[BYPASS] Returning auth result with user documentId:', authResult.user?.documentId);
      return authResult;
    } catch (error) {
      const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
      throw new Error(`Bypass login failed: ${errorToDisplay}`);
    }
  }

  // NORMAL MODE: Use Firebase Auth
  // Check if user is already authenticated (auto-verification case)
  const currentUser = getCurrentUser();

  let firebaseResult;
  if (currentUser) {
    firebaseResult = { user: currentUser };
  } else {
    firebaseResult = await confirmOtp({ code, confirmation: confirm });
  }
  const idToken = await firebaseResult?.user.getIdToken() || '';

  const result = await client.post('/firebase-auth/login', { idToken });
  try {
    const schema = Joi.object({
      data: Joi.object().required(),
      jwt: Joi.string().required(),
    }).required();
    await schema.validateAsync(result.data, { allowUnknown: true });

    return {
      idToken,
      idUser: firebaseResult?.user,
      token: result.data.jwt,
      user: result.data.data || result.data.user,
    };
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`API response does not match getCurrentUser Schema: ${errorToDisplay}`);
  }
};

export const logout = async () => {
  if (isFirebaseBypassEnabled()) {
    return Promise.resolve();
  }

  try {
    if (!getCurrentUser()) {
      return Promise.resolve();
    }

    await platformLogout();
    return Promise.resolve();
  } catch (e) {
    if (e?.code === 'auth/no-current-user') {
      return Promise.resolve();
    }
    return Promise.reject(e);
  }
};

/**
 * Subscribe to auth state changes
 * @param {Function} onAuthStateChanged
 * @returns {Function} unsubscribe
 */
export const subscribeToAuthState = (onAuthStateChanged) => {
  if (typeof onAuthStateChanged !== 'function') {
    return () => {};
  }

  return subscribeToPlatformAuthState(onAuthStateChanged);
};

/**
 * Get current user
 * @returns {Promise<User>}
 */
// ... existing code ...
export const getMe = async () => {
  const result = await client.get('/firebase-auth/me');
  try {
    const validationResult = await userSchema.validateAsync(result.data.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    // ... existing code ...
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch user data: ${errorToDisplay}`);
  }
};

/**
 * Update user by ID
 * @param {User} userData - The user data to update
 * @returns {Promise<User>} Updated user data
 */
export const updateMe = async (userData) => {
  try {
    const formData = new FormData();

    // Create a copy to avoid modifying the parameter directly
    const userDataCopy = {
      ...userData,
      birthdate: normalizeBirthdateToIso(userData.birthdate),
      legalAcceptance: userData.legalAcceptance,
      parentalDeclarationAccepted: userData.parentalDeclarationAccepted,
      role: userData.role?.documentId || userData?.role,
      section: userData.section?.documentId || userData?.section,
    };

    // Remove empty properties (undefined, null, or empty string)
    Object.keys(userDataCopy).forEach((key) => {
      // @ts-expect-error because keys are defined just above
      if (userDataCopy?.[key] === undefined || userDataCopy?.[key] === null || userDataCopy?.[key] === '') {
        // @ts-expect-error because keys are defined just above
        delete userDataCopy?.[key];
      }
    });

    logAuthDebug('[updateMe] base payload:', JSON.stringify(userDataCopy));

    // Handle avatar file separately
    const avatarPath = userDataCopy?.avatar?.path || userDataCopy?.avatar?.uri;
    if (userDataCopy.avatar && avatarPath) {
      const normalizedUri = (Platform.OS === 'ios' && avatarPath.startsWith('file://'))
        ? avatarPath.replace('file://', '')
        : avatarPath;
      const extension = normalizedUri.split('.').pop()?.toLowerCase();
      const fallbackExtension = extension && extension.length <= 4 ? extension : 'jpg';
      const defaultMimeType = fallbackExtension === 'png' ? 'image/png' : 'image/jpeg';
      const fileToUpload = {
        name: userDataCopy.avatar.filename
          || userDataCopy.avatar.fileName
          || `avatar.${fallbackExtension}`,
        type: userDataCopy.avatar.mime || userDataCopy.avatar.type || defaultMimeType,
        uri: normalizedUri,
      };

      logAuthDebug('[updateMe] Avatar file to upload:', fileToUpload);

      if (!fileToUpload.uri || !fileToUpload.type || !fileToUpload.name) {
        console.warn('[updateMe] Invalid file properties!');
      }

      // @ts-expect-error because of react native image type
      formData.append('avatar', fileToUpload);
    }
    delete userDataCopy.avatar;

    // Append all other user data
    Object.entries(userDataCopy).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        let valueToSend = value;
        if (typeof value === 'object' && !(value instanceof Date) && key !== 'avatar') {
          valueToSend = JSON.stringify(value);
        } else {
          valueToSend = value.toString();
        }
        logAuthDebug(`[updateMe] Appending ${key}: ${valueToSend}`);
        formData.append(key, valueToSend);
      }
    });

    const resolvedApiBaseUrl = client?.defaults?.baseURL || getApiBaseUrl();
    if (!resolvedApiBaseUrl) {
      throw new Error('API base URL is missing');
    }
    const endpoint = `${resolvedApiBaseUrl.replace(/\/$/, '')}/firebase-auth/update`;

    logAuthDebug('[updateMe] Sending request to /firebase-auth/update via fetch');
    const { getAuthTokens } = require('../../domains/auth/authUseCases');
    const auth = getAuthTokens();

    // Use native fetch to avoid Axios/FormData issues on Android
    const response = await fetch(endpoint, {
      body: formData,
      headers: {
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        // Do NOT set Content-Type, let fetch generate the boundary
      },
      method: 'PUT',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || errorData?.message || `HTTP error ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = { data: await response.json() };
    const validationResult = await userSchema.validateAsync(result.data.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to update user data: ${errorToDisplay}`);
  }
};

/**
 * Create a trainer
 * @param {Partial<User> & { clubId?: string }} userData
 * @returns {Promise<object>} The created trainer data
 */
export const createTrainer = async (userData) => {
  const formData = new FormData();

  const userDataCopy = {
    ...userData,
    username: userData.phoneNumber,
  };

  if (userData.birthdate) {
    // Parser la date DD/MM/YYYY manuellement car new Date() peut échouer
    const [day, month, year] = userData.birthdate.split('/');
    if (day && month && year) {
      const dateObject = new Date(`${year}-${month}-${day}`);
      if (!isNaN(dateObject.getTime())) {
        userDataCopy.birthdate = format(dateObject, 'yyyy-MM-dd');
      } else {
        delete userDataCopy.birthdate; // Date invalide
      }
    } else {
      // Format peut-être déjà YYYY-MM-DD ou invalide ?
      // On essaie de l'utiliser tel quel si valide, sinon on supprime
      const fallbackDate = new Date(userData.birthdate);
      if (!isNaN(fallbackDate.getTime())) {
        userDataCopy.birthdate = format(fallbackDate, 'yyyy-MM-dd');
      } else {
        delete userDataCopy.birthdate;
      }
    }
  } else {
    delete userDataCopy.birthdate;
  }

  // Remove empty properties (undefined, null, or empty string)
  Object.keys(userDataCopy).forEach((key) => {
    // @ts-expect-error because keys are defined just above
    if (userDataCopy?.[key] === undefined || userDataCopy?.[key] === null || userDataCopy?.[key] === '') {
      // @ts-expect-error because keys are defined just above
      delete userDataCopy?.[key];
    }
  });

  // Handle avatar file separately
  if (userDataCopy.avatar && userDataCopy.avatar.path) {
    const fileToUpload = {
      name: userDataCopy.avatar.filename || `image.${userDataCopy.avatar.path.split('.').pop()}`,
      type: userDataCopy.avatar.mime,
      uri: Platform.OS === 'ios' ? userDataCopy.avatar.path.replace('file://', '') : userDataCopy.avatar.path,
    };
    // @ts-expect-error because of react native image type
    formData.append('avatar', fileToUpload);
    delete userDataCopy.avatar;
  }

  // Append all other user data
  Object.entries(userDataCopy).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value.toString());
    }
  });

  logAuthDebug('[createTrainer] Sending formData:', JSON.stringify(userDataCopy));

  try {
    const result = await client.post(
      '/firebase-auth/create-trainer',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    const validationResult = await userSchema.validateAsync(result.data.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to create trainer: ${errorToDisplay}`);
  }
};

/**
 * Remove a trainer from my team
 * @param {string} id
 * @returns {Promise<object>} The created trainer data
 */
export const removeTrainerFromClub = async (id) => {
  const result = await client.put(`/firebase-auth/remove-trainer-from-club/${id}`);
  return result.data;
};

/**
 * Leave my current club
 * @returns {Promise<object>} The API response
 */
export const leaveClub = async () => {
  const result = await client.post('/firebase-auth/me/leave-club');
  return result.data;
};

/**
 * Link a trainer to my club
 * @param {string | { trainerId: string, clubId?: string }} id
 * @returns {Promise<object>} The linked trainer data
 */
export const linkTrainerToClub = async (id) => {
  const trainerId = typeof id === 'string' ? id : id?.trainerId;
  const clubId = typeof id === 'object' && id !== null ? id.clubId : undefined;
  const result = await client.put(
    `/firebase-auth/add-trainer-to-club/${trainerId}`,
    clubId ? { clubId } : undefined,
  );
  try {
    const validationResult = await userSchema.validateAsync(result.data.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to add trainer to my club: ${errorToDisplay}`);
  }
};

/**
 * Get all roles
 * @returns {Promise<Role[]>} - The promise
 */
export const getAllRoles = async () => {
  const result = await client.get('/users-permissions/roles');
  try {
    const schema = Joi.object({
      roles: Joi.array().items(roleSchema).required(),
    }).required();
    const validationResult = await schema.validateAsync(result.data, {
      allowUnknown: true,
    });

    return validationResult.roles;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch roles data: ${errorToDisplay}`);
  }
};

/**
 * Get a user by ID
 * @param {string} id - The user ID
 * @returns {Promise<User>} - User data
 */
export const getUserById = async (id) => {
  const result = await client.get(`/firebase-auth/${id}`);
  try {
    const validationResult = await publicUserSchema.validateAsync(result.data.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch user data: ${errorToDisplay}`);
  }
};

/**
 * Add device token for current user
 * @param {string} token fcm token
 * @returns {Promise<object>} The promise
 */
export const addDeviceToken = async (token) => {
  try {
    const normalizedPlatform = Platform.OS === 'web' ? 'web' : Platform.OS;
    logAuthDebug(`[FCM] Registering device token ${formatBootMeta({
      device: getDeviceId(),
      platform: normalizedPlatform,
      tokenPrefix: token ? `${token.slice(0, 12)}...` : 'none',
    })}`);
    const result = await client.post('/user-fcm-token/me/device', {
      data: {
        appVersion: getAppVersion(),
        device: getDeviceId(),
        platform: normalizedPlatform,
        supportsPushActions: true,
        token,
      },
    });
    return result.data;
  } catch (error) {
    const statusCode = error?.status || error?.response?.status;
    if (statusCode === 401 || statusCode === 403) {
      console.warn('[FCM] addDeviceToken unauthorized/forbidden. Skipping device registration.');
    } else if (isNetworkError(error)) {
      console.warn('[FCM] addDeviceToken network error. Token sync will retry later:', error?.message || error);
    } else {
      console.error('[FCM] addDeviceToken failed:', error?.message || error);
    }
    throw error;
  }
};

/**
 * Add the current installation token for a specific stored session.
 * Used to keep multiple locally connected accounts subscribed on the same device.
 * @param {string} sessionToken
 * @param {string} token
 * @returns {Promise<object>}
 */
export const addDeviceTokenForSession = async (sessionToken, token) => {
  if (!sessionToken || !token) {
    throw new Error('Missing session token or device token');
  }

  const normalizedPlatform = Platform.OS === 'web' ? 'web' : Platform.OS;
  const result = await client.post('/user-fcm-token/me/device', {
    data: {
      appVersion: getAppVersion(),
      device: getDeviceId(),
      platform: normalizedPlatform,
      supportsPushActions: true,
      token,
    },
  }, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return result.data;
};

/**
 * Normalize birthdate to YYYY-MM-DD without timezone drift.
 * @param {string | Date | undefined | null} value
 * @returns {string | undefined}
 */
const normalizeBirthdateToIso = (value) => {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return format(parsedDate, 'yyyy-MM-dd');
    }
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'yyyy-MM-dd');
  }

  return undefined;
};

/**
 * Delete device token for current user
 * @param {string} token fcm token
 * @returns {Promise<object>} The promise
 */
export const deleteDeviceToken = async (token) => {
  const result = await client.delete('/user-fcm-token/me/device', {
    data: {
      data: {
        token,
      },
    },
  });
  return result.data;
};

/**
 * Delete account (anonymize)
 * @returns {Promise<any>} Response
 */
export const deleteAccount = async () => {
  const response = await client.delete('/firebase-auth/delete');
  return response.data;
};
