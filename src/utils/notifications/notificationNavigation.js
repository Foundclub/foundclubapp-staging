import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';
import { RouteNames } from '@/navigation/routeNames';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

const toParamsObject = (value) => (isPlainObject(value) ? value : {});

export const normalizeNotificationPayload = (payload) => {
  if (!isPlainObject(payload)) return {};
  return Object.entries(payload).reduce((acc, [key, raw]) => {
    acc[key] = parseMaybeJson(raw);
    return acc;
  }, {});
};

const eventDetailsDestination = (eventId) => {
  if (!eventId) return null;
  return {
    params: {
      params: { eventId },
      screen: RouteNames.EventDetails,
    },
    route: RouteNames.EventStack,
  };
};

const teamDetailsDestination = (teamId) => {
  if (!teamId) return null;
  return {
    params: {
      params: { teamId },
      screen: RouteNames.TeamDetails,
    },
    route: RouteNames.TeamStack,
  };
};

const chatDestination = (chatId) => {
  if (!chatId) return null;
  return {
    params: { chatId },
    route: RouteNames.Conversation,
  };
};

const profileDestination = (userId) => {
  if (!userId) return null;
  return {
    params: {
      params: { userId },
      screen: RouteNames.UserDetails,
    },
    route: RouteNames.ProfileStack,
  };
};

export const resolveNotificationDestination = (rawPayload = {}) => {
  const payload = normalizeNotificationPayload(rawPayload);
  const type = payload.type;

  if (payload.ctaRoute) {
    return {
      params: toParamsObject(payload.ctaParams),
      route: payload.ctaRoute,
    };
  }

  if (payload.route) {
    return {
      params: toParamsObject(payload.params),
      route: payload.route,
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
          params: payload.teamId ? { teamId: payload.teamId } : {},
          screen: RouteNames.TeamMembershipRequests,
        },
        route: RouteNames.TeamStack,
      };

    case NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST:
      return {
        params: {
          params: payload.clubId ? { clubId: payload.clubId } : {},
          screen: RouteNames.ClubMembershipRequests,
        },
        route: RouteNames.ClubStack,
      };

    case NOTIFICATION_TYPES.CLUB_REQUEST:
      return payload.clubId
        ? {
          params: {
            params: { clubId: payload.clubId },
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
    case NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT:
    case NOTIFICATION_TYPES.LEAGUE_AUTOMATION:
    case NOTIFICATION_TYPES.REMATCH_REQUEST:
    case NOTIFICATION_TYPES.RSVP_ALERT:
      return { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED:
      return payload.matchId
        ? {
          params: { matchId: payload.matchId },
          route: RouteNames.PastMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab };

    case NOTIFICATION_TYPES.RECRUITMENT_APPLICATION:
    case NOTIFICATION_TYPES.RECRUITMENT_APPLICATION_AUTO:
      return payload.adId
        ? {
          params: { adId: payload.adId },
          route: RouteNames.RecruitmentAdDetails,
        }
        : null;

    default:
      return null;
  }
};
