import { Platform } from 'react-native';

import { RouteNames } from '@/navigation/routeNames';

import { isFootballElevenSport } from '@/utils/leagueSportConfig';
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
 *  targetUserDocumentId?: string | number,
 *  targetUserId?: string | number,
 *  targetUserLabel?: string,
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
 * @param {NotificationPayload} payload
 * @returns {'presence' | 'venueBooking'}
 */
const getLeagueMatchFocusSection = (payload) => (
  isFootballElevenSport(payload?.matchSport) ? 'presence' : 'venueBooking'
);

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
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
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
    normalizeEntityId(payload.targetUserDocumentId || payload.targetUserId),
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

  const targetUserDocumentId = normalizeEntityId(merged.targetUserDocumentId);
  if (targetUserDocumentId) merged.targetUserDocumentId = targetUserDocumentId;

  const targetUserId = normalizeEntityId(merged.targetUserId);
  if (targetUserId) merged.targetUserId = targetUserId;

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
 * @param {unknown} eventId
 * @param {unknown} teamId
 */
const tournamentTeamDestination = (eventId, teamId) => {
  const safeTeamId = normalizeEntityId(teamId);
  const safeEventId = normalizeEntityId(eventId);
  if (!safeTeamId) return eventDetailsDestination(safeEventId);

  return {
    params: {
      params: {
        eventId: safeEventId,
        teamId: safeTeamId,
      },
      screen: RouteNames.TournamentTeamDetails,
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
      screen: RouteNames.EventDetails,
    },
    route: RouteNames.EventStack,
  };
};

/**
 * C-C — ECRAN 10 du pack composition : ou atterrit une convocation publiee.
 *
 * 🎯 Avant ce lot, elle atterrissait sur la page-fleuve de l'evenement : le
 * joueur devait deviner qu'il etait convoque, et sa place n'etait lisible que
 * dans l'ancien terrain en lecture seule.
 *
 * ⚠️ Le serveur envoie cette notification a TOUTE l'equipe — entraineurs,
 * organisateur et absents compris (`notification.ts:2054-2062`). L'ecran d'arrivee
 * le sait : il repose sur la page de l'evenement quiconque n'est pas convoque.
 * @param {unknown} eventId
 * @param {unknown} teamId
 */
