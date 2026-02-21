import { signInWithPhoneNumber as firebaseSignInWithPhoneNumber, getAuth } from '@react-native-firebase/auth';
import { format } from 'date-fns';
import Joi from 'joi';
import { Platform } from 'react-native';
import { getDeviceId, getVersion } from 'react-native-device-info';

import client from '@/services/client';

// Check if Firebase bypass is enabled
const BYPASS_FIREBASE = process.env.BYPASS_FIREBASE_AUTH === 'true';

/**
 * User validation schema
 */
const userSchema = Joi.object({
  avatar: Joi.object().allow(null).optional(),
  birthdate: Joi.string().isoDate().allow(null).optional(),
  documentId: Joi.string().allow(null, '').optional(),
  email: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().allow(null, '').optional(),
  id: Joi.number().required(),
  lastname: Joi.string().allow(null, '').optional(),
  phoneNumber: Joi.string().required(),
  section: Joi.object().allow(null).optional(),
  preferredSport: Joi.string().allow(null, '').optional(),
  bestLevel: Joi.string().allow(null, '').optional(),
  category: Joi.string().allow(null, '').optional(),
  geohash: Joi.string().allow(null, '').optional(),
  weight: Joi.number().allow(null, '').optional(),
  height: Joi.number().allow(null, '').optional(),
  position: Joi.string().allow(null, '').optional(),
  isLookingForClub: Joi.boolean().allow(null).optional(),
  clubMembershipRequests: Joi.array().items(Joi.object({
    documentId: Joi.string().required(),
    state: Joi.string().required(),
    club: Joi.object().optional(),
  })).optional(),
}).required();

/**
 * Public user profile schema (for getUserById on another user profile)
 * Keep this schema independent from "me" to allow strict field minimization
 * on backend without breaking profile views.
 */
