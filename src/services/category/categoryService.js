import Joi from 'joi';

import { compareCategories } from '@/domains/category/categorySort';

import client from '../client';

export const categorySchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

// REPRISE-INSCRIPTION (01/11) : le rangement des catégories est pur ; il vit dans le domaine pour
// qu'un écran puisse le lire sans charger le client HTTP. Réexporté ici pour ses appelants.
export { compareCategories, getCategorySortKey } from '@/domains/category/categorySort';

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

    return [...validationResult.data].sort(compareCategories);
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error
      ? error.message
      : error;

    throw new Error(`Failed to fetch catégories: ${errorToDisplay}`);
  }
};