const playerConvocationDestination = (eventId, teamId) => {
  const safeEventId = normalizeEntityId(eventId);
  if (!safeEventId) return null;
  return {
    params: {
      params: { eventId: safeEventId, teamId: normalizeEntityId(teamId) || undefined },
      screen: RouteNames.PlayerConvocation,
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
 * @param {NotificationPayload} payload
 * @param {{ route?: string, params?: Record<string, unknown> } | null} destination
 */
const adaptDestinationForCurrentPlatform = (payload, destination) => {
  if (!destination || Platform.OS !== 'web') {
    return destination;
  }

  const routeName = String(destination.route || '').trim();
  const safeMatchId = normalizeEntityId(payload?.matchId);
  const isLeagueMatchCenterDestination = routeName === RouteNames.LeagueMatchTab
    || routeName === RouteNames.LeagueHomeTab;

  if (!isLeagueMatchCenterDestination) {
    return destination;
  }

  if (safeMatchId) {
    const nextFocusSection = payload?.scoreFlowState
      ? undefined
      : (
        payload?.focusSection
        || getLeagueMatchFocusSection(payload)
      );

    return {
      params: {
        ...(nextFocusSection ? { focusSection: nextFocusSection } : {}),
        matchId: safeMatchId,
      },
      route: RouteNames.LeagueMatchDetails,
    };
  }

  return {
    params: {},
    route: RouteNames.LeagueDashboard,
  };
};

/**
 * @param {unknown} rawPayload
 */
export const resolveNotificationDestination = (rawPayload = {}) => {
  const payload = normalizeNotificationPayload(rawPayload);
  const { type } = payload;

  if (payload.ctaRoute) {
    return adaptDestinationForCurrentPlatform(payload, {
      params: toParamsObject(payload.ctaParams),
      route: String(payload.ctaRoute),
    });
  }

  if (payload.route) {
    return adaptDestinationForCurrentPlatform(payload, {
      params: toParamsObject(payload.params),
      route: String(payload.route),
    });
  }

  const leagueScoreActionTypes = new Set([
    NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
    NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
    NOTIFICATION_TYPES.LEAGUE_SCORE_SUBMITTED_BY_OPPONENT,
    NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED,
  ]);

  if (leagueScoreActionTypes.has(type) && payload.matchId) {
    return adaptDestinationForCurrentPlatform(payload, {
      params: {
        matchId: String(payload.matchId),
        scoreFlowState: payload.scoreFlowState || payload.phase || undefined,
      },
      route: RouteNames.EndMatchScreen,
    });
  }

  const leagueTabTypes = new Set([
    NOTIFICATION_TYPES.LEAGUE_AUTOMATION,
    NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_NEGOTIATION_TIMEOUT,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CANCELLED,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CHECK,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CONFIRMATION,
    NOTIFICATION_TYPES.LEAGUE_POST_SLOT_RESCHEDULED,
    NOTIFICATION_TYPES.LEAGUE_QUORUM_REACHED,
    NOTIFICATION_TYPES.LEAGUE_QUORUM_REMINDER,
    NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
    NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
    NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_STARTED,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_STILL_RUNNING,
    NOTIFICATION_TYPES.REMATCH_REQUEST,
    NOTIFICATION_TYPES.RSVP_ALERT,
  ]);

  if (leagueTabTypes.has(type)) {
    return adaptDestinationForCurrentPlatform(payload, { params: {}, route: RouteNames.LeagueMatchTab });
  }

  const recruitmentTypes = new Set([
    NOTIFICATION_TYPES.RECRUITMENT_APPLICATION,
    NOTIFICATION_TYPES.RECRUITMENT_APPLICATION_AUTO,
    NOTIFICATION_TYPES.RECRUITMENT_APPLICATION_STATUS,
  ]);

  if (recruitmentTypes.has(type)) {
    return adaptDestinationForCurrentPlatform(payload, payload.adId
      ? {
        params: { adId: String(payload.adId) },
        route: RouteNames.RecruitmentAdDetails,
      }
      : null);
  }

  // Matchs amicaux (lot L6) : les 4 notifications menent au DETAIL de l'annonce,
  // parce que c'est le seul ecran qui montre les deux cotes — les propositions
  // recues pour l'annonceur, sa propre proposition et le fil pour le candidat.
  const friendlyMatchTypes = new Set([
    NOTIFICATION_TYPES.FRIENDLY_MATCH_AD_EXPIRED,
    NOTIFICATION_TYPES.FRIENDLY_MATCH_APPLICATION,
    NOTIFICATION_TYPES.FRIENDLY_MATCH_APPLICATION_STATUS,
    NOTIFICATION_TYPES.FRIENDLY_MATCH_TERMS_UPDATED,
  ]);

  if (friendlyMatchTypes.has(type)) {
    // Sans `adId` on ne navigue PAS : `getWebRoutePattern` retomberait sur
    // l'accueil cote web, et l'ecran leverait cote natif. Mieux vaut ne rien
    // faire que d'emmener au mauvais endroit.
    return adaptDestinationForCurrentPlatform(payload, payload.adId
      ? {
        params: { adId: String(payload.adId) },
        route: RouteNames.FriendlyMatchAdDetails,
      }
      : null);
  }

  switch (type) {
    // Notif superadmin « Nouveau club a verifier » (self-onboard) : type serveur 'newSelfServiceClub'.
    case 'newSelfServiceClub':
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          params: {},
          screen: RouteNames.AdminClubOnboardingList,
        },
        route: RouteNames.AdminStack,
      });
    case NOTIFICATION_TYPES.ADD_TO_TEAM:
    case NOTIFICATION_TYPES.NEW_TEAM:
    case NOTIFICATION_TYPES.TEAM_EXTERNAL_SOURCE_UPDATED:
    case NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST: {
      // U06 — LA PORTE QUI MANQUAIT. `TeamMembershipRequestList` etait construit,
      // branche dans `TeamStack` et expose sur le web (`/teams/:teamId/requests`),
      // avec ZERO appelant dans tout `app/src` : meme CETTE notification-ci
      // renvoyait vers la fiche de l equipe, ou rien ne parle des demandes en
      // attente. Miroir exact de la porte du club (`CLUB_MEMBERSHIP_REQUEST` +
      // `requestType === 'claim'`, plus bas).
      // ⚠️ Sans `teamId` l ecran n a rien a lister : on retombe sur la fiche.
      const requestTeamId = normalizeEntityId(payload.teamId);
      if (type === NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST && requestTeamId) {
        return adaptDestinationForCurrentPlatform(payload, {
          params: {
            params: { teamId: requestTeamId },
            screen: RouteNames.TeamMembershipRequests,
          },
          route: RouteNames.TeamStack,
        });
      }
      return adaptDestinationForCurrentPlatform(payload, teamDetailsDestination(payload.teamId));
    }

    case NOTIFICATION_TYPES.AFFILIATION_HELP_REQUEST:
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          params: { filter: 'pending' },
          screen: RouteNames.AdminClaimList,
        },
        route: RouteNames.AdminStack,
      });

    case NOTIFICATION_TYPES.AFFILIATION_HELP_STATUS:
      return adaptDestinationForCurrentPlatform(payload, {
        params: {},
        route: RouteNames.NotificationList,
      });

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
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          initialFilter: 'club',
          source: 'notification',
        },
        route: RouteNames.RequestsHub,
      });

    case NOTIFICATION_TYPES.CLUB_REQUEST:
      return adaptDestinationForCurrentPlatform(payload, payload.clubId
        ? {
          params: {
            params: { clubId: String(payload.clubId) },
            screen: RouteNames.Club,
          },
          route: RouteNames.ClubStack,
        }
        : null);

    case NOTIFICATION_TYPES.COACH_REPORT_PUBLISHED:
    case NOTIFICATION_TYPES.EVENT_ABSENCE_FINAL:
    case NOTIFICATION_TYPES.EVENT_CANCELLATION:
    case NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED:
    case NOTIFICATION_TYPES.EVENT_CREATED:
    case NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER:
    case NOTIFICATION_TYPES.EVENT_PARTICIPANT_REMINDER:
    case NOTIFICATION_TYPES.EVENT_PUBLISHED:
    case NOTIFICATION_TYPES.EVENT_REMINDER:
    case NOTIFICATION_TYPES.EVENT_RSVP_STATUS_CHANGED:
    case NOTIFICATION_TYPES.EVENT_TEAM_INVITED:
    case NOTIFICATION_TYPES.EVENT_UPDATED:
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
        return adaptDestinationForCurrentPlatform(payload, coachReportPublishedDestination(payload));
      }
      // C-C — la convocation publiee ouvre l'ecran du joueur (ecran 10), pas la
      // page de l'evenement. Sans identifiant d'evenement, on retombe sur le
      // comportement d'avant plutot que sur un ecran vide.
      if (type === NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED) {
        return adaptDestinationForCurrentPlatform(
          payload,
          playerConvocationDestination(payload.eventId, payload.teamId)
            || eventDetailsDestination(payload.eventId),
        );
      }
      if (type === NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER) {
        return adaptDestinationForCurrentPlatform(
          payload,
          eventLineupDestination(payload.eventId)
            || eventDetailsDestination(payload.eventId),
        );
      }
      if (type === NOTIFICATION_TYPES.PARTICIPATION_REQUEST && String(payload.status || '').toLowerCase() === 'declined') {
        return adaptDestinationForCurrentPlatform(payload, notificationDetailsDestination(payload));
      }
      return adaptDestinationForCurrentPlatform(payload, eventDetailsDestination(payload.eventId));
    case NOTIFICATION_TYPES.LEAGUE_COUNTER_PROPOSAL_RECEIVED:
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          params: {
            matchId: payload.matchId ? String(payload.matchId) : undefined,
            openLeagueProposal: true,
            openLeagueProposalToken: String(payload.notificationId || payload.dedupeKey || payload.matchId || 'counter-proposal'),
          },
          screen: RouteNames.LeagueMatchTab,
        },
        route: RouteNames.LeagueHomeTab,
      });
    case NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED:
      return adaptDestinationForCurrentPlatform(
        payload,
        chatDestination(payload.chatId || payload.conversationId)
          || { params: {}, route: RouteNames.LeagueMatchTab },
      );
    case NOTIFICATION_TYPES.LEAGUE_MATCH_FINALIZED: {
      const finalStatus = String(payload.finalStatus || '').toLowerCase();
      if (finalStatus === 'valid' && payload.matchId) {
        return adaptDestinationForCurrentPlatform(payload, {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.PastMatchDetails,
        });
      }
      if (payload.matchId) {
        return adaptDestinationForCurrentPlatform(payload, {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.LeagueMatchDetails,
        });
      }
      return adaptDestinationForCurrentPlatform(payload, { params: {}, route: RouteNames.LeagueMatchTab });
    }
    case NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND:
    case NOTIFICATION_TYPES.MATCH_FOUND:
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          params: {
            matchId: payload.matchId ? String(payload.matchId) : undefined,
            openLeagueProposal: true,
            openLeagueProposalToken: String(payload.notificationId || payload.dedupeKey || payload.matchId || 'match-found'),
          },
          screen: RouteNames.LeagueMatchTab,
        },
        route: RouteNames.LeagueHomeTab,
      });
    case NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED:
      return adaptDestinationForCurrentPlatform(payload, payload.matchId
        ? {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.PastMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab });
    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED:
      return adaptDestinationForCurrentPlatform(payload, payload.matchId
        ? {
          params: {
            focusSection: getLeagueMatchFocusSection(payload),
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab });
    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_DECLINED:
      return adaptDestinationForCurrentPlatform(payload, payload.matchId
        ? {
          params: {
            focusSection: 'negotiation',
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab });
    case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED:
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          params: {
            matchId: payload.matchId ? String(payload.matchId) : undefined,
            openLeagueProposal: true,
            openLeagueProposalToken: String(payload.notificationId || payload.dedupeKey || payload.matchId || 'proposal'),
          },
          screen: RouteNames.LeagueMatchTab,
        },
        route: RouteNames.LeagueHomeTab,
      });
    case NOTIFICATION_TYPES.LEAGUE_QUORUM_REACHED:
    case NOTIFICATION_TYPES.LEAGUE_QUORUM_REMINDER:
      return adaptDestinationForCurrentPlatform(payload, payload.matchId
        ? {
          params: {
            focusSection: 'presence',
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab });
    case NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_SUBMITTED_BY_OPPONENT:
    case NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED:
      return adaptDestinationForCurrentPlatform(payload, payload.matchId
        ? {
          params: { matchId: String(payload.matchId) },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab });
    case NOTIFICATION_TYPES.LEAGUE_SQUAD_INVITATION:
      return adaptDestinationForCurrentPlatform(payload, payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadDetails,
        }
        : { params: {}, route: RouteNames.SquadSearch });
    case NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST:
      return adaptDestinationForCurrentPlatform(payload, payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadRequests,
        }
        : { params: {}, route: RouteNames.SquadSearch });
    case NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST_STATUS:
      return adaptDestinationForCurrentPlatform(payload, payload.teamId
        ? {
          params: { teamId: String(payload.teamId) },
          route: RouteNames.SquadDetails,
        }
        : { params: {}, route: RouteNames.SquadSearch });
    case NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED:
      return adaptDestinationForCurrentPlatform(payload, payload.matchId
        ? {
          params: {
            focusSection: getLeagueMatchFocusSection(payload),
            matchId: String(payload.matchId),
          },
          route: RouteNames.LeagueMatchDetails,
        }
        : { params: {}, route: RouteNames.LeagueMatchTab });
    case NOTIFICATION_TYPES.LICENSE_CAMPAIGN_CLOSED:
    case NOTIFICATION_TYPES.LICENSE_CAMPAIGN_PAUSED:
    case NOTIFICATION_TYPES.LICENSE_CAMPAIGN_PUBLISHED:
    case NOTIFICATION_TYPES.LICENSE_DOCUMENT_REPLACEMENT_REQUIRED:
    case NOTIFICATION_TYPES.LICENSE_DOCUMENT_SUBMITTED:
    case NOTIFICATION_TYPES.LICENSE_INSTALLMENT_OVERDUE:
    case NOTIFICATION_TYPES.LICENSE_PAYMENT_CONFIRMED:
    case NOTIFICATION_TYPES.LICENSE_PAYMENT_DUE:
    case NOTIFICATION_TYPES.LICENSE_PAYMENT_REJECTED:
    case NOTIFICATION_TYPES.LICENSE_PAYMENT_REMINDER:
    case NOTIFICATION_TYPES.LICENSE_PAYMENT_SUBMITTED:
      return adaptDestinationForCurrentPlatform(payload, {
        params: payload.assignmentId ? { assignmentId: String(payload.assignmentId) } : {},
        route: RouteNames.MyLicense,
      });
    case NOTIFICATION_TYPES.NEW_GROUP_MESSAGE:
    case NOTIFICATION_TYPES.NEW_LEAGUE_MATCH_MESSAGE:
    case NOTIFICATION_TYPES.NEW_TEAM_MESSAGE:
    case NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE:
    case NOTIFICATION_TYPES.NEW_WHISPER:
      return adaptDestinationForCurrentPlatform(payload, chatDestination(payload.chatId || payload.conversationId));

    case NOTIFICATION_TYPES.SEARCH_ALERT_MATCH: {
      const alertType = payload.alertType || payload.matchType || payload.dataType || payload.kind || payload.notificationKind || payload.type;
      if (alertType === 'event') {
        return adaptDestinationForCurrentPlatform(payload, eventDetailsDestination(payload.eventId));
      }
      if (alertType === 'mercato') {
        return adaptDestinationForCurrentPlatform(payload, profileDestination(payload.profileId));
      }
      if (payload.eventId) return adaptDestinationForCurrentPlatform(payload, eventDetailsDestination(payload.eventId));
      if (payload.profileId) return adaptDestinationForCurrentPlatform(payload, profileDestination(payload.profileId));
      return adaptDestinationForCurrentPlatform(payload, { params: {}, route: RouteNames.SearchAlerts });
    }
    case NOTIFICATION_TYPES.TEAM_FIRST_EVENT_CREATED:
      return adaptDestinationForCurrentPlatform(payload, {
        route: RouteNames.AdminDashboard,
      });
    case NOTIFICATION_TYPES.TEAM_REQUEST:
      return adaptDestinationForCurrentPlatform(payload, {
        params: {
          initialFilter: 'team',
          source: 'notification',
        },
        route: RouteNames.RequestsHub,
      });
    case NOTIFICATION_TYPES.TOURNAMENT_CAPTAIN_TRANSFER:
    case NOTIFICATION_TYPES.TOURNAMENT_TEAM_INVITATION:
    case NOTIFICATION_TYPES.TOURNAMENT_TEAM_INVITATION_STATUS:
    case NOTIFICATION_TYPES.TOURNAMENT_TEAM_JOIN_REQUEST:
    case NOTIFICATION_TYPES.TOURNAMENT_TEAM_JOIN_REQUEST_STATUS:
    case NOTIFICATION_TYPES.TOURNAMENT_TEAM_STATUS:
      return tournamentTeamDestination(payload.eventId, payload.teamId);
    case NOTIFICATION_TYPES.TOURNAMENT_CLOSED:
      return eventDetailsDestination(payload.eventId);
    case NOTIFICATION_TYPES.TOURNAMENT_TEAM_ROSTER_WARNING:
      return {
        params: {
          eventId: normalizeEntityId(payload.eventId),
        },
        route: RouteNames.TournamentManagement,
      };

    default:
      return null;
  }
};
