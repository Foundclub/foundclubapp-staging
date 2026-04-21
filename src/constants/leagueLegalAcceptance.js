import { Platform } from 'react-native';

export const LEAGUE_LEGAL_VERSION = 'league-risk-v1-2026-04-21';
export const LEAGUE_LEGAL_TEXT_HASH = '55050747496a7e95a206b758e37612fea02d407a6e608f55399aa51fc40e7369';

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

export const buildLeagueLegalAcceptancePayload = ({
  metadata = {},
  scope,
  sourceScreen,
  targetDocumentId,
  targetType,
} = {}) => ({
  accepted: true,
  consentFlags: {
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
