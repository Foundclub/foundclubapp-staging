import { NOTIFICATION_TYPES as DOMAIN_NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';

export const NOTIFICATION_TYPES = DOMAIN_NOTIFICATION_TYPES;

/**
 * 🕳️ NOTIF2 / D2 — LE CIMETIERE DES TYPES RETIRES, ET IL SERT VRAIMENT.
 *
 * Cinq types etaient declares des deux cotes avec un texte, et n etaient emis
 * par AUCUN code serveur : ils faisaient croire a une couverture qui n existait
 * pas. Le serveur ne les declare plus, et l app non plus — mais des
 * notifications DEJA rangees dans la liste d un utilisateur (ou deja posees sur
 * son telephone) portent encore ces etiquettes. Elles arrivent ici et repartent
 * sous le nom de la notification VIVANTE qui couvre le meme fait, donc elles
 * gardent leur icone, leur destination et leur celebration.
 *
 * ⚠️ `RSVP_ALERT` n est PAS ici : il est mort lui aussi, mais AUCUNE
 * notification vivante ne previent un capitaine qu un joueur vient de se rendre
 * disponible sur un creneau. Il reste declare tant que ce trou n est pas comble.
 * @type {Record<string, string>}
 */
export const NOTIFICATION_TYPE_ALIASES = {
  eventCreated: NOTIFICATION_TYPES.EVENT_PUBLISHED,
  leagueMatchAccepted: NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
  leagueMatchProposalReceived: NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED,
  leagueScoreDue: NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
  leagueScoreSubmittedByOpponent: NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED,
  leagueVenueToBookReminder: NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED,
  MATCH_FOUND: NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND,
  newTeamPlayerMessage: NOTIFICATION_TYPES.NEW_TEAM_MESSAGE,
};

/**
 * @param {unknown} value
 * @returns {string}
 */
export const normalizeNotificationType = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  const alias = NOTIFICATION_TYPE_ALIASES[normalized];
  return alias || normalized;
};
