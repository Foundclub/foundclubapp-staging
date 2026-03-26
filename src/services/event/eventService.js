import Joi from 'joi';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import { createLogger } from '@/utils/logger/logger';

import client from '../client';

const eventServiceLogger = createLogger('event-service');

const getEventQueryHash = (value) => {
  const serialized = JSON.stringify(value || {});
  let hash = 0;
  Array.from(serialized).forEach((char) => {
    hash = ((hash * 31) + char.charCodeAt(0)) % 2147483647;
  });
  return String(hash);
};

/**
 * @typedef {import('@/domains/event/types').FCEventForm} FCEventForm
 * @typedef {import('@/domains/event/types').FCEvent} FCEvent
 */

export const eventSchema = Joi.object({
  capacity: Joi.number().allow(null).optional(),
  date: Joi.date().iso().required(),
  description: Joi.string().allow('', null),
  documentId: Joi.string(),
  facility: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  featuredRequestStatus: Joi.string().valid('none', 'pending', 'approved', 'rejected').allow(null).optional(),
  geohash: Joi.string().allow('', null).optional(),
  invitedTeams: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
  isFeatured: Joi.boolean().allow(null).optional(),
  location: Joi.object({
    lat: Joi.number().allow(null).optional(),
    lng: Joi.number().allow(null).optional(),
  }).allow(null).optional(),
  recurrenceGroupId: Joi.string().allow(null).optional(),
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
 * Create multiple events sequentially.
 * Useful for récurrent creation to collect partial failures.
 * @param {FCEventForm[]} payloads
 * @returns {Promise<{created: Array<{payload: FCEventForm, response: any, documentId: string | null}>, failed: Array<{payload: FCEventForm, error: any}>}>}
 */
export const createEventsSequentially = async (payloads = []) => (
  payloads.reduce(async (accPromise, payload) => {
    const acc = await accPromise;
    try {
      const response = await createEvent(payload);
      const documentId = response?.data?.documentId || response?.documentId || null;
      acc.created.push({ documentId, payload, response });
    } catch (error) {
      acc.failed.push({ error, payload });
    }
    return acc;
  }, Promise.resolve({ created: [], failed: [] }))
);

/**
 * Rollback events by cancelling all provided documentIds.
 * @param {string[]} documentIds
 * @returns {Promise<PromiseSettledResult<any>[]>}
 */
export const rollbackEventsByCancel = async (documentIds = []) => {
  const validIds = documentIds.filter(Boolean);
  return Promise.allSettled(
    validIds.map((documentId) => cancelEvent({ documentId })),
  );
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
        'team.trainers',
        'team.trainers.avatar',
        'invitedTeams',
        'invitedTeams.players',
        'invitedTeams.players.avatar',
        'invitedTeams.trainers',
        'invitedTeams.trainers.avatar',
        'invitedTeams.category',
        'invitedTeams.level',
        'invitedTeams.section',
        'type',
        'missings',
        'participations.avatar',
        'participationRequests.user',
        'participationRequests.user.avatar',
        'participationRequests.sourceTeam',
        'recruitmentAds',
        'recruitmentAds.candidates',
        'recruitmentAds.candidates.avatar',
        'recruitmentAds.level',
        'recruitmentAds.section',
        'recruitmentAds.category',
        'recruitmentAds.event',
        'recruitmentAds.event.type',
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
 * Save team composition draft for an event.
 * @param {string} eventId
 * @param {{ teamId?: string, draft: Record<string, any> }} payload
 * @returns {Promise<any>}
 */
export const saveEventCompositionDraft = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/composition/draft`, {
    data: {
      draft: payload?.draft || {},
      teamId: payload?.teamId || null,
    },
  });
  return response?.data?.data || response?.data;
};

/**
 * Publish team convocation for an event.
 * @param {string} eventId
 * @param {{ teamId?: string }} payload
 * @returns {Promise<any>}
 */
export const publishEventConvocation = async (eventId, payload = {}) => {
  const response = await client.post(`/events/${eventId}/composition/publish`, {
    data: {
      teamId: payload?.teamId || null,
    },
  });
  return response?.data?.data || response?.data;
};

/**
 * Get composition data (draft + published) for one team of an event.
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getEventTeamComposition = async (eventId, teamId) => {
  const response = await client.get(`/events/${eventId}/composition`, {
    params: teamId ? { teamId } : undefined,
  });
  return response?.data?.data || response?.data;
};

/**
 * Get published convocation (player/staff read view) for one team of an event.
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getEventConvocation = async (eventId, teamId) => {
  const response = await client.get(`/events/${eventId}/convocation`, {
    params: teamId ? { teamId } : undefined,
  });
  return response?.data?.data || response?.data;
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
    excludeType,
    featuredRequestStatus,
    featuredScope,
    geohash,
    isFeatured,
    lat,
    level,
    lon,
    membershipClubIds,
    page,
    pageSize,
    participantId,
    playerEventsFilter = false,
    q,
    radius,
    sessionStatus,
    startDateAfter,
    startDateBefore,
    teamIds,
    trainerEventsFilter = false,
    type,
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
    myTeams: params.myTeams, // Pass myTeams filter to backend
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
      'participationRequests.user.avatar',
      'participationRequests.sourceTeam',
      'league_match',
    ],
    sort: params.sort ? [params.sort] : ['date:asc'], // Sort by date ascending
    // Location-based filtering (Haversine)
    ...(lat && lon && radius && { lat, lon, radius }),
  };

  const response = await client.get('/events', { params: filters });
  const pagination = response?.data?.meta?.pagination || {};
  const queryHash = getEventQueryHash({
    featuredRequestStatus,
    featuredScope,
    filtersObj,
    lat,
    lon,
    page: page || 1,
    pageSize: pageSize || 10,
    radius,
    sort: params.sort ? [params.sort] : ['date:asc'],
  });
  eventServiceLogger.debug('getEvents response summary', {
    count: Array.isArray(response?.data?.data) ? response.data.data.length : 0,
    page: pagination?.page,
    pageSize: pagination?.pageSize,
    queryHash,
    total: pagination?.total,
  });
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
      eventServiceLogger.error('Joi validation failed for events response', {
        detailsCount: Array.isArray(error?.details) ? error.details.length : 0,
        firstDetail: error?.details?.[0]?.message,
      });
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
 * Respond to an event RSVP.
 * @param {string} eventId
 * @param {'present' | 'absent'} answer
 * @param {{ source?: 'push_action' | 'in_app', notificationId?: string }} [meta]
 * @returns {Promise<any>}
 */
export const respondToEventRsvp = async (eventId, answer, meta = {}) => {
  if (!eventId) {
    throw new Error('Missing eventId for RSVP');
  }
  if (answer !== 'present' && answer !== 'absent') {
    throw new Error(`Unsupported RSVP answer: ${String(answer)}`);
  }

  const response = await client.post(`/events/${eventId}/rsvp`, {
    answer,
    notificationId: meta.notificationId,
    source: meta.source || 'in_app',
  });
  return response.data;
};

/**
 * Send reminders to players who haven't answered
 * @param {string} eventId - The ID of the event
 * @returns {Promise<any>} - Response from API
 */
export const remindUnansweredPlayers = async (eventId) => {
  const response = await client.post(`/events/${eventId}/remind-unanswered-players`);
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
export const getClubEvents = async (clubId) => getEvents({
  club: { label: '', value: clubId },
  // validationMode: 'auto' // REMOVED: We want to see ALL events (manual & auto) for the club planning
});

/**
 * Get lightweight planning slots for the connected user.
 * @param {{ from?: string, to?: string }} [filters]
 * @returns {Promise<any>}
 */
export const getMyPlanning = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await client.get(`/users/me/planning${suffix}`);
  return response.data;
};

/**
 * Get lightweight planning slots for a club.
 * @param {string} clubId
 * @param {{ facilityId?: string, from?: string, to?: string }} [filters]
 * @returns {Promise<any>}
 */
export const getClubPlanning = async (clubId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.facilityId) params.append('facilityId', filters.facilityId);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await client.get(`/clubs/${clubId}/planning${suffix}`);
  return response.data;
};

/**
 * Get events for the connected user (My Planning)
 * @param {string[]} [teamIds] - Optional team IDs to filter
 * @returns {Promise<any>}
 */
export const getMyEvents = async (teamIds = []) => getEvents({
  myTeams: teamIds,
});

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
 * Get attendance/lateness data for event participants.
 * @param {string} eventId
 * @returns {Promise<{ data?: { eventId?: string, items?: Array } }>}
 */
export const getEventAttendance = async (eventId) => {
  const response = await client.get(`/events/${eventId}/attendance`);
  return response.data;
};

/**
 * Player self-arrival on an event.
 * @param {string} eventId
 * @param {{ note?: string }} [payload]
 * @returns {Promise<any>}
 */
export const markSelfArrival = async (eventId, payload = {}) => {
  const response = await client.post(`/events/${eventId}/attendance/self-arrival`, payload);
  return response.data;
};

/**
 * Player declares or updates a late arrival before arriving.
 * @param {string} eventId
 * @param {{ lateMinutes: number }} payload
 * @returns {Promise<any>}
 */
export const declareSelfLate = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/attendance/self-late`, payload);
  return response.data;
};

/**
 * Coach marks arrival for a participant.
 * @param {string} eventId
 * @param {string} userId
 * @param {{ arrivedAt?: string, lateMinutes?: number, note?: string }} [payload]
 * @returns {Promise<any>}
 */
export const markCoachArrival = async (eventId, userId, payload = {}) => {
  const response = await client.post(`/events/${eventId}/attendance/${userId}/coach-arrival`, payload);
  return response.data;
};

/**
 * Coach updates lateness minutes for a participant.
 * @param {string} eventId
 * @param {string} userId
 * @param {{ lateMinutes: number, arrivedAt?: string, note?: string }} payload
 * @returns {Promise<any>}
 */
export const updateCoachLateMinutes = async (eventId, userId, payload) => {
  const response = await client.patch(`/events/${eventId}/attendance/${userId}/late`, payload);
  return response.data;
};

/**
 * Coach resets attendance data for a participant.
 * @param {string} eventId
 * @param {string} userId
 * @returns {Promise<any>}
 */
export const resetCoachAttendance = async (eventId, userId) => {
  const response = await client.patch(`/events/${eventId}/attendance/${userId}/reset`);
  return response.data;
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
    android: `${dirs.DownloadDir}/${fileName}`,
    ios: `${dirs.DocumentDir}/${fileName}`,
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
        await ReactNativeBlobUtil.fs.scanFile([{ mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', path: res.path() }]);
      } catch (_error) {
        // Ignore: scanFile is best-effort on Android.
      }
    }

    return res.path();
  } catch (error) {
    eventServiceLogger.error('Export participants failed', error);
    throw error;
  }
};
