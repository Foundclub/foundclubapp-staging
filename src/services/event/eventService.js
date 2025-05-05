import Joi from 'joi';

import client from '../client';

export const eventSchema = Joi.object({
  capacity: Joi.number().required(),
  date: Joi.date().iso().required(),
  description: Joi.string().allow('', null),
  documentId: Joi.string(),
  location: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).required(),
  sessionStatus: Joi.string().valid('open', 'closed', 'cancelled').required(),
  team: Joi.object({
    documentId: Joi.string().required(),
    name: Joi.string().required(),
  }).required(),
  type: Joi.object({
    documentId: Joi.string().required(),
    name: Joi.string().required(),
  }).required(),
  validationMode: Joi.string().valid('automatic', 'manual').required(),
}).required();

/**
 * Create a new event
 * @param {FCEvent} eventData
 * @returns {Promise<FCEvent>} The created event
 */
export const createEvent = async (eventData) => {
  const response = await client.post('/events', {
    data: eventData,
  });
  return response.data;
};

/**
 * Update an event
 * @param {string} documentId - The event ID
 * @param {FCEvent} eventData - The event data to update
 * @returns {Promise<FCEvent>} The updated event
 */
export const updateEvent = async (documentId, eventData) => {
  const response = await client.put(`/events/${documentId}`, {
    data: eventData,
  });
  try {
    const schema = Joi.object({
      data: eventSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to update event: ${errorToDisplay}`);
  }
};

/**
 * Get an event by ID
 * @param {string} documentId - The event ID
 * @returns {Promise<FCEvent>} The event
 */
export const getEventById = async (documentId) => {
  const response = await client.get(`/events/${documentId}`);
  try {
    const schema = Joi.object({
      data: eventSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch event: ${errorToDisplay}`);
  }
};

/**
 * Get event types
 * @returns {Promise<Array<{documentId: string, name: string}>>} List of event types
 */
export const getEventTypes = async () => {
  const response = await client.get('/event-types', {
    params: {
      sort: ['name:asc'],
    },
  });
  try {
    const schema = Joi.object({
      data: Joi.array().items(Joi.object({
        documentId: Joi.string().required(),
        name: Joi.string().required(),
      })).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch event types: ${errorToDisplay}`);
  }
};
