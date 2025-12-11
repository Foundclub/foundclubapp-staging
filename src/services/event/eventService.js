import Joi from 'joi';

import client from '../client';

export const eventSchema = Joi.object({
  capacity: Joi.number().allow(null).optional(),
  date: Joi.date().iso().required(),
  description: Joi.string().allow('', null),
  documentId: Joi.string(),
  geohash: Joi.string().allow('', null).optional(),
  location: Joi.object({
    lat: Joi.number().allow(null).optional(),
    lng: Joi.number().allow(null).optional(),
  }).allow(null).optional(),
  sessionStatus: Joi.string().valid('open', 'closed').allow(null).optional(),
  team: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  type: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  validationMode: Joi.string().valid('auto', 'manual').allow(null).optional(),
  isFeatured: Joi.boolean().allow(null).optional(),
  featuredRequestStatus: Joi.string().valid('none', 'pending', 'approved', 'rejected').allow(null).optional(),
  facility: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  invitedTeams: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
  recurrenceGroupId: Joi.string().allow(null).optional(),
}).unknown(true);

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
 * @param {object} params
 * @param {string} params.documentId - The event ID
 * @param {FCEventForm} params.eventData - The event data to update
 * @param {'future' | 'all'} [params.recurrenceMode] - The recurrence update mode
 * @returns {Promise<any>} 201
 */
export const updateEvent = async ({ documentId, eventData, recurrenceMode }) => {
  const data = { ...eventData };
  if (recurrenceMode) {
    data.recurrenceMode = recurrenceMode;
  }
  const response = await client.put(`/events/${documentId}`, {
    data,
  });
  return response.data;
};

/**
 * Cancel an event
 * @param {object} params
 * @param {string} params.documentId - The event ID
 * @param {'future' | 'all'} [params.recurrenceMode] - The recurrence cancel mode
 * @returns {Promise<any>} 201
 */
