import Joi from 'joi';

import client from '@/services/client';

/**
 * User History validation schema
 */
export const userHistorySchema = Joi.object({
  category: Joi.object().allow(null).optional(),
  club: Joi.object().allow(null).optional(),
  customClubName: Joi.string().allow(null, '').optional(),
  documentId: Joi.string().required(),
  endYear: Joi.number().allow(null).optional(),
  id: Joi.number().required(),
  isCurrentlyActive: Joi.boolean().optional(),
  level: Joi.object().allow(null).optional(),
  startYear: Joi.number().required(),
}).required();

/**
 * Get user's own history entries
 * @returns {Promise<UserHistory[]>}
 */
export const getMyHistories = async () => {
  try {
    const response = await client.get('/user-histories/mine');
    return response.data?.data || [];
  } catch (error) {
    console.error('Failed to fetch my histories:', error);
    throw error;
  }
};

/**
 * Get history entries for a specific user
 * @param {string} userId - The user's documentId
 * @returns {Promise<UserHistory[]>}
 */
export const getUserHistories = async (userId) => {
  try {
    const response = await client.get(`/user-histories/user/${userId}`);
    return response.data?.data || [];
  } catch (error) {
    console.error('Failed to fetch user histories:', error);
    throw error;
  }
};

/**
 * Create a new history entry
 * @param {object} data - History data
 * @returns {Promise<UserHistory>}
 */
export const createHistory = async (data) => {
  try {
    const response = await client.post('/user-histories', data);
    return response.data?.data;
  } catch (error) {
    console.error('Failed to create history:', error);
    throw error;
  }
};

/**
 * Update a history entry
 * @param {string} id - The history entry documentId
 * @param {object} data - Updated history data
 * @returns {Promise<UserHistory>}
 */
export const updateHistory = async (id, data) => {
  try {
    const response = await client.put(`/user-histories/${id}`, data);
    return response.data?.data;
  } catch (error) {
    console.error('Failed to update history:', error);
    throw error;
  }
};

/**
 * Delete a history entry
 * @param {string} id - The history entry documentId
 * @returns {Promise<void>}
 */
export const deleteHistory = async (id) => {
  try {
    await client.delete(`/user-histories/${id}`);
  } catch (error) {
    console.error('Failed to delete history:', error);
    throw error;
  }
};
