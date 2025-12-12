import { signInWithPhoneNumber as firebaseSignInWithPhoneNumber, getAuth } from '@react-native-firebase/auth';
import { format } from 'date-fns';
import Joi from 'joi';
import { Platform } from 'react-native';
import { getDeviceId } from 'react-native-device-info';

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
    const phoneNumber = confirm.phoneNumber || '+33600000001';

    try {
      const result = await client.post('/firebase-auth/login-bypass', { phoneNumber });
      const schema = Joi.object({
        data: Joi.object().required(),
        jwt: Joi.string().required(),
      }).required();
      await schema.validateAsync(result.data, { allowUnknown: true });

      return {
        idToken: 'bypass-token',
        idUser: { phoneNumber },
        token: result.data.jwt
      };
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

    return { idToken, idUser: firebaseResult?.user, token: result.data.jwt };
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`API response does not match getCurrentUser Schema: ${errorToDisplay}`);
  }
};

export const logout = async () => {
  try {
    const auth = getAuth();
    await auth.signOut();
    return Promise.resolve();
  } catch (e) {
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
export const getMe = async () => {
  const result = await client.get('/firebase-auth/me');
  try {
    const validationResult = await userSchema.validateAsync(result.data.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
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
      birthdate: userData.birthdate ? format(new Date(userData.birthdate), 'yyyy-MM-dd') : undefined,
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

    // Handle avatar file separately
    if (userDataCopy.avatar && userDataCopy.avatar.path) {
      const fileToUpload = {
        name: userDataCopy.avatar.path.split('/').pop(),
        type: userDataCopy.avatar.mime,
        uri: Platform.OS === 'ios' ? userDataCopy.avatar.path.replace('file://', '') : userDataCopy.avatar.path,
      };
      // @ts-expect-error because of react native image type
      formData.append('avatar', fileToUpload);
    }
    delete userDataCopy.avatar;

    // Append all other user data
    Object.entries(userDataCopy).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const result = await client.put(
      '/firebase-auth/update',
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

  const userDataCopy = { ...userData, username: userData.phoneNumber };

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

  const result = await client.post(
    '/firebase-auth/create-trainer',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  try {
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
    const validationResult = await userSchema.validateAsync(result.data.data, {
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
  const result = await client.post('/firebase-auth/me/device', {
    data: {
      device: getDeviceId(),
      platform: Platform.OS,
      token,
    },
  });
  return result.data;
};

/**
 * Delete device token for current user
 * @param {string} token fcm token
 * @returns {Promise<object>} The promise
 */
export const deleteDeviceToken = async (token) => {
  const result = await client.delete(`/firebase-auth/me/device/${token}`);
  return result.data;
};
