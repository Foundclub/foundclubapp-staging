import { NOTIFICATION_TYPES as DOMAIN_NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';

export const NOTIFICATION_TYPES = DOMAIN_NOTIFICATION_TYPES;

/** @type {Record<string, string>} */
export const NOTIFICATION_TYPE_ALIASES = {
  leagueMatchAccepted: NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
  leagueMatchProposalReceived: NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED,
  leagueScoreDue: NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
  leagueVenueToBookReminder: NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED,
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
