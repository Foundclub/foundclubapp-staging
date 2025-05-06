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
    q,
    sessionStatus,
    team,
    teamIds,
    type,
  } = params;

  /**
   * @type {{ filters: Record<string, any>; _q: string | undefined;
   * pagination: { page: number; pageSize: number }; populate: string[] }}
   */
  const filters = {
    _q: q,
    filters: {},
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: ['team', 'team.club', 'team.category', 'team.level', 'team.activities', 'type'],
  };

  let teamFilter = {};

  // Handle team filter (either single team or multiple teams)
  if (team?.value) {
    teamFilter = {
      documentId: team.value,
    };
  } else if (teamIds) {
    teamFilter = {
      documentId: {
        $in: teamIds,
      },
    };
  }

  // Filter by category
  if (category) {
    teamFilter = {
      ...teamFilter,
      category: {
        documentId: category,
      },
    };
  }

  // Filter by level
  if (level) {
    teamFilter = {
      ...teamFilter,
      level: {
        documentId: level,
      },
    };
  }

  // Filter by activity
  if (activity) {
    teamFilter = {
      ...teamFilter,
      activities: {
        documentId: activity,
      },
    };
  }

  // Filter by club
  if (club?.value) {
    teamFilter = {
      ...teamFilter,
      club: {
        documentId: club.value,
      },
    };
  }

  // Add team filter if there are any team-related conditions
  if (Object.keys(teamFilter).length > 0) {
    filters.filters.team = teamFilter;
  }

  // Filter by type
  if (type) {
    filters.filters.type = {
      documentId: type,
    };
  }

  // Filter by session status
  if (sessionStatus) {
    filters.filters.sessionStatus = sessionStatus;
  }

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
