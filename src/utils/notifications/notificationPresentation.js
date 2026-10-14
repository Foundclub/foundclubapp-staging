import i18next from 'i18next';

import localeDesFormats from '@/theme/strings/localeDesFormats';

import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

const TEAM_ICON_TYPES = new Set([
  NOTIFICATION_TYPES.ADD_TO_TEAM,
  NOTIFICATION_TYPES.LEAGUE_SQUAD_INVITATION,
  NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST,
  NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST_STATUS,
  NOTIFICATION_TYPES.NEW_TEAM,
  NOTIFICATION_TYPES.RSVP_ALERT,
  NOTIFICATION_TYPES.TEAM_EXTERNAL_SOURCE_UPDATED,
  NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST,
  NOTIFICATION_TYPES.TEAM_REQUEST,
  NOTIFICATION_TYPES.TOURNAMENT_CAPTAIN_TRANSFER,
  NOTIFICATION_TYPES.TOURNAMENT_TEAM_INVITATION,
  NOTIFICATION_TYPES.TOURNAMENT_TEAM_INVITATION_STATUS,
  NOTIFICATION_TYPES.TOURNAMENT_TEAM_JOIN_REQUEST,
  NOTIFICATION_TYPES.TOURNAMENT_TEAM_JOIN_REQUEST_STATUS,
  NOTIFICATION_TYPES.TOURNAMENT_TEAM_ROSTER_WARNING,
  NOTIFICATION_TYPES.TOURNAMENT_TEAM_STATUS,
]);

const CLUB_ICON_TYPES = new Set([
  NOTIFICATION_TYPES.AFFILIATION_HELP_REQUEST,
  NOTIFICATION_TYPES.AFFILIATION_HELP_STATUS,
  NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST,
  NOTIFICATION_TYPES.CLUB_REQUEST,
  'newSelfServiceClub',
]);

// COLL-C4A3 (03/10) — une actualité de la Ville a SON icône, le bâtiment à colonnes (planche 19).
// Le type est celui du serveur (admin/src/api/user-fcm-token/types/index.ts,
// COLLECTIVITE_NEWS_PUBLISHED) : l'app ne le déclare pas ailleurs, il n'a pas d'autre usage ici.
const COLLECTIVITE_NEWS_TYPE = 'collectiviteNewsPublished';

const EVENT_ICON_TYPES = new Set([
  NOTIFICATION_TYPES.COACH_REPORT_PUBLISHED,
  NOTIFICATION_TYPES.EVENT_ABSENCE_FINAL,
  NOTIFICATION_TYPES.EVENT_CANCELLATION,
  NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED,
  NOTIFICATION_TYPES.EVENT_CONVOCATION_REMOVED,
  NOTIFICATION_TYPES.EVENT_PARTICIPANT_REMINDER,
  NOTIFICATION_TYPES.EVENT_PUBLISHED,
  NOTIFICATION_TYPES.EVENT_REMINDER,
  NOTIFICATION_TYPES.EVENT_RSVP_STATUS_CHANGED,
  NOTIFICATION_TYPES.EVENT_TEAM_INVITED,
  NOTIFICATION_TYPES.EVENT_UPDATED,
  NOTIFICATION_TYPES.FEATURED_APPROVED,
  NOTIFICATION_TYPES.FEATURED_REJECTED,
  NOTIFICATION_TYPES.FEATURED_REQUEST,
  NOTIFICATION_TYPES.NEW_PARTICIPATION,
  NOTIFICATION_TYPES.OVERBOOKING_REQUEST,
  NOTIFICATION_TYPES.PARTICIPATION_REQUEST,
  NOTIFICATION_TYPES.RESERVATION_COMPLETE,
  NOTIFICATION_TYPES.RESERVATION_PLAYER_JOINED,
  NOTIFICATION_TYPES.RESERVATION_SOS_ALERT,
  NOTIFICATION_TYPES.TOURNAMENT_CLOSED,
  NOTIFICATION_TYPES.TRAINING_REVIEW_RECEIVED,
  NOTIFICATION_TYPES.TRAINING_REVIEW_REQUEST,
]);

const LEAGUE_ICON_TYPES = new Set([
  NOTIFICATION_TYPES.LEAGUE_AUTOMATION,
  NOTIFICATION_TYPES.LEAGUE_COUNTER_PROPOSAL_RECEIVED,
  NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_NEGOTIATION_TIMEOUT,
  NOTIFICATION_TYPES.LEAGUE_MATCH_FINALIZED,
  NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND,
  NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED,
  NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CANCELLED,
  NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CHECK,
  NOTIFICATION_TYPES.LEAGUE_POST_SLOT_CONFIRMATION,
  NOTIFICATION_TYPES.LEAGUE_POST_SLOT_RESCHEDULED,
  NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
  NOTIFICATION_TYPES.LEAGUE_PROPOSAL_DECLINED,
  NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED,
  NOTIFICATION_TYPES.LEAGUE_QUORUM_REACHED,
  NOTIFICATION_TYPES.LEAGUE_QUORUM_REMINDER,
  NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED,
  NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING,
  NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT,
  NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
  NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
  NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
  NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED,
  NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT,
  NOTIFICATION_TYPES.LEAGUE_SEARCH_STARTED,
  NOTIFICATION_TYPES.LEAGUE_SEARCH_STILL_RUNNING,
  NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED,
  NOTIFICATION_TYPES.REMATCH_REQUEST,
]);

