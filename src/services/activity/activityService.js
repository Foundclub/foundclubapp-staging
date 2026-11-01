import Joi from 'joi';

import { comparerLesSports } from '@/domains/activity/cleDeSport';

import client from '../client';

const activitySchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Get all activities
 * @param params
 * @returns {Promise<Activity[]>}
 */
export const getActivities = async (params = {}) => {
  try {
    const response = await client.get('/activities', {
      params: {
        pagination: {
          page: 1,
          pageSize: 200,
        },
        sort: ['name:asc'],
        ...params,
      },
    });

    const schema = Joi.object({
      data: Joi.array().items(activitySchema).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    // REPRISE-DONNEES p110 — le serveur trie sur les octets (« Échecs » après « Yoga ») : on rend
    // les populaires d'abord, puis de A à Z, sauf si l'appelant a demandé son propre tri.
    return params.sort
      ? validationResult.data
      : [...validationResult.data].sort(comparerLesSports);
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch activities: ${errorToDisplay}`);
  }
};
