import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';
import { RouteNames } from '@/navigation/routeNames';

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
 *  matchId?: string | number,
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
 * @param {unknown} payload
 * @returns {NotificationPayload}
 */
export const normalizeNotificationPayload = (payload) => {
  if (!isPlainObject(payload)) return {};
  const normalized = Object.entries(payload).reduce((/** @type {NotificationPayload} */ acc, [key, raw]) => {
    acc[key] = parseMaybeJson(raw);
    return acc;
  }, /** @type {NotificationPayload} */ ({}));
  if (normalized.type === NOTIFICATION_TYPES.LEAGUE_SCORE_DUE) {
    normalized.type = NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE;
  }
  return normalized;
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
  const type = payload.type;

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

  switch (type) {
    case NOTIFICATION_TYPES.ADD_TO_TEAM:
    case NOTIFICATION_TYPES.NEW_TEAM:
    case NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST:
      return teamDetailsDestination(payload.teamId);

    case NOTIFICATION_TYPES.TEAM_REQUEST:
      return {
        params: {
          params: payload.teamId ? { teamId: String(payload.teamId) } : {},
          screen: RouteNames.TeamMembershipRequests,
        },
        route: RouteNames.TeamStack,
      };

    case NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST:
      return {
        params: {
          params: payload.clubId ? { clubId: String(payload.clubId) } : {},
          screen: RouteNames.ClubMembershipRequests,
        },
        route: RouteNames.ClubStack,
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

    case NOTIFICATION_TYPES.EVENT_CANCELLATION:
      return eventDetailsDestination(payload.eventId) || { params: {}, route: RouteNames.MyEventList };

    case NOTIFICATION_TYPES.EVENT_REMINDER:
    case NOTIFICATION_TYPES.NEW_PARTICIPATION:
    case NOTIFICATION_TYPES.PARTICIPATION_REQUEST:
    case NOTIFICATION_TYPES.RESERVATION_PLAYER_JOINED:
    case NOTIFICATION_TYPES.RESERVATION_SOS_ALERT:
    case NOTIFICATION_TYPES.RESERVATION_COMPLETE:
    case NOTIFICATION_TYPES.FEATURED_REQUEST:
    case NOTIFICATION_TYPES.FEATURED_APPROVED:
    case NOTIFICATION_TYPES.FEATURED_REJECTED:
    case NOTIFICATION_TYPES.OVERBOOKING_REQUEST:
      return eventDetailsDestination(payload.eventId);

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

    case NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND:
    case NOTIFICATION_TYPES.MATCH_FOUND:
      return { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED:
    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED:
    case NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED:
      return chatDestination(payload.chatId || payload.conversationId)
        || { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_DUE:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED:
    case NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT:
    case NOTIFICATION_TYPES.LEAGUE_AUTOMATION:
    case NOTIFICATION_TYPES.REMATCH_REQUEST:
    case NOTIFICATION_TYPES.RSVP_ALERT:
      return { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.LEAGUE_SCORE_SUBMITTED_BY_OPPONENT:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT:
      return payload.matchId
        ? {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED:
      return payload.matchId
        ? {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.PastMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };

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

    case NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST:
      return payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadRequests,
        }
        : { params: {}, route: RouteNames.SquadSearch };

    case NOTIFICATION_TYPES.RECRUITMENT_APPLICATION:
    case NOTIFICATION_TYPES.RECRUITMENT_APPLICATION_AUTO:
      return payload.adId
        ? {
          params: { adId: String(payload.adId) },
          route: RouteNames.RecruitmentAdDetails,
        }
        : null;

    default:
      return null;
  }
};
