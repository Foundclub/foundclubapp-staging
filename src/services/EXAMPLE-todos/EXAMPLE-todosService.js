import Joi from 'joi';
import client from '../client';

/**
 * Get todos with pagination
 * @param {object} params
 * @param {number} [params.limit] - Number of todos to return
 * @param {number} [params.skip] - Number of todos to skip
 * @returns {Promise<{todos: Array<Todo>, total: number, skip: number, limit: number}>}
 */
export const getTodos = async ({ limit = 10, skip = 0 } = {}) => {
  const response = await client.get(`/todos?limit=${limit}&skip=${skip}`);
  try {
    const todoSchema = Joi.object({
      id: Joi.number().required(),
      todo: Joi.string().required(),
      completed: Joi.boolean().required(),
      userId: Joi.number().required(),
    }).required();

    const schema = Joi.object({
      todos: Joi.array().items(todoSchema).required(),
      total: Joi.number().required(),
      skip: Joi.number().required(),
      limit: Joi.number().required(),
    }).required();

    await schema.validateAsync(response.data, { allowUnknown: true });
  } catch (error) {
    throw new Error(`API response does not match getTodos Schema: ${error.message}`);
  }
  return response.data;
};
