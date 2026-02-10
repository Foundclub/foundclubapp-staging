import Joi from 'joi';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import client from '../client';

/**
 * @typedef {import('@/domains/event/types').FCEventForm} FCEventForm
 * @typedef {import('@/domains/event/types').FCEvent} FCEvent
 */

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
        'team.club.parentMultisport',
        'team.section',
        'team.category',
        'team.level',
        'team.players',
        'team.players.avatar',
        'type',
        'missings',
        'participations.avatar',
        'participationRequests.user',
        'facility',
        'team.club.sponsor',
        'team.club.sponsor.logo'],
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
 * Mark event venue as booked (by captain)
 * @param {string} eventDocumentId - The event ID
 * @returns {Promise<any>} Updated event
 */
export const markVenueBooked = async (eventDocumentId) => {
  const response = await client.put(`/events/${eventDocumentId}`, {
    data: {
      venueBooked: true,
      venueBookedAt: new Date().toISOString(),
    },
  });
  return response.data;
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
 *   lat?: number;
 *   lon?: number;
 *   radius?: number;
 *   excludeType?: string;
 *   isFeatured?: boolean;
 *   featuredRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
 *   validationMode?: 'auto' | 'manual';
 *   facility?: {documentId?: string, name?: string};
 *   myTeams?: string[];
 *  }} params - The parameters for filtering events
 * @returns {Promise<{data: FCEvent[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getEvents = async (params = {}) => {
  const {
    activity,
    category,
    club,
    geohash,
    lat,
    lon,
    radius,
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
    featuredScope,
    membershipClubIds,
  } = params;

  /** @type {Record<string, any>} */
  const filtersObj = {
    isActive: true,
  };

  // Apply date filters if provided, otherwise use default future dates filter
  if (startDateAfter || startDateBefore) {
    filtersObj.date = {};
    if (startDateAfter) {
      // Handle both Date objects and ISO string values
      filtersObj.date.$gte = startDateAfter instanceof Date 
        ? startDateAfter.toISOString() 
        : startDateAfter;
    }
    if (startDateBefore) {
      // Handle both Date objects and ISO string values
      filtersObj.date.$lte = startDateBefore instanceof Date 
        ? startDateBefore.toISOString() 
        : startDateBefore;
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

  // Only use geohash filter when lat/lon are NOT available (fallback mode)
  // When coordinates are provided, skip geohash and let Haversine do precise filtering
  if (geohash && geohash.length && (!lat || !lon || !radius)) {
    filtersObj.geohash = {
      $startsWith: geohash,
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

  // Filter by featuredScope (SECTION, CM, PUBLIC)
  if (featuredScope) {
    if (Array.isArray(featuredScope)) {
      filtersObj.featuredScope = {
        $in: featuredScope,
      };
    } else {
      filtersObj.featuredScope = featuredScope;
    }
  }

  // Filter featured events by user's club/CM membership
  // Events where team.club.documentId or team.club.parentMultisport.documentId is in membershipClubIds
  if (membershipClubIds?.length) {
    filtersObj.$or = [
      ...(filtersObj.$or || []),
      {
        team: {
          club: {
            documentId: {
              $in: membershipClubIds,
            },
          },
        },
      },
      {
        team: {
          club: {
            parentMultisport: {
              documentId: {
                $in: membershipClubIds,
              },
            },
          },
        },
      },
    ];
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
      'participationRequests.user',
      'league_match',
    ],
    sort: params.sort ? [params.sort] : ['date:asc'], // Sort by date ascending
    myTeams: params.myTeams, // Pass myTeams filter to backend
    // Location-based filtering (Haversine)
    ...(lat && lon && radius && { lat, lon, radius }),
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
  } catch (/** @type {any} */ error) {
    if (error?.isJoi) {
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
 * Send reminders to players who haven't answered
 * @param {string} eventId - The ID of the event
 * @returns {Promise<any>} - Response from API
 */
export const remindUnansweredPlayers = async (eventId) => {
  const response = await client.post(`/events/${eventId}/remind`);
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
    club: { value: clubId, label: '' },
    // validationMode: 'auto' // REMOVED: We want to see ALL events (manual & auto) for the club planning
  });
};

/**
 * Get events for the connected user (My Planning)
 * @param {string[]} [teamIds] - Optional team IDs to filter
 * @returns {Promise<any>}
 */
export const getMyEvents = async (teamIds = []) => {
  return getEvents({
    myTeams: teamIds,
  });
};

/**
 * Request to feature an event for the entire multisport club
 * @param {string} eventId - The ID of the event
 * @returns {Promise<any>} - The updated event
 */
export const requestFeatured = async (eventId) => {
  const response = await client.post(`/events/${eventId}/request-featured`);
  return response.data;
};

/**
 * Approve a featured event request (multisport admin only)
 * @param {string} eventId - The ID of the event
 * @returns {Promise<any>} - The updated event
 */
export const approveFeatured = async (eventId) => {
  const response = await client.put(`/events/${eventId}/approve-featured`);
  return response.data;
};

/**
 * Reject a featured event request (multisport admin only)
 * @param {object} params
 * @param {string} params.eventId - The ID of the event
 * @param {string} [params.reason] - Optional reason for rejection
 * @returns {Promise<any>} - The updated event
 */
export const rejectFeatured = async ({ eventId, reason }) => {
  const response = await client.put(`/events/${eventId}/reject-featured`, {
    data: { reason },
  });
  return response.data;
};

/**
 * Get pending featured requests for a multisport club
 * @param {string} multisportClubId - The ID of the multisport club
 * @returns {Promise<any>} - List of events with pending featured requests
 */
export const getPendingFeaturedRequests = async (multisportClubId) => {
  const response = await client.get(`/multisport-clubs/${multisportClubId}/pending-featured-requests`);
  return response.data;
};

/**
 * Toggle late status for an event (Trainer/Admin only)
 * @param {string} eventId
 * @param {string} userId
 */
export const toggleLateEvent = async (eventId, userId) => {
  const { data } = await client.post(`/events/${eventId}/toggle-late`, { userId }); // Custom route
  return data;
};

/**
 * Export event participants to Excel
 * @param {string} eventId
 * @param {string} eventName
 * @returns {Promise<string>} - The path to the downloaded file
 */
export const exportEventParticipants = async (eventId, eventName) => {
  const token = getAuthTokens()?.token;
  const baseURL = process.env.API_URL; // e.g. http://localhost:1337/api
  const url = `${baseURL}/events/${eventId}/export-participants`;

  const { dirs } = ReactNativeBlobUtil.fs;
  const fileName = `participants_${eventName ? eventName.replace(/[^a-zA-Z0-9]/g, '_') : 'event'}.xlsx`;
  
  const path = Platform.select({
    ios: `${dirs.DocumentDir}/${fileName}`,
    android: `${dirs.DownloadDir}/${fileName}`,
  });

  const config = {
    fileCache: true,
    path,
  };

  try {
    const res = await ReactNativeBlobUtil.config(config).fetch('GET', url, {
      Authorization: `Bearer ${token}`,
    });
    
    // On Android, explicitly trying to show the file or notify
    if (Platform.OS === 'android') {
        try {
            // Try to add to media scanner so it shows up
            await ReactNativeBlobUtil.fs.scanFile([{ path: res.path(), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]);
        } catch (ignored) {}
    }
    
    return res.path();
  } catch (error) {
    console.error('[EventService] Export error:', error);
    throw error;
  }
};
