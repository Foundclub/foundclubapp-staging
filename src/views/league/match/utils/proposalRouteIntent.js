import { getMatchDerivedPhase } from './matchStatus';

/**
 * Proposal route intents should only reopen the proposal workflow while the
 * match is still in the negotiation phase.
 * @param {LeagueMatch | null | undefined} match
 * @returns {boolean}
 */
export const canOpenProposalRouteForMatch = (match) => (
  getMatchDerivedPhase(match || null) === 'waiting_proposal'
);

export default canOpenProposalRouteForMatch;
