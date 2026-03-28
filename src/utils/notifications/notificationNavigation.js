import { RouteNames } from '@/navigation/routeNames';

import {
  normalizeNotificationType,
  NOTIFICATION_TYPES,
} from '@/utils/notifications/notificationTypes';

/**
 * @typedef {Record<string, unknown> & {
 *  type?: string,
 *  ctaRoute?: string,
 *  ctaParams?: unknown,
 *  route?: string,
 *  params?: unknown,
 *  teamId?: string | number,
 *  clubId?: string | number,
 *  eventId?: string | number,
 *  chatId?: string | number,
 *  conversationId?: string | number,
 *  profileId?: string | number,
 *  alertType?: string,
 *  matchType?: string,
 *  dataType?: string,
 *  kind?: string,
 *  notificationKind?: string,
 *  status?: string,
 *  reason?: string,
 *  eventDetails?: string,
 *  createdAt?: string,
 *  notificationTitle?: string,
 *  notificationBody?: string,
 *  notificationId?: string | number,
 *  dedupeKey?: string,
 *  matchId?: string | number,
 *  sourceDocumentId?: string | number,
 *  sourceType?: string,
 *  adId?: string | number,
 * }} NotificationPayload
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {unknown}
 */
const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      return value;
    }
  }
  return value;
};

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const toParamsObject = (value) => (isPlainObject(value) ? value : {});

/**
 * @param {unknown} value
 * @returns {string | null}
 */
const normalizeEntityId = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

/**
 * @param {...unknown} values
 * @returns {unknown}
 */
const firstDefinedValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

/**
 * @param {unknown} value
 * @returns {string}
 */
const toSafeString = (value) => (typeof value === 'string' ? value : '');

/**
 * @param {NotificationPayload} payload
 * @returns {string}
 */
const buildNotificationFallbackKey = (payload) => {
  const identifiers = [
    payload.type,
    normalizeEntityId(payload.notificationId),
    normalizeEntityId(payload.matchId),
    normalizeEntityId(payload.eventId),
    normalizeEntityId(payload.chatId || payload.conversationId),
    normalizeEntityId(payload.teamId),
    normalizeEntityId(payload.clubId),
    normalizeEntityId(payload.adId),
    toSafeString(payload.createdAt),
  ].filter(Boolean);

  return identifiers.length > 0 ? identifiers.join(':') : 'notification:unknown';
};

/**
 * @param {unknown} payload
 * @returns {NotificationPayload}
 */
export const normalizeNotificationPayload = (payload) => {
  if (!isPlainObject(payload)) return {};
  const normalized = Object.entries(payload).reduce((/** @type {NotificationPayload} */ acc, [key, raw]) => {
    acc[key] = parseMaybeJson(raw);
    return acc;
  }, /** @type {NotificationPayload} */ ({}));

  const nestedData = isPlainObject(normalized.data)
    ? /** @type {NotificationPayload} */ (normalized.data)
    : /** @type {NotificationPayload} */ ({});
  const merged = {
    ...nestedData,
    ...normalized,
  };

  merged.type = normalizeNotificationType(
    firstDefinedValue(
      merged.type,
      merged.notificationType,
      merged.kind,
      merged.notificationKind,
      merged.dataType,
    ),
  );

  const notificationId = normalizeEntityId(
    firstDefinedValue(merged.notificationId, merged.documentId, merged.id),
  );
  if (notificationId) {
    merged.notificationId = notificationId;
  }

  const chatId = normalizeEntityId(firstDefinedValue(merged.chatId, merged.conversationId));
  if (chatId) {
    merged.chatId = chatId;
    merged.conversationId = chatId;
  }

  const eventId = normalizeEntityId(merged.eventId);
  if (eventId) merged.eventId = eventId;

  const teamId = normalizeEntityId(merged.teamId);
  if (teamId) merged.teamId = teamId;

  const clubId = normalizeEntityId(merged.clubId);
  if (clubId) merged.clubId = clubId;

  const profileId = normalizeEntityId(merged.profileId);
  if (profileId) merged.profileId = profileId;

  const matchId = normalizeEntityId(merged.matchId);
  if (matchId) merged.matchId = matchId;

  const adId = normalizeEntityId(firstDefinedValue(merged.adId, merged.recruitmentAdId));
  if (adId) merged.adId = adId;

  if (!toSafeString(merged.notificationTitle) && toSafeString(merged.title)) {
    merged.notificationTitle = merged.title;
  }

  if (!toSafeString(merged.notificationBody) && toSafeString(merged.body)) {
    merged.notificationBody = merged.body;
  }

  if (!toSafeString(merged.dedupeKey)) {
    merged.dedupeKey = buildNotificationFallbackKey(merged);
  }

  return merged;
};

