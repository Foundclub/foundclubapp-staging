import Joi from 'joi';
import client from '../client';
/**
 * Login user
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.password
 * @returns {Promise<
 * Partial<{token: string, accessToken: string, refreshToken: string}>>} The response data.
 */
export const login = async ({ username, password }) => {
  const response = await client.post('/auth/login', { username, password });
  try {
    const schema = Joi.object({
      accessToken: Joi.string().required(),
      refreshToken: Joi.string().required(),
    }).unknown(true).required();
    await schema.validateAsync(response.data, { allowUnknown: true });
  } catch (error) {
    throw new Error(`API response does not match login Schema: ${error.message}`);
  }
  return response.data;
};

/**
 * Get current authenticated user information
 * @returns {Promise<User>} The user data
 */
export const getCurrentUser = async () => {
  const response = await client.get('/auth/me');
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      username: Joi.string().required(),
      email: Joi.string().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      gender: Joi.string().required(),
      image: Joi.string().required(),
    }).unknown(true).required();
    await schema.validateAsync(response.data, { allowUnknown: true });
  } catch (error) {
    throw new Error(`API response does not match getCurrentUser Schema: ${error.message}`);
  }
  return response.data;
};
