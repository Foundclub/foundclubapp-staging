import {
  getMatchDerivedPhase,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';

const CTA_BY_PHASE = {
  cancelled: {
    focusSection: 'timeline',
    helper: 'Ce match est termine. Consultez l historique League pour le detail.',
    primaryCta: 'Voir l historique',
  },
  confirmed_upcoming: {
    focusSection: 'presence',
    helper: 'Le match est confirme. Gerer maintenant la presence et le suivi d equipe.',
    primaryCta: 'Voir le match',
  },
  disputed: {
    focusSection: 'timeline',
    helper: 'Un litige est en cours. Ouvrez la fiche pour consulter les elements du match.',
    primaryCta: 'Saisir le score',
  },
  forfeit: {
    focusSection: 'timeline',
    helper: 'Le match est termine. Consultez l historique League pour le detail.',
    primaryCta: 'Voir l historique',
  },
  no_show: {
    focusSection: 'timeline',
    helper: 'Le match est termine. Consultez l historique League pour le detail.',
    primaryCta: 'Voir l historique',
  },
  pending_validation: {
    focusSection: 'timeline',
    helper: 'Le score adverse a ete soumis. Ouvrez la fiche pour confirmer ou contester.',
    primaryCta: 'Saisir le score',
  },
  post_slot_resolution: {
    focusSection: 'timeline',
    helper: 'Le match a commence sans terrain confirme. Dites si le match a eu lieu.',
    primaryCta: 'Ouvrir le match',
  },
  valid: {
    focusSection: 'timeline',
    helper: 'Le score est valide. Retrouvez le recapitulatif dans l historique League.',
    primaryCta: 'Voir l historique',
  },
  waiting_proposal: {
    focusSection: 'negotiation',
    helper: 'Une proposition League est en cours. Ouvrez la fiche pour negocier ce match.',
    primaryCta: 'Voir la negociation',
  },
  waiting_score: {
    focusSection: 'timeline',
    helper: 'Le match est joue. Ouvrez la fiche pour saisir ou valider le score.',
    primaryCta: 'Saisir le score',
  },
  waiting_venue: {
    focusSection: 'venueBooking',
    helper: 'Le terrain doit maintenant etre confirme dans la fiche match.',
    primaryCta: 'Voir le match',
  },
};

const OWNER_BY_PHASE = {
  confirmed_upcoming: 'either',
  disputed: 'captain',
  pending_validation: 'captain',
  post_slot_resolution: 'captain',
  waiting_proposal: 'captain',
  waiting_score: 'captain',
  waiting_venue: 'captain',
};

/**
 * @param {LeagueMatch | null} match
 * @param {any} [pendingAction]
 * @param {{event?: Record<string, any> | null, isCaptain?: boolean}} [viewerContext]
 */
export const buildLeagueWorkflowViewModel = (match, pendingAction = null, viewerContext = {}) => {
  const phase = String(match?.phase || getMatchDerivedPhase(match, viewerContext?.event || null) || '').trim();
  const workflow = match?.workflow || {};
  const config = CTA_BY_PHASE[phase] || {
    focusSection: 'timeline',
    helper: 'Consultez la fiche match pour suivre l etat League.',
    primaryCta: 'Voir le match',
  };

  return {
    badge: phase,
    focusSection: config.focusSection,
    helper: workflow?.primaryAction === 'open_negotiation' && pendingAction?.proposalMessageId
      ? 'Une proposition League attend votre attention dans la fiche match.'
      : config.helper,
    isBlockingAction: ['waiting_proposal', 'waiting_venue', 'post_slot_resolution', 'waiting_score', 'pending_validation', 'disputed'].includes(phase),
    owner: workflow?.owner || OWNER_BY_PHASE[phase] || 'system',
    phase,
    primaryCta: config.primaryCta,
    secondaryCta: phase === 'waiting_proposal' ? 'Voir la conversation' : null,
    showMaskedOpponent: shouldMaskOpponentIdentity(match, viewerContext?.event || null),
  };
};

export default buildLeagueWorkflowViewModel;