/**
 * @param {unknown} rawPayload
 * @returns {string}
 */
export const getNotificationOpenKey = (rawPayload) => {
  const payload = normalizeNotificationPayload(rawPayload);
  const explicitKey = toSafeString(payload.dedupeKey).trim();
  if (explicitKey) return explicitKey;
  return buildNotificationFallbackKey(payload);
};

/**
 * @param {unknown} eventId
 */
const eventDetailsDestination = (eventId) => {
  const safeEventId = normalizeEntityId(eventId);
  if (!safeEventId) return null;
  return {
    params: {
      params: { eventId: safeEventId },
      screen: RouteNames.EventDetails,
    },
    route: RouteNames.EventStack,
  };
};

/**
 * @param {NotificationPayload} payload
 */
const coachReportPublishedDestination = (payload) => {
  const sourceType = String(payload.sourceType || '').trim().toLowerCase();
  const sourceDocumentId = normalizeEntityId(
    firstDefinedValue(payload.sourceDocumentId, payload.matchId, payload.eventId),
  );

  if (!sourceDocumentId) return null;

  if (sourceType === 'league_match' || sourceType === 'league') {
    return {
      params: {
        focusSection: 'coachFeedback',
        matchId: sourceDocumentId,
      },
      route: RouteNames.LeagueMatchDetails,
    };
  }

  return {
    params: {
      params: {
        eventId: sourceDocumentId,
        focusSection: 'coachFeedback',
      },
      screen: RouteNames.EventDetails,
    },
    route: RouteNames.EventStack,
  };
};

/**
 * @param {unknown} eventId
 */
const eventLineupDestination = (eventId) => {
  const safeEventId = normalizeEntityId(eventId);
  if (!safeEventId) return null;
  return {
    params: {
      params: { eventId: safeEventId },
      screen: RouteNames.TacticalSelectionV2,
    },
    route: RouteNames.EventStack,
  };
};

/**
 * @param {NotificationPayload} payload
 */
const notificationDetailsDestination = (payload) => {
  const safeEventId = normalizeEntityId(payload.eventId);
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const status = typeof payload.status === 'string' ? payload.status : '';
  const createdAt = typeof payload.createdAt === 'string' ? payload.createdAt : '';
  const eventDetails = typeof payload.eventDetails === 'string' ? payload.eventDetails : '';
  let notificationTitle = '';
  if (typeof payload.notificationTitle === 'string') {
    notificationTitle = payload.notificationTitle;
  } else if (typeof payload.title === 'string') {
    notificationTitle = payload.title;
  }

  let notificationBody = '';
  if (typeof payload.notificationBody === 'string') {
    notificationBody = payload.notificationBody;
  } else if (typeof payload.body === 'string') {
    notificationBody = payload.body;
  }
  const notificationId = normalizeEntityId(payload.notificationId);

  return {
    params: {
      notification: {
        body: notificationBody,
        createdAt,
        data: {
          eventDetails,
          eventId: safeEventId,
          reason,
          status,
          type: payload.type,
        },
        documentId: notificationId,
        title: notificationTitle,
        type: payload.type,
      },
    },
    route: RouteNames.NotificationDetails,
  };
};

/**
 * @param {unknown} teamId
 */
const teamDetailsDestination = (teamId) => {
  const safeTeamId = normalizeEntityId(teamId);
  if (!safeTeamId) return null;
  return {
    params: {
      params: { teamId: safeTeamId },
      screen: RouteNames.TeamDetails,
    },
    route: RouteNames.TeamStack,
  };
};

/**
 * @param {unknown} chatId
 */
