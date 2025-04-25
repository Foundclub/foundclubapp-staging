import Joi from 'joi';

import client from '../client';

export const sectionSchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Get all sections
 * @returns {Promise<Section[]>}
 */
export const getSections = async () => {
  try {
    const response = await client.get('/sections', {
      params: {
        pagination: {
          page: 1,
          pageSize: 1000,
        },
        sort: ['name:asc'],
      },
    });

    const schema = Joi.object({
      data: Joi.array().items(sectionSchema).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch sections: ${errorToDisplay}`);
  }
};
