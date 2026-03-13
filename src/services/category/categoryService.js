import Joi from 'joi';

import client from '../client';

export const categorySchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Normalize category labels for stable ordering.
 * @param {string} value
 * @returns {string}
 */
const normalizeCategoryName = (value) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

/**
 * Build a sortable key to keep age categories in business order.
 * Expected order: U7 -> U23 -> Senior -> Veteran -> others.
 * @param {string} value
 * @returns {{group: number, rank: number, label: string}}
 */
const getCategorySortKey = (value) => {
  const label = normalizeCategoryName(value);
  const uMatch = label.match(/(?:^|[^A-Z0-9])U\s*[- ]?\s*(\d{1,2})(?:[^0-9]|$)/) || label.match(/^U\s*[- ]?\s*(\d{1,2})$/);
  if (uMatch) {
    return { group: 0, label, rank: Number(uMatch[1]) };
  }

  if (label.includes('SENIOR')) {
    return { group: 1, label, rank: 0 };
  }

  if (label.includes('VETERAN') || label.includes('VET')) {
    return { group: 2, label, rank: 0 };
  }

  return { group: 3, label, rank: 0 };
};

/**
 * Category comparator for UI selects/popups.
 * @param {{name: string}} a
 * @param {{name: string}} b
 * @returns {number}
 */
const compareCategories = (a, b) => {
  const keyA = getCategorySortKey(a?.name || '');
  const keyB = getCategorySortKey(b?.name || '');

  if (keyA.group !== keyB.group) return keyA.group - keyB.group;
  if (keyA.rank !== keyB.rank) return keyA.rank - keyB.rank;
  return keyA.label.localeCompare(keyB.label, 'fr', { numeric: true, sensitivity: 'base' });
};

/**
 * Get all categories
 * @returns {Promise<Category[]>}
 */
export const getCategories = async () => {
  try {
    const response = await client.get('/catégories', {
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
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch catégories: ${errorToDisplay}`);
  }
};
