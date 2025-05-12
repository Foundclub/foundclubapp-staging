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
  }).allow(null).optional(),
  sessionStatus: Joi.string().valid('open', 'closed').required(),
  team: Joi.object({
    documentId: Joi.string().required(),
    name: Joi.string().required(),
  }).allow(null).optional(),
  type: Joi.object({
    documentId: Joi.string().required(),
    name: Joi.string().required(),
  }).required(),
  validationMode: Joi.string().valid('auto', 'manual').required(),
}).required();

/**
 * Create a new event
 * @param {FCEventForm} eventData
 * @returns {Promise<any>} 201
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
 * @param {FCEventForm} eventData - The event data to update
 * @returns {Promise<any>} 201
 */
export const updateEvent = async (documentId, eventData) => {
  const response = await client.put(`/events/${documentId}`, {
    data: eventData,
  });
  return response.data;
};

/**
 * Get an event by ID
 * @param {string} documentId - The event ID
 * @returns {Promise<FCEvent>} The event
 */
export const getEventById = async (documentId) => {
  const response = await client.get(`/events/${documentId}`, {
    params: {
      populate: ['team',
        'team.club',
        'team.section',
        'team.category',
        'team.level',
        'type',
        'participations'],
    },
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

/**
 * Get events
 * @param {{
 *   teamIds?: string[];
 *   team?: {label: string, value: string};
 *   participantId?: string;
 *   name?: string;
 *   page?: number;
 *   pageSize?: number;
 *   type?: string;
 *   club?: {label: string, value: string};
 *   category?: string;
 *   level?: string;
 *   activity?: string;
 *   sessionStatus?: string;
 *   q?: string;
 *   useOrFilter?: boolean;
 * }} params
 * @returns {Promise<{data: FCEvent[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getEvents = async (params = {}) => {
  const {
    activity,
    category,
    club,
    level,
    page,
    pageSize,
    participantId,
    q,
    sessionStatus,
    teamIds,
    type,
    useOrFilter = false,
  } = params;

  /** @type {Record<string, any>} */
  const filtersObj = {
    date: {
      $gt: new Date().toISOString(), // Only get future dates
    },
  };

  // Build team and participant filters
  if (teamIds?.length || participantId) {
    if (useOrFilter) {
      filtersObj.$or = [];
      if (teamIds?.length) {
        filtersObj.$or.push({
          team: {
            documentId: {
              $in: teamIds,
            },
          },
        });
      }
      if (participantId) {
        filtersObj.$or.push({
          participations: {
            documentId: {
              $containsi: [participantId],
            },

          },
        });
      }
    } else {
      if (teamIds?.length) {
        filtersObj.team = {
          documentId: {
            $in: teamIds,
          },
        };
      }
      if (participantId) {
        filtersObj.participations = {
          user: {
            documentId: participantId,
          },
        };
      }
    }
  }

  if (type) {
    filtersObj.type = {
      documentId: type,
    };
  }

  if (sessionStatus) {
    filtersObj.sessionStatus = sessionStatus;
  }

  if (club?.value || category || level || activity) {
    filtersObj.team = filtersObj.team || {};

    if (club?.value) {
      filtersObj.team.club = {
        documentId: club.value,
      };
    }

    if (category) {
      filtersObj.team.category = {
        documentId: category,
      };
    }

    if (level) {
      filtersObj.team.level = {
        documentId: level,
      };
    }

    if (activity) {
      filtersObj.team.activities = {
        documentId: {
          $containsi: activity,
        },
      };
    }
  }

  const filters = {
    _q: q,
    filters: filtersObj,
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: ['team', 'team.club', 'team.section', 'team.category', 'team.level', 'team.activities', 'type', 'participations'],
    sort: ['date:asc'], // Sort by date ascending
  };

  const response = await client.get('/events', { params: filters });
  try {
    const schema = Joi.object({
      data: Joi.array().items(eventSchema).empty(Joi.array().length(0)),
      meta: Joi.object({
        pagination: Joi.object({
          page: Joi.number().required(),
          pageCount: Joi.number().required(),
          pageSize: Joi.number().required(),
          total: Joi.number().required(),
        }).required(),
      }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch events: ${errorToDisplay}`);
  }
};