export const cancelEvent = async ({ documentId, recurrenceMode }) => {
  const response = await client.post(`/events/${documentId}/cancel`, {
    recurrenceMode,
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
        'team.club.logo',
        'team.section',
        'team.category',
        'team.level',
        'team.players',
        'type',
        'missings',
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
 *   category?: string | string[];
 *   level?: string | string[];
 *   activity?: string | string[];
 *   sessionStatus?: string;
 *   q?: string;
 *   playerEventsFilter?: boolean;
 *   trainerEventsFilter?: boolean;
 *   startDateAfter?: Date;
 *   startDateBefore?: Date;
 *   sort?: string;
 *   geohash?: string;
 *   excludeType?: string;
 *   isFeatured?: boolean;
 *  }} params - The parameters for filtering events
 * }} params playerEventsFilter - If true, only events where the user is a participant
 * and user's teams closed events will be returned, if true trainerEventFilter is ignored
 * @returns {Promise<{data: FCEvent[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getEvents = async (params = {}) => {
  const {
    activity,
    category,
    club,
    geohash,
    level,
    page,
    pageSize,
    participantId,
    playerEventsFilter = false,
    q,
    sessionStatus,
    startDateAfter,
    startDateBefore,
    teamIds,
    trainerEventsFilter = false,
    type,
    excludeType,
    isFeatured,
    featuredRequestStatus,
  } = params;

  /** @type {Record<string, any>} */
  const filtersObj = {
    isActive: true,
  };

  // Apply date filters if provided, otherwise use default future dates filter
  if (startDateAfter || startDateBefore) {
    filtersObj.date = {};
    if (startDateAfter) {
      filtersObj.date.$gte = startDateAfter.toISOString();
    }
    if (startDateBefore) {
      filtersObj.date.$lte = startDateBefore.toISOString();
    }
  } else {
    filtersObj.date = {
      $gt: new Date().toISOString(), // Only get future dates if no specific date filter is set
    };
  }

  // Build team and participant filters
  if (teamIds?.length || participantId) {
    if (playerEventsFilter) {
      filtersObj.$or = [];
      if (teamIds?.length) {
        filtersObj.$or.push({
          $and: [
            {
              team: {
                documentId: {
                  $in: teamIds,
                },
              },
            },
            {
              sessionStatus: 'closed',
            },
          ],
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
    } else if (trainerEventsFilter) {
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
          documentId: participantId,
        };
      }
    }
  }

  if (type) {
    filtersObj.type = {
      documentId: Array.isArray(type) ? { $in: type } : type,
    };
  } else if (excludeType) {
    filtersObj.type = {
      name: {
        $ne: excludeType,
      },
    };
  }

  if (sessionStatus) {
    filtersObj.sessionStatus = sessionStatus;
  }

  if (params.validationMode) {
    filtersObj.validationMode = params.validationMode;
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
        documentId: Array.isArray(category) ? { $in: category } : category,
      };
    }

    if (level) {
      filtersObj.team.level = {
        documentId: Array.isArray(level) ? { $in: level } : level,
      };
    }

    if (activity) {
      if (Array.isArray(activity)) {
        filtersObj.team.activities = {
          documentId: {
            $in: activity,
          },
        };
      } else {
        filtersObj.team.activities = {
          documentId: {
            $containsi: activity,
          },
        };
      }
    }
  }

  if (params.facility) {
    filtersObj.facility = {
      documentId: params.facility,
    };
  }

  if (geohash && geohash.length) {
    filtersObj.geohash = {
      $contains: geohash,
    };
  }

  if (typeof isFeatured === 'boolean') {
    if (isFeatured) {
      filtersObj.isFeatured = true;
    } else {
      filtersObj.isFeatured = {
        $ne: true,
      };
    }
  }

  if (featuredRequestStatus) {
    if (Array.isArray(featuredRequestStatus)) {
      filtersObj.featuredRequestStatus = {
        $in: featuredRequestStatus,
      };
    } else {
      filtersObj.featuredRequestStatus = featuredRequestStatus;
    }
  }

  const filters = {
    _q: q,
    filters: filtersObj,
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: [
      'club',
      'club.sponsor',
      'club.sponsor',
      'club.sponsor.logo',
      'club.logo',
      'team',
      'team.club',
      'team.club.sponsor',
      'team.club.sponsor',
      'team.club.sponsor.logo',
      'team.club.logo',
      'team.section',
      'team.category',
      'team.level',
      'team.activities',
      'type',
      'participations',
      'missings',
      'facility',
      'invitedTeams',
    ],
    sort: params.sort ? [params.sort] : ['date:asc'], // Sort by date ascending
    myTeams: params.myTeams, // Pass myTeams filter to backend
  };

  const response = await client.get('/events', { params: filters });
  console.log('getEvents API Response:', JSON.stringify(response.data, null, 2));
  try {
    const schema = Joi.object({
      data: Joi.array().items(eventSchema),
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
    if (error.isJoi) {
      console.error('Joi Validation Error Details:', JSON.stringify(error.details, null, 2));
    }
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch events: ${errorToDisplay}`);
  }
};

/**
 * Mark as missing for an event
 * @param {string} eventId - The ID of the event to answer to
 * @returns {Promise<Event>} - The updated event
 */
export const missingEvent = async (eventId) => {
  const response = await client.post(`/events/${eventId}/missing`);
  return response.data;
};

/**
 * Send push notification to all players that haven't respond yet to the event
 * @param {string} eventId - The ID of the event to answer to
 * @returns {Promise<Event>} - The updated event
 */
/**
 * Get events for a specific club
 * @param {string} clubId
 * @returns {Promise<any>}
 */
export const getClubEvents = async (clubId) => {
  return getEvents({
    club: { value: clubId },
    // validationMode: 'auto' // REMOVED: We want to see ALL events (manual & auto) for the club planning
  });
};

/**
 * Get events for the connected user (My Planning)
 * @returns {Promise<any>}
 */
export const getMyEvents = async () => {
  return getEvents({
    myTeams: true
  });
};