const chatDestination = (chatId) => {
  const safeChatId = normalizeEntityId(chatId);
  if (!safeChatId) return null;
  return {
    params: { chatId: safeChatId },
    route: RouteNames.Conversation,
  };
};

/**
 * @param {unknown} userId
 */
const profileDestination = (userId) => {
  const safeUserId = normalizeEntityId(userId);
  if (!safeUserId) return null;
  return {
    params: {
      params: { userId: safeUserId },
      screen: RouteNames.UserDetails,
    },
    route: RouteNames.ProfileStack,
  };
};

/**
 * @param {unknown} rawPayload
 */
export const resolveNotificationDestination = (rawPayload = {}) => {
  const payload = normalizeNotificationPayload(rawPayload);
  const { type } = payload;

  if (payload.ctaRoute) {
    return {
      params: toParamsObject(payload.ctaParams),
      route: String(payload.ctaRoute),
    };
  }

  if (payload.route) {
    return {
      params: toParamsObject(payload.params),
      route: String(payload.route),
    };
  }

  const leagueTabTypes = new Set([
    NOTIFICATION_TYPES.LEAGUE_AUTOMATION,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CANCELLED,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CHECK,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CONFIRMATION,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_RESCHEDULED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
    NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT,
    NOTIFICATION_TYPES.REMATCH_REQUEST,
    NOTIFICATION_TYPES.RSVP_ALERT,
  ]);

  if (leagueTabTypes.has(type)) {
    return { params: {}, route: RouteNames.LeagueMatchTab };
  }

  const recruitmentTypes = new Set([
    NOTIFICATION_TYPES.RECRUITMENT_APPLICATION,
    NOTIFICATION_TYPES.RECRUITMENT_APPLICATION_AUTO,
  ]);

  if (recruitmentTypes.has(type)) {
    return payload.adId
      ? {
        params: { adId: String(payload.adId) },
        route: RouteNames.RecruitmentAdDetails,
      }
      : null;
  }

  switch (type) {
    case NOTIFICATION_TYPES.ADD_TO_TEAM:
    case NOTIFICATION_TYPES.NEW_TEAM:
    case NOTIFICATION_TYPES.TEAM_EXTERNAL_SOURCE_UPDATED:
    case NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST:
      return teamDetailsDestination(payload.teamId);

    case NOTIFICATION_TYPES.AFFILIATION_HELP_REQUEST:
      return {
        params: {
          params: { filter: 'pending' },
          screen: RouteNames.AdminClaimList,
        },
        route: RouteNames.AdminStack,
      };

    case NOTIFICATION_TYPES.AFFILIATION_HELP_STATUS:
      return {
        params: {},
        route: RouteNames.NotificationList,
      };

    case NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST:
      if (payload.requestType === 'claim') {
        return {
          params: {
            params: payload.clubId ? { clubId: String(payload.clubId) } : {},
            screen: RouteNames.ClubMembershipRequests,
          },
          route: RouteNames.ClubStack,
        };
      }
      return {
        params: {
          initialFilter: 'club',
          source: 'notification',
        },
        route: RouteNames.RequestsHub,
      };

    case NOTIFICATION_TYPES.CLUB_REQUEST:
      return payload.clubId
        ? {
          params: {
            params: { clubId: String(payload.clubId) },
            screen: RouteNames.Club,
          },
          route: RouteNames.ClubStack,
        }
        : null;

    case NOTIFICATION_TYPES.COACH_REPORT_PUBLISHED:
    case NOTIFICATION_TYPES.EVENT_ABSENCE_FINAL:
    case NOTIFICATION_TYPES.EVENT_CANCELLATION:
    case NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED:
    case NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER:
    case NOTIFICATION_TYPES.EVENT_PARTICIPANT_REMINDER:
    case NOTIFICATION_TYPES.EVENT_REMINDER:
    case NOTIFICATION_TYPES.EVENT_TEAM_INVITED:
    case NOTIFICATION_TYPES.FEATURED_APPROVED:
    case NOTIFICATION_TYPES.FEATURED_REJECTED:
    case NOTIFICATION_TYPES.FEATURED_REQUEST:
    case NOTIFICATION_TYPES.NEW_PARTICIPATION:
    case NOTIFICATION_TYPES.OVERBOOKING_REQUEST:
    case NOTIFICATION_TYPES.PARTICIPATION_REQUEST:
    case NOTIFICATION_TYPES.RESERVATION_COMPLETE:
    case NOTIFICATION_TYPES.RESERVATION_PLAYER_JOINED:
    case NOTIFICATION_TYPES.RESERVATION_SOS_ALERT:
      if (type === NOTIFICATION_TYPES.COACH_REPORT_PUBLISHED) {
        return coachReportPublishedDestination(payload);
      }
      if (type === NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER) {
        return eventLineupDestination(payload.eventId)
          || eventDetailsDestination(payload.eventId);
      }
      if (type === NOTIFICATION_TYPES.PARTICIPATION_REQUEST && String(payload.status || '').toLowerCase() === 'declined') {
        return notificationDetailsDestination(payload);
      }
      return eventDetailsDestination(payload.eventId);
    case NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED:
      return chatDestination(payload.chatId || payload.conversationId)
        || { params: {}, route: RouteNames.LeagueMatchTab };
    case NOTIFICATION_TYPES.LEAGUE_MATCH_FINALIZED: {
      const finalStatus = String(payload.finalStatus || '').toLowerCase();
      if (finalStatus === 'valid' && payload.matchId) {
        return {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.PastMatchDetails,
        };
      }
      if (payload.matchId) {
        return {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.LeagueMatchDetails,
        };
      }
      return { params: {}, route: RouteNames.LeagueMatchTab };
    }
    case NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND:
    case NOTIFICATION_TYPES.MATCH_FOUND:
      return payload.matchId
        ? {
          params: {
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : {
          params: {
            params: {
              forceLeagueActionPrompt: true,
            },
            screen: RouteNames.LeagueDashboard,
          },
          route: RouteNames.LeagueHomeTab,
        };
    case NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED:
      return payload.matchId
        ? {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.PastMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };
    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED:
      return payload.matchId
        ? {
          params: {
            focusSection: 'venueBooking',
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };
    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED:
      return {
        params: {
          params: {
            forceLeagueActionPrompt: true,
            forceLeagueActionPromptToken: String(payload.notificationId || payload.dedupeKey || payload.matchId || 'proposal'),
            matchId: payload.matchId ? String(payload.matchId) : undefined,
          },
          screen: RouteNames.LeagueDashboard,
        },
        route: RouteNames.LeagueHomeTab,
      };
    case NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_SUBMITTED_BY_OPPONENT:
      return payload.matchId
        ? {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };
    case NOTIFICATION_TYPES.LEAGUE_SQUAD_INVITATION:
      return payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadDetails,
        }
        : { params: {}, route: RouteNames.SquadSearch };
    case NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST:
      return payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadRequests,
        }
        : { params: {}, route: RouteNames.SquadSearch };
    case NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST_STATUS:
      return payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadDetails,
        }
        : { params: {}, route: RouteNames.SquadSearch };
    case NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED:
      return payload.matchId
        ? {
          params: {
            focusSection: 'venueBooking',
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.NEW_LEAGUE_MATCH_MESSAGE:
    case NOTIFICATION_TYPES.NEW_TEAM_MESSAGE:
    case NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE:
    case NOTIFICATION_TYPES.NEW_WHISPER:
      return chatDestination(payload.chatId || payload.conversationId);

    case NOTIFICATION_TYPES.SEARCH_ALERT_MATCH: {
      const alertType = payload.alertType || payload.matchType || payload.dataType || payload.kind || payload.notificationKind || payload.type;
      if (alertType === 'event') {
        return eventDetailsDestination(payload.eventId);
      }
      if (alertType === 'mercato') {
        return profileDestination(payload.profileId);
      }
      if (payload.eventId) return eventDetailsDestination(payload.eventId);
      if (payload.profileId) return profileDestination(payload.profileId);
      return { params: {}, route: RouteNames.SearchAlerts };
    }
    case NOTIFICATION_TYPES.TEAM_REQUEST:
      return {
        params: {
          initialFilter: 'team',
          source: 'notification',
        },
        route: RouteNames.RequestsHub,
      };

    default:
      return null;
  }
};