const publicUserSchema = Joi.object({
  id: Joi.number().required(),
  documentId: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().allow(null, '').optional(),
  lastname: Joi.string().allow(null, '').optional(),
  birthdate: Joi.string().isoDate().allow(null).optional(),
  preferredSport: Joi.string().allow(null, '').optional(),
  bestLevel: Joi.string().allow(null, '').optional(),
  position: Joi.string().allow(null, '').optional(),
  weight: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
  height: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, '').optional(),
  isLookingForClub: Joi.boolean().allow(null).optional(),
  avatar: Joi.object({
    url: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  role: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
    name: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  section: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
    name: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  club: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
    name: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
  parentAccount: Joi.object({
    documentId: Joi.string().allow(null, '').optional(),
  }).allow(null).optional(),
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
  if (BYPASS_FIREBASE) {
    console.log('[BYPASS] Firebase Auth bypassed - returning fake confirmation');
    return Promise.resolve({
      confirm: async () => ({ phoneNumber }),
      verificationId: 'bypass-verification-id',
      phoneNumber,
    });
  }

  try {
    const auth = getAuth();
    const result = await firebaseSignInWithPhoneNumber(auth, phoneNumber);
    return Promise.resolve(result);
  } catch (e) {
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
  if (BYPASS_FIREBASE) {
    console.log('[BYPASS] Firebase Auth bypassed - logging in directly with phone number');
    console.log('[BYPASS] confirm object received:', JSON.stringify(confirm));
    const phoneNumber = typeof confirm?.phoneNumber === 'string' ? confirm.phoneNumber.trim() : '';
    if (!phoneNumber) {
      throw new Error('Missing phone number in confirmation. Please restart login.');
    }
    console.log('[BYPASS] phoneNumber to send to API:', phoneNumber);

    try {
      const result = await client.post('/firebase-auth/login-bypass', { phoneNumber });
      console.log('[BYPASS] Login API response received, jwt:', !!result.data?.jwt);
      const schema = Joi.object({
        data: Joi.object().required(),
        jwt: Joi.string().required(),
      }).required();
      await schema.validateAsync(result.data, { allowUnknown: true });

      const userData = result.data.data || result.data.user;
      console.log('[BYPASS] User data extracted, documentId:', userData?.documentId);

      const authResult = {
        idToken: 'bypass-token',
        idUser: { phoneNumber },
        token: result.data.jwt,
        user: userData,
      };
      console.log('[BYPASS] Returning auth result with user documentId:', authResult.user?.documentId);
      return authResult;
    } catch (error) {
      const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
      throw new Error(`Bypass login failed: ${errorToDisplay}`);
    }
  }

  // NORMAL MODE: Use Firebase Auth
  // Check if user is already authenticated (auto-verification case)
  const { currentUser } = getAuth();

  let firebaseResult;
  if (currentUser) {
    firebaseResult = { user: currentUser };
  } else {
    firebaseResult = await confirm.confirm(code);
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
  if (BYPASS_FIREBASE) {
    return Promise.resolve();
  }

  try {
    const auth = getAuth();
    if (!auth?.currentUser) {
      return Promise.resolve();
    }

    await auth.signOut();
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
 * @param {function} onAuthStateChanged
 * @returns {function} unsubscribe
 */
export const subscribeToAuthState = (onAuthStateChanged) => {
  const auth = getAuth();
  return auth.onAuthStateChanged(onAuthStateChanged);
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

    console.log('[updateMe] base payload:', JSON.stringify(userDataCopy));

    // Handle avatar file separately
    if (userDataCopy.avatar && userDataCopy.avatar.path) {
      const fileToUpload = {
        name: userDataCopy.avatar.path.split('/').pop(),
        type: userDataCopy.avatar.mime,
        uri: Platform.OS === 'ios' ? userDataCopy.avatar.path.replace('file://', '') : userDataCopy.avatar.path,
      };

      console.log('[updateMe] Avatar file to upload:', fileToUpload);

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
        console.log(`[updateMe] Appending ${key}: ${valueToSend}`);
        formData.append(key, valueToSend);
      }
    });

    console.log('[updateMe] Sending request to /firebase-auth/update via fetch');
    const { getAuthTokens } = require('../../domains/auth/authUseCases');
    const auth = getAuthTokens();

    // Use native fetch to avoid Axios/FormData issues on Android
    const response = await fetch(`${process.env.API_URL}/firebase-auth/update`, {
      method: 'PUT',
      headers: {
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        // Do NOT set Content-Type, let fetch generate the boundary
      },
      body: formData,
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
 * @param {Partial<User>} userData
 * @returns {Promise<object>} The created trainer data
 */
export const createTrainer = async (userData) => {
  const formData = new FormData();

  const userDataCopy = {
    ...userData,
    username: userData.phoneNumber
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

  console.log('[createTrainer] Sending formData:', JSON.stringify(userDataCopy)); // Only logging text fields, file param is hidden in formData object handling

  console.log('[createTrainer] Sending formData:', JSON.stringify(userDataCopy));

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
 * Link a trainer to my club
 * @param {string} id
 * @returns {Promise<object>} The linked trainer data
 */
export const linkTrainerToClub = async (id) => {
  const result = await client.put(`/firebase-auth/add-trainer-to-club/${id}`);
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
    console.log('[FCM] Registering device token', {
      device: getDeviceId(),
      platform: Platform.OS,
      tokenPrefix: token ? `${token.slice(0, 12)}...` : 'none',
    });
    const result = await client.post('/user-fcm-token/me/device', {
      data: {
        appVersion: getVersion(),
        device: getDeviceId(),
        platform: Platform.OS,
        supportsPushActions: true,
        token,
      },
    });
    return result.data;
  } catch (error) {
    const statusCode = error?.status || error?.response?.status;
    if (statusCode === 401 || statusCode === 403) {
      console.warn('[FCM] addDeviceToken unauthorized/forbidden. Skipping device registration.');
    } else {
      console.error('[FCM] addDeviceToken failed:', error?.message || error);
    }
    throw error;
  }
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
  const encodedToken = encodeURIComponent(token || '');
  const result = await client.delete(`/user-fcm-token/me/device/${encodedToken}`);
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
