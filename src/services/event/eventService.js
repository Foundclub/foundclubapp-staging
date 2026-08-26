// @ts-nocheck
import Joi from 'joi';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import client from '@/services/client';

import { createLogger } from '@/utils/logger/logger';

import { getApiBaseUrl } from '@/config/runtimeUrls';

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
  eventFormat: Joi.string().allow('', null).optional(),
  externalParticipantLimit: Joi.number().allow(null).optional(),
  externalParticipantValidationMode: Joi.string().valid('auto', 'manual').allow(null).optional(),
  facility: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  facilityOverrideRequest: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    status: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  featuredRequestStatus: Joi.string().valid('none', 'pending', 'approved', 'rejected').allow(null).optional(),
  geohash: Joi.string().allow('', null).optional(),
  invitedTeams: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
  isFeatured: Joi.boolean().allow(null).optional(),
  location: Joi.object({
    lat: Joi.number().allow(null).optional(),
    lng: Joi.number().allow(null).optional(),
  }).allow(null).optional(),
  parentEvent: Joi.object().allow(null).optional(),
  participantIdentitiesHidden: Joi.boolean().allow(null).optional(),
  participantIdentityVisibility: Joi.string().valid('VISIBLE', 'ANONYMIZED').allow('', null).optional(),
  pendingReason: Joi.string().allow('', null).optional(),
  recurrenceGroupId: Joi.string().allow(null).optional(),
  sessionStatus: Joi.string().valid('open', 'closed').allow(null).optional(),
  stageDefaultEndTime: Joi.string().allow('', null).optional(),
  stageDefaultStartTime: Joi.string().allow('', null).optional(),
  stageEndDate: Joi.string().allow('', null).optional(),
  stageSchedule: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
  stageStartDate: Joi.string().allow('', null).optional(),
  team: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  tournamentActivity: Joi.object().unknown(true).allow(null).optional(),
  tournamentCategory: Joi.object().unknown(true).allow(null).optional(),
  tournamentConfig: Joi.object().unknown(true).allow(null).optional(),
  tournamentScopeMode: Joi.string().valid('team', 'autonomous').allow('', null).optional(),
  tournamentSection: Joi.object().unknown(true).allow(null).optional(),
  tournamentTeams: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
  type: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow(null).optional(),
  }).allow(null).optional(),
  validationMode: Joi.string().valid('auto', 'manual').allow(null).optional(),
}).unknown(true);

/**
 * Create a new event
 * @param {FCEventForm} eventData
 * @param {{ suppressCelebration?: boolean }} [options]
 * @returns {Promise<any>} 201
 */