const CHAT_ICON_TYPES = new Set([
  NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED,
  NOTIFICATION_TYPES.NEW_CLUB_MESSAGE,
  NOTIFICATION_TYPES.NEW_GROUP_MESSAGE,
  NOTIFICATION_TYPES.NEW_LEAGUE_MATCH_MESSAGE,
  NOTIFICATION_TYPES.NEW_TEAM_MESSAGE,
  NOTIFICATION_TYPES.NEW_WHISPER,
]);

const LICENSE_ICON_TYPES = new Set([
  NOTIFICATION_TYPES.LICENSE_CAMPAIGN_CLOSED,
  NOTIFICATION_TYPES.LICENSE_CAMPAIGN_PAUSED,
  NOTIFICATION_TYPES.LICENSE_CAMPAIGN_PUBLISHED,
  NOTIFICATION_TYPES.LICENSE_DOCUMENT_REPLACEMENT_REQUIRED,
  NOTIFICATION_TYPES.LICENSE_DOCUMENT_SUBMITTED,
  NOTIFICATION_TYPES.LICENSE_INSTALLMENT_OVERDUE,
  NOTIFICATION_TYPES.LICENSE_PAYMENT_CONFIRMED,
  NOTIFICATION_TYPES.LICENSE_PAYMENT_DUE,
  NOTIFICATION_TYPES.LICENSE_PAYMENT_REJECTED,
  NOTIFICATION_TYPES.LICENSE_PAYMENT_REMINDER,
  NOTIFICATION_TYPES.LICENSE_PAYMENT_SUBMITTED,
]);

/**
 * COLL-C3B-BIS (03/10), planche 35 — LA DEMANDE DE CRÉNEAU porte quatre messages sous un seul type
 * serveur : la demande (à la mairie), l'acceptation et le refus (au club), l'installation partagée
 * (au club déjà là). Chacun a SON icône du système de design, sans emoji.
 * @param {Record<string, any> | null | undefined} data - Les données de la notification.
 * @returns {string} calendrier, coche, croix ou stade.
 */
const iconeDUneDemande = (data) => {
  if (data?.audience === 'occupant') return 'stadium';
  if (data?.decision === 'approved') return 'check';
  if (data?.decision === 'refused') return 'close';
  // COLL-S-DEMANDE-PERIMEE (12/10) — personne n'a tranché avant la fin de la séance : l'horloge.
  if (data?.decision === 'expired') return 'clock-two-thirty';
  return 'calendar';
};

/**
 * @param {string | undefined | null} type
 * @param {Record<string, any> | null} [data] - Les données de la notification (COLL-C3B-BIS :
 *   la famille d'une demande de créneau s'y lit).
 * @returns {string} le nom d'une icône de `SvgIcon` (plus d'emoji : décision du 01/10/2026)
 */
export const getNotificationIcon = (type, data = null) => {
  if (type === NOTIFICATION_TYPES.OVERBOOKING_REQUEST) return iconeDUneDemande(data);
  // RESA-L6A (14/10/2026) — la réservation d'un terrain de complexe, côté joueur.
  if (type === NOTIFICATION_TYPES.COMPLEXE_RESERVATION_JOUEUR) return 'stadium';
  if (TEAM_ICON_TYPES.has(type)) return 'users';
  if (CLUB_ICON_TYPES.has(type)) return 'shield';
  if (EVENT_ICON_TYPES.has(type)) return 'calendar';
  if (LEAGUE_ICON_TYPES.has(type)) return 'soccer-ball';
  if (CHAT_ICON_TYPES.has(type)) return 'message-circle';
  if (LICENSE_ICON_TYPES.has(type)) return 'euro-circle';
  if (type === NOTIFICATION_TYPES.SEARCH_ALERT_MATCH) return 'search';
  if (type === COLLECTIVITE_NEWS_TYPE) return 'building-columns';
  return 'bell';
};

/**
 * COLL-C3B-BIS (03/10), planche 35 — la couleur de l'icône : une demande ACCEPTÉE en vert, REFUSÉE
 * en rouge. Toutes les autres notifications gardent l'icône blanche d'avant.
 * @param {string | undefined | null} type
 * @param {Record<string, any> | null} [data] - Les données de la notification.
 * @returns {'succes' | 'refus' | null} Le ton, ou null.
 */
export const getNotificationTone = (type, data = null) => {
  // RESA-L6A (14/10/2026) — la réservation d'un terrain de complexe : acceptée en vert ; refusée,
  // sans réponse, annulée ou fermeture en rouge.
  if (type === NOTIFICATION_TYPES.COMPLEXE_RESERVATION_JOUEUR) {
    if (data?.change === 'acceptee') return 'succes';
    if (['annulee', 'fermeture', 'refusee', 'sans-reponse'].includes(String(data?.change))) {
      return 'refus';
    }
    return null;
  }
  if (type !== NOTIFICATION_TYPES.OVERBOOKING_REQUEST || data?.audience === 'occupant') return null;
  if (data?.decision === 'approved') return 'succes';
  if (data?.decision === 'refused') return 'refus';
  return null;
};

/**
 * @param {string | Date | number | undefined | null} dateInput
 * @returns {string}
 */
export const formatNotificationRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return i18next.t('notificationPresentation.relative.now', 'À l’instant');
  if (diffMins < 60) {
    return i18next.t(
      'notificationPresentation.relative.minutes',
      'Il y a {{value}} min',
      { value: diffMins },
    );
  }
  if (diffHours < 24) {
    return i18next.t(
      'notificationPresentation.relative.hours',
      'Il y a {{value}} h',
      { value: diffHours },
    );
  }
  if (diffDays < 7) {
    return i18next.t(
      'notificationPresentation.relative.days',
      'Il y a {{value}} j',
      { value: diffDays },
    );
  }

  return date.toLocaleDateString(localeDesFormats(), {
    day: '2-digit',
    month: 'short',
  });
};
