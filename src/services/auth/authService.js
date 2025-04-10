import { signInWithPhoneNumber as firebaseSignInWithPhoneNumber, getAuth } from '@react-native-firebase/auth';
import Joi from 'joi';
import { Platform } from 'react-native';

import client from '@/services/client';

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
  section: Joi.string().valid('female', 'male').allow(null).optional(),
  type: Joi.string().valid('Entraineur', 'new', 'Joueur', 'Dirigeant').required(),
}).required();

/**
 * Sign in with phone number
 * @param {string} phoneNumber - The phone number
 * @returns {Promise<import('@react-native-firebase/auth')
 * .FirebaseAuthTypes.ConfirmationResult>} The promise
 */
export const signInWithPhoneNumber = async (phoneNumber) => {
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
 * @param {any} params.confirm - The confirmation object
 * @param {string} params.code - The OTP code
 * @returns {Promise<{
 *   idToken: string,
 *   idUser: import('@react-native-firebase/auth').FirebaseAuthTypes.User,
 *   token: string
 * }>} The promise
 */
export const login = async ({ code, confirm }) => {
  try {
    const firebaseResult = await confirm.confirm(code);
    const idToken = await firebaseResult.user.getIdToken();

    const result = await client.post('/firebase-auth/login', { idToken });

    const schema = Joi.object({
      jwt: Joi.string().required(),
      user: Joi.object().required(),
    }).required();
    await schema.validateAsync(result.data, { allowUnknown: true });

    return { idToken, idUser: firebaseResult.user, token: result.data.jwt };
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
    const userDataCopy = { ...userData };

    // Handle avatar file separately
    if (userDataCopy.avatar && typeof userDataCopy.avatar === 'object') {
      const fileToUpload = {
        // @ts-expect-error because of react native image type

        name: userDataCopy.avatar.filename || `image.${userDataCopy.avatar.path.split('.').pop()}`,
        // @ts-expect-error because of react native image type
        type: userDataCopy.avatar.mime,
        // @ts-expect-error because of react native image type
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

    const result = await client.put(
      '/firebase-auth/update',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    const validationResult = await userSchema.validateAsync(result.data, {
      abortEarly: false,
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to update user data: ${errorToDisplay}`);
  }
};