export const createEvent = async (eventData, options = {}) => {
  const response = await client.post('/events', {
    data: eventData,
  });
  if (options?.suppressCelebration !== true) {
    celebrate('event_created', {
      eventId: response?.data?.data?.documentId || response?.data?.documentId || null,
      eventName: eventData?.name || eventData?.description || '',
      teamId: eventData?.team || eventData?.team?.documentId || null,
    });
  }
  emitGuidanceAction('event.created', {
    eventType: eventData?.type || null,
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
  const shouldCelebratePublish = eventData?.isActive === true
    || String(eventData?.status || '').trim().toLowerCase() === 'published';
  celebrate(shouldCelebratePublish ? 'event_published' : 'event_updated', {
    eventId: documentId,
    eventName: eventData?.name || eventData?.description || '',
    teamId: eventData?.team || eventData?.team?.documentId || null,
  });
  emitGuidanceAction('event.updated', {
    eventId: documentId,
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
 * @param {{ suppressCelebration?: boolean }} [options]
 * @returns {Promise<{created: Array<{payload: FCEventForm, response: any, documentId: string | null}>, failed: Array<{payload: FCEventForm, error: any}>}>}
 */
export const createEventsSequentially = async (payloads = [], options = {}) => (
  payloads.reduce(async (accPromise, payload) => {
    const acc = await accPromise;
    try {
      const response = await createEvent(payload, {
        suppressCelebration: options?.suppressCelebration === true,
      });
      const documentId = response?.data?.documentId || response?.documentId || null;
      acc.created.push({ documentId, payload, response });
    } catch (error) {
      acc.failed.push({ error, payload });
    }
    return acc;
  }, Promise.resolve({ created: [], failed: [] }))
);

/**
 * Create multiple events with bounded concurrency while preserving partial failure reporting.
 * @param {FCEventForm[]} payloads
 * @param {{ concurrency?: number, onProgress?: (progress: {
 *   completed: number,
 *   created: number,
 *   failed: number,
 *   total: number,
 * }) => void }} [options]
 * @returns {Promise<{created: Array<{payload: FCEventForm, response: any, documentId: string | null}>, failed: Array<{payload: FCEventForm, error: any}>}>}
 */
export const createEventsWithConcurrency = async (payloads = [], options = {}) => {
  const total = payloads.length;
  const concurrency = Math.max(1, Math.min(Number(options.concurrency || 1), total || 1));
  /** @type {Array<{index: number, payload: FCEventForm, response: any, documentId: string | null}>} */
  const created = [];
  /** @type {Array<{index: number, payload: FCEventForm, error: any}>} */
  const failed = [];
  let nextIndex = 0;
  let completed = 0;

  const notifyProgress = () => {
    options.onProgress?.({
      completed,
      created: created.length,
      failed: failed.length,
      total,
    });
  };

  const runWorker = async () => {
    while (nextIndex < total) {
      const index = nextIndex;
      nextIndex += 1;
      const payload = payloads[index];

      try {
        // Each worker intentionally processes its own queue sequentially to cap network concurrency.
        // eslint-disable-next-line no-await-in-loop
        const response = await createEvent(payload, {
          suppressCelebration: options?.suppressCelebration === true,
        });
        const documentId = response?.data?.documentId || response?.documentId || null;
        created.push({
          documentId,
          index,
          payload,
          response,
        });
      } catch (error) {
        failed.push({
          error,
          index,
          payload,
        });
      } finally {
        completed += 1;
        notifyProgress();
      }
    }
  };

  notifyProgress();
  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

  return {
    created: created
      .sort((left, right) => left.index - right.index)
      .map(({ index, ...item }) => item),
    failed: failed
      .sort((left, right) => left.index - right.index)
      .map(({ index, ...item }) => item),
  };
};

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
 * @param params
 * @returns {Promise<FCEvent>} The event
 */
const getEventByIdResponse = async (documentId, params = {}) => {
  const response = await client.get(`/events/${documentId}`, {
    params,
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

export const getEventById = async (documentId) => getEventByIdResponse(documentId, {
  populate: ['team',
    'club',
    'club.parentMultisport',
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
    // R2 — le CLUB de l'equipe invitee : sans lui, impossible de savoir si
    // elle est du notre, et une equipe de notre propre club devenait
    // l'adversaire (`eventDisplayName.js`).
    'invitedTeams.club',
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
    // R9 — SANS CE LIEN, UN CANDIDAT N A PAS DE POSTE : l ecran d une detection
    // range ses candidats en lisant `participation.recruitmentAd.documentId`.
    'participationRequests.recruitmentAd',
    'recruitmentAds',
    'recruitmentAds.candidates',
    'recruitmentAds.candidates.avatar',
    'recruitmentAds.level',
    'recruitmentAds.section',
    'recruitmentAds.category',
    'recruitmentAds.event',
    'recruitmentAds.event.type',
    'facility',
    'facilityOverrideRequest',
    'organizer',
    'parentEvent',
    'parentEvent.type',
    'parentEvent.team',
    'parentEvent.team.club',
    'childStageEvents',
    'childStageEvents.facility',
    'childStageEvents.type',
    'childStageEvents.team',
    'childStageEvents.team.club',
    'childStageEvents.participationRequests',
    'childStageEvents.participationRequests.user',
    'childStageEvents.participationRequests.user.avatar',
    'childStageEvents.missings',
    'childStageEvents.participations',
    'tournamentTeams',
    'tournamentTeams.captainUser',
    'tournamentTeams.captainUser.avatar',
    'tournamentTeams.adminUsers',
    'tournamentTeams.sourceTeam',
    'tournamentTeams.sourceTeam.club',
    'tournamentActivity',
    'tournamentSection',
    'tournamentCategory',
    'tournamentTeams.members',
    'tournamentTeams.members.user',
    'tournamentTeams.members.user.avatar',
    'team.club.sponsor',
    'team.club.sponsor.logo'],
});

/**
 * Get an event by ID using the lightweight edit projection.
 * @param {string} documentId - The event ID
 * @returns {Promise<FCEvent>} The event
 */
export const getEventByIdForEdit = async (documentId) => getEventByIdResponse(documentId, {
  projection: 'edit',
});

/**
 * Get the team audiences attached to an event.
 * @param {string} eventId
 * @returns {Promise<any>}
 */
export const getEventTeamAudiences = async (eventId) => {
  const response = await client.get(`/events/${eventId}/team-audiences`);
  return response.data;
};

/**
 * Invite a team to an event.
 * @param {string} eventId
 * @param {{ teamId: string, audienceKind?: 'organizer' | 'internal_invited' | 'external_invited', selectionMode?: 'ALL_MEMBERS' | 'SELECTED_MEMBERS', selectedMembers?: string[] }} payload
 * @returns {Promise<any>}
 */
export const inviteEventTeamAudience = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/team-audiences`, {
    data: payload,
  });
  return response.data;
};

/**
 * S10-C / D1 — LES INVITATIONS D EQUIPE QUI ATTENDENT MA REPONSE.
 *
 * Contrat S10-A du 2026-08-26 (`CONTRAT_S10A_invitations_serveur.md`, section 5) :
 * la route rend les audiences `PENDING` dont je suis encadrant de l equipe
 * invitee OU dirigeant de son club, sur un evenement a venir et non annule.
 *
 * 🔒 LE PERIMETRE EST CALCULE PAR LE SERVEUR, JAMAIS ENVOYE PAR L APP — c est
 * ce qui garantit que la pastille d accueil (`invitationsEquipe`) et cette
 * liste posent EXACTEMENT la meme question. Ajouter ici le moindre parametre
 * de filtrage rouvrirait le compteur fantome deja paye (piege Q1).
 * @returns {Promise<any>}
 */
export const getMyPendingEventTeamInvitations = async () => {
  const response = await client.get('/event-team-audiences/mine');
  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

/**
 * Update a team audience invitation response.
 * @param {string} audienceId
 * @param {'accept' | 'refuse' | 'cancel'} action
 * @returns {Promise<any>}
 */
export const respondEventTeamAudience = async (audienceId, action) => {
  const response = await client.post(`/event-team-audiences/${audienceId}/${action}`);
  return response.data;
};

/**
 * Self-assign to an event task.
 * @param {string} taskId
 * @param {{ userId?: string }} payload
 * @returns {Promise<any>}
 */
export const assignEventTask = async (taskId, payload = {}) => {
  const response = await client.post(`/event-tasks/${taskId}/assign`, {
    data: payload,
  });
  return response.data;
};

/**
 * Approve an event task assignment.
 * @param {string} assignmentId
 * @returns {Promise<any>}
 */
export const approveEventTaskAssignment = async (assignmentId) => {
  const response = await client.post(`/event-task-assignments/${assignmentId}/approve`);
  return response.data;
};

/**
 * Reject an event task assignment.
 * @param {string} assignmentId
 * @param {{ reason?: string }} payload
 * @returns {Promise<any>}
 */
export const rejectEventTaskAssignment = async (assignmentId, payload = {}) => {
  const response = await client.post(`/event-task-assignments/${assignmentId}/reject`, {
    data: payload,
  });
  return response.data;
};

/**
 * Cancel an event task assignment.
 * @param {string} assignmentId
 * @returns {Promise<any>}
 */
export const cancelEventTaskAssignment = async (assignmentId) => {
  const response = await client.post(`/event-task-assignments/${assignmentId}/cancel`);
  return response.data;
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
 * Auto-generate a team composition draft for an event branch.
 * @param {string} eventId
 * @param {{ teamId?: string, teamCount: number, teamPresets: Array<{presetKey: string}> }} payload
 * @returns {Promise<any>}
 */
export const generateEventCompositionDraft = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/composition/generate`, {
    data: {
      teamCount: Number(payload?.teamCount || 0),
      teamId: payload?.teamId || null,
      teamPresets: Array.isArray(payload?.teamPresets) ? payload.teamPresets : [],
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
  celebrate('event_convocation_published', {
    eventId,
    teamId: payload?.teamId || null,
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

const COMPACT_EVENT_CARD_FIELDS = [
  'bookingStatus',
  'capacity',
  'currentPlayers',
  'date',
  'documentId',
  'endTime',
  'eventFormat',
  'externalParticipantLimit',
  'externalParticipantValidationMode',
  'externalAutoSource',
  'featuredRequestStatus',
  'featuredScope',
  'isActive',
  'isFeatured',
  'isLastMinuteAlert',
  'location',
  'locationDetails',
  'missingPlayers',
  'name',
  'pricePerPerson',
  'reservationMode',
  'sessionStatus',
  'stageEndDate',
  'stageStartDate',
  'startTime',
  'totalPlayers',
];

const REQUEST_HUB_EVENT_FIELDS = [
  'createdAt',
  'date',
  'documentId',
  'externalParticipantLimit',
  'externalParticipantValidationMode',
  'name',
  'sessionStatus',
  'validationMode',
];

// `declined` en fait partie : sans lui, la vue reduite des cartes EFFACE les refus
// et le joueur repropose sa demande indefiniment. Le serveur laisse la ligne
// refusee ACTIVE (`isActive: true`, event-participation.ts:798-802), elle passe
// donc bien le filtre `isActive` juste en dessous.
const PARTICIPATION_REQUEST_STATUSES = ['accepted', 'declined', 'missing', 'pending'];
const REQUEST_HUB_PARTICIPATION_REQUEST_STATUSES = ['pending'];

const buildViewerScopedUserRelation = (viewerDocumentId) => {
  if (!viewerDocumentId) {
    return {
      fields: ['documentId'],
    };
  }

  return {
    fields: ['documentId'],
    filters: {
      documentId: viewerDocumentId,
    },
  };
};

const buildCompactEventCardPopulate = (viewerDocumentId) => ({
  club: {
    fields: ['documentId', 'name', 'addressDetails'],
    populate: {
      logo: {
        fields: ['url'],
      },
      sponsor: {
        fields: ['link', 'title'],
        populate: {
          logo: {
            fields: ['url'],
          },
        },
      },
    },
  },
  facility: {
    fields: ['documentId', 'name', 'planningColor'],
  },
  invitedTeams: {
    fields: ['documentId', 'name'],
    // R2 — le club de l'equipe invitee voyage AUSSI dans la vue reduite :
    // c'est elle qui alimente le nom affiche sur les cartes.
    populate: {
      club: {
        fields: ['documentId'],
      },
    },
  },
  league_match: {
    fields: ['documentId'],
  },
  missings: buildViewerScopedUserRelation(viewerDocumentId),
  parentEvent: {
    fields: ['documentId'],
  },
  participationRequests: {
    // `reason` transporte le MOTIF du refus, saisi par le staff : sans lui la carte
    // saurait dire « refusee » sans jamais pouvoir dire pourquoi.
    fields: ['createdAt', 'documentId', 'isActive', 'participationStatus', 'reason', 'updatedAt'],
    filters: {
      isActive: {
        $ne: false,
      },
      participationStatus: {
        $in: PARTICIPATION_REQUEST_STATUSES,
      },
      ...(viewerDocumentId
        ? {
          user: {
            documentId: viewerDocumentId,
          },
        }
        : {}),
    },
    populate: {
      user: {
        fields: ['documentId'],
      },
    },
  },
  participations: buildViewerScopedUserRelation(viewerDocumentId),
  team: {
    fields: ['documentId', 'name'],
    populate: {
      activities: {
        fields: ['documentId', 'name'],
      },
      category: {
        fields: ['documentId', 'name'],
      },
      club: {
        fields: ['documentId', 'name', 'addressDetails'],
        populate: {
          logo: {
            fields: ['url'],
          },
          sponsor: {
            fields: ['link', 'title'],
            populate: {
              logo: {
                fields: ['url'],
              },
            },
          },
        },
      },
      level: {
        fields: ['documentId', 'name'],
      },
      section: {
        fields: ['documentId', 'name'],
      },
    },
  },
  tournamentActivity: {
    fields: ['documentId', 'name'],
  },
  tournamentCategory: {
    fields: ['documentId', 'name'],
  },
  tournamentSection: {
    fields: ['documentId', 'name'],
  },
  type: {
    fields: ['documentId', 'name'],
  },
});

const buildRequestHubEventPopulate = () => ({
  participationRequests: {
    fields: ['createdAt', 'documentId', 'isActive', 'participationStatus', 'updatedAt'],
    filters: {
      isActive: {
        $ne: false,
      },
      participationStatus: {
        $in: REQUEST_HUB_PARTICIPATION_REQUEST_STATUSES,
      },
    },
    populate: ['sourceTeam', 'user', 'user.avatar'],
  },
  team: {
    fields: ['documentId', 'name'],
  },
  type: {
    fields: ['documentId', 'name'],
  },
});

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
 *   compact?: boolean;
 *   requestHub?: boolean;
 *   viewerDocumentId?: string;
 *  }} params - The parameters for filtering events
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{data: FCEvent[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getEvents = async (params = {}, options = {}) => {
  const {
    activity,
    category,
    club,
    compact = false,
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
    viewerDocumentId,
  } = params;
  const isRequestHubMode = params.requestHub === true;
  const normalizedSearchQuery = typeof q === 'string' ? q.trim() : q;

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

  if (club?.value || typeof club === 'string' || category || level || activity) {
    const clubDocumentId = club?.value || (typeof club === 'string' ? club : null);
    const toDocumentIdFilter = (value) => (Array.isArray(value) ? { $in: value } : value);
    const teamTaxonomyFilter = {};
    const autonomousTournamentFilter = {
      tournamentScopeMode: 'autonomous',
    };

    if (clubDocumentId) {
      teamTaxonomyFilter.club = {
        documentId: clubDocumentId,
      };
      autonomousTournamentFilter.club = {
        documentId: clubDocumentId,
      };
    }

    if (category) {
      teamTaxonomyFilter.category = {
        documentId: toDocumentIdFilter(category),
      };
      autonomousTournamentFilter.tournamentCategory = {
        documentId: toDocumentIdFilter(category),
      };
    }

    if (level) {
      teamTaxonomyFilter.level = {
        documentId: toDocumentIdFilter(level),
      };
    }

    if (activity) {
      teamTaxonomyFilter.activities = {
        documentId: toDocumentIdFilter(activity),
      };
      autonomousTournamentFilter.tournamentActivity = {
        documentId: toDocumentIdFilter(activity),
      };
    }

    const canIncludeAutonomousTournamentFilter = !level && !teamIds?.length;

    if (canIncludeAutonomousTournamentFilter) {
      filtersObj.$and = [
        ...(filtersObj.$and || []),
        {
          $or: [
            {
              team: teamTaxonomyFilter,
            },
            autonomousTournamentFilter,
          ],
        },
      ];
    } else {
      filtersObj.team = {
        ...(filtersObj.team || {}),
        ...teamTaxonomyFilter,
      };
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
      {
        club: {
          documentId: {
            $in: membershipClubIds,
          },
        },
      },
      {
        club: {
          parentMultisport: {
            documentId: {
              $in: membershipClubIds,
            },
          },
        },
      },
    ];
  }

  let fields;
  if (isRequestHubMode) {
    fields = REQUEST_HUB_EVENT_FIELDS;
  } else if (compact) {
    fields = COMPACT_EVENT_CARD_FIELDS;
  }

  let populate;
  if (isRequestHubMode) {
    populate = buildRequestHubEventPopulate();
  } else if (compact) {
    populate = buildCompactEventCardPopulate(viewerDocumentId);
  } else {
    populate = [
      'club',
      'club.sponsor',
      'club.sponsor.logo',
      'club.logo',
      'team',
      'team.club',
      'team.club.sponsor',
      'team.club.sponsor.logo',
      'team.club.logo',
      'team.section',
      'team.category',
      'team.level',
      'team.activities',
      'tournamentActivity',
      'tournamentSection',
      'tournamentCategory',
      'tournamentTeams',
      'tournamentTeams.members',
      'tournamentTeams.members.user',
      'tournamentTeams.captainUser',
      'tournamentTeams.adminUsers',
      'type',
      'participations',
      'missings',
      'facility',
      'invitedTeams',
      // R2 — meme raison qu'au-dessus dans `getEventById` : sans le club de
      // l'equipe invitee, une carte de la LISTE ne peut pas savoir qu'elle est
      // du notre, et affiche « Match vs <notre propre equipe> ».
      'invitedTeams.club',
      'participationRequests.user',
      'participationRequests.user.avatar',
      'participationRequests.sourceTeam',
      // R9 — meme raison qu a la ligne du dessus dans `getEventById` : sans ce
      // lien, un candidat est invisible sous son poste (recette du 24/08).
      'participationRequests.recruitmentAd',
      'league_match',
    ];
  }

  const filters = {
    filters: filtersObj,
    ...(normalizedSearchQuery ? { _q: normalizedSearchQuery } : {}),
    ...(fields ? { fields } : {}),
    myTeams: params.myTeams, // Pass myTeams filter to backend
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate,
    sort: params.sort ? [params.sort] : ['date:asc'], // Sort by date ascending
    // Location-based filtering (Haversine)
    ...(lat && lon && radius && { lat, lon, radius }),
  };

  const response = await client.get('/events', {
    params: filters,
    signal: options?.signal,
  });
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
  if (answer === 'present' && meta?.source !== 'push_action') {
    celebrate('event_rsvp_present', {
      eventId,
      eventName: meta?.eventName || '',
    });
  }
  return response.data;
};

/**
 * @typedef {object} RemindReport
 * @property {number} blockedCount - Personnes ecartees par l anti-spam de 48 h.
 * @property {string | null} lastRemindedAt - Date de la derniere relance recue.
 * @property {string | null} nextReminderAt - Date de la prochaine relance possible.
 * @property {string[]} recipients - Identifiants des personnes relancees.
 * @property {number} remindedCount - Nombre de personnes reellement relancees.
 * @property {number} unansweredCount - Personnes sans reponse au moment de l appel.
 */

/**
 * Relance les joueur.se.s qui n ont pas encore repondu.
 *
 * AC07 : le serveur rend desormais un COMPTE RENDU et non plus une liste
 * ignoree — combien de personnes ont ete relancees, combien ont ete ecartees
 * par l anti-spam de 48 h, et a partir de quand une relance touchera de
 * nouveau quelqu un. C est ce compte rendu qui permet a l ecran d arreter de
 * dire « c est envoye » quand rien n est parti.
 * @param {string | { eventId: string, teamId?: string | null }} input - L evenement vise.
 * @returns {Promise<RemindReport>} - Le compte rendu de la relance.
 */
export const remindUnansweredPlayers = async (input) => {
  const eventId = typeof input === 'string' ? input : input?.eventId;
  const teamId = typeof input === 'string' ? null : (input?.teamId || null);

  const response = await client.post(`/events/${eventId}/remind-unanswered-players`, {
    data: { teamId },
  });

  const body = response?.data?.data ?? response?.data ?? {};
  // Un serveur d une version anterieure rendait la LISTE seule. On la lit comme
  // telle plutot que d annoncer zero relance a tort : mentir dans l autre sens
  // reste mentir.
  const report = Array.isArray(body) ? { recipients: body } : body;
  const recipients = Array.isArray(report?.recipients) ? report.recipients : [];

  return {
    blockedCount: Number(report?.blockedCount) || 0,
    lastRemindedAt: report?.lastRemindedAt || null,
    nextReminderAt: report?.nextReminderAt || null,
    recipients,
    remindedCount: Number.isFinite(Number(report?.remindedCount))
      ? Number(report.remindedCount)
      : recipients.length,
    unansweredCount: Number(report?.unansweredCount) || 0,
  };
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
 * Request one or several featured placements for an event.
 * @param {{ eventId: string, scopes: string[] } | string} input
 * @returns {Promise<any>}
 */
export const requestFeatured = async (input) => {
  const eventId = typeof input === 'string' ? input : input?.eventId;
  const scopes = Array.isArray(input?.scopes) ? input.scopes : ['CM'];
  const response = await client.post(`/events/${eventId}/featured-requests`, {
    data: { scopes },
  });
  return response.data;
};

/**
 * Approve a featured request.
 * @param {string} requestId
 * @returns {Promise<any>}
 */
export const approveFeatured = async (requestId) => {
  const response = await client.post(`/featured-requests/${requestId}/approve`);
  return response.data;
};

/**
 * Reject a featured request.
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} [params.reason]
 * @returns {Promise<any>}
 */
export const rejectFeatured = async ({ reason, requestId }) => {
  const response = await client.post(`/featured-requests/${requestId}/reject`, {
    data: { reason: reason || '' },
  });
  return response.data;
};

/**
 * Get featured requests pending for the current validator context.
 * @param {{ clubId?: string, cmId?: string, scope?: string | string[], status?: string | string[] }} [params]
 * @returns {Promise<any>}
 */
export const getPendingFeaturedRequests = async (params = {}) => {
  const response = await client.get('/featured-requests/pending', {
    params,
  });
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
 * L5-A — Coach marks arrival for a WHOLE LIST at once (AD04, route `bulk`).
 *
 * « Tout pointer » sur 22 personnes ne doit pas faire 22 requetes depuis le
 * bord d'un terrain : le serveur plafonne la liste a 100 et repond LIGNE PAR
 * LIGNE (`items[].ok` / `items[].error`), sans jamais tout annuler pour un
 * seul refus. L'ecran qui l'appelle doit donc lire `items`, pas seulement le
 * code HTTP : une reponse 200 peut contenir 22 refus.
 * @param {string} eventId
 * @param {{ note?: string, userIds: string[] }} payload
 * @returns {Promise<any>}
 */
export const markCoachArrivalBulk = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/attendance/bulk`, payload);
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
 * APPEL / D7bis (26/08) — L encadrant declare quelqu un ABSENT.
 *
 * 🔴 C est une OUVERTURE : jusqu ici aucune route ne permettait ce geste. Le
 * serveur ecrit `no_show` avec un marqueur d origine `coach_manual`, qui le
 * distingue du `no_show` pose automatiquement par le cron de fin de match.
 * « Non pointé » est un fait ; « Absent » est un constat signe.
 * @param {string} eventId
 * @param {string} userId
 * @returns {Promise<any>}
 */
export const markCoachAbsence = async (eventId, userId) => {
  const response = await client.post(`/events/${eventId}/attendance/${userId}/coach-absence`);
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
 * @param {{ withoutContacts?: boolean }} [options] - `withoutContacts: true`
 *   demande au serveur un classeur SANS les colonnes e-mail et telephone, et le
 *   nom du fichier depose le dit. Absent, l export est celui d avant.
 * @returns {Promise<string>} - The path to the downloaded file
 */
export const exportEventParticipants = async (eventId, eventName, options = {}) => {
  const token = getAuthTokens()?.token;
  const baseURL = getApiBaseUrl();
  if (!baseURL) {
    throw new Error('API base URL is missing');
  }
  const withoutContacts = Boolean(options?.withoutContacts);
  const query = withoutContacts ? '?withoutContacts=1' : '';
  const url = `${baseURL}/events/${eventId}/export-participants${query}`;

  const { dirs } = ReactNativeBlobUtil.fs;
  // Un fichier qui ment sur son contenu est pire que pas de fichier : sur
  // Android il atterrit dans le dossier Telechargements public, ou son seul nom
  // dira s il porte ou non le carnet d adresses de l equipe.
  const suffix = withoutContacts ? '_sans_coordonnees' : '';
  const safeName = eventName ? eventName.replace(/[^a-zA-Z0-9]/g, '_') : 'event';
  const fileName = `participants_${safeName}${suffix}.xlsx`;

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
