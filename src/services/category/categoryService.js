import Joi from 'joi';

import client from '../client';

export const categorySchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Get all categories
 * @returns {Promise<Category[]>}
 */
export const getCategories = async () => {
  try {
    const response = await client.get('/categories', {
      params: {
        pagination: {
          page: 1,
          pageSize: 1000,
        },
        sort: ['name:asc'],
      },
    });

    const schema = Joi.object({
      data: Joi.array().items(categorySchema).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch categories: ${errorToDisplay}`);
  }
};
