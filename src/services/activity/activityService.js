import Joi from 'joi';

import client from '../client';

const activitySchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Get all activities
 * @returns {Promise<Activity[]>}
 */
export const getActivities = async () => {
  try {
    const response = await client.get('/activities', {
      params: {
        pagination: {
          page: 1,
          pageSize: 200,
        },
        sort: ['name:asc'],
      },
    });

    const schema = Joi.object({
      data: Joi.array().items(activitySchema).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch activities: ${errorToDisplay}`);
  }
};
