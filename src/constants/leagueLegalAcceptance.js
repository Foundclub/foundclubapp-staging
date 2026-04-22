import { Platform } from 'react-native';

export const LEAGUE_LEGAL_VERSION = 'league-risk-v2-2026-04-22';
export const LEAGUE_LEGAL_TEXT_HASH = '940176fac04b4e292d6cc2bef04770ddbe6417220a3fede745f420cb6d8d730a';

export const LEAGUE_LEGAL_SCOPES = Object.freeze({
  GLOBAL: 'league_global',
  MATCH_CAPTAIN_ACCEPTANCE: 'league_match_captain_acceptance',
  MATCH_CAPTAIN_PROPOSAL: 'league_match_captain_proposal',
  MATCH_PLAYER_PARTICIPATION: 'league_match_player_participation',
  MATCH_VENUE_BOOKING: 'league_match_venue_booking',
  TEAM_CREATE: 'league_team_create',
  TEAM_INVITATION_ACCEPT: 'league_team_invitation_accept',
  TEAM_JOIN_REQUEST: 'league_team_join_request',
});

export const LEAGUE_ADULT_REQUIRED_SCOPES = Object.freeze([
  LEAGUE_LEGAL_SCOPES.TEAM_CREATE,
  LEAGUE_LEGAL_SCOPES.TEAM_INVITATION_ACCEPT,
  LEAGUE_LEGAL_SCOPES.TEAM_JOIN_REQUEST,
]);

export const buildLeagueLegalAcceptancePayload = ({
  metadata = {},
  scope,
  sourceScreen,
  targetDocumentId,
  targetType,
} = {}) => ({
  accepted: true,
  consentFlags: {
    adultAgeConfirmation: LEAGUE_ADULT_REQUIRED_SCOPES.includes(scope),
    captainResponsibility: [
      LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
      LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
    ].includes(scope),
    insuranceAwareness: true,
    nonOrganizer: true,
    riskAcceptance: true,
    rulesAwareness: true,
    venueResponsibility: scope === LEAGUE_LEGAL_SCOPES.MATCH_VENUE_BOOKING,
  },
  devicePlatform: Platform.OS,
  legalTextHash: LEAGUE_LEGAL_TEXT_HASH,
  legalVersion: LEAGUE_LEGAL_VERSION,
  locale: 'fr-FR',
  metadata,
  scope,
  sourceScreen,
  targetDocumentId: targetDocumentId || null,
  targetType: targetType || null,
});
