import {
  getMatchDerivedPhase,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';

/**
 * @type {Record<string, { focusSection: string, helper: string, primaryCta: string }>}
 */
const CTA_BY_PHASE = {
  cancelled: {
    focusSection: 'timeline',
    helper: 'Ce match est terminé. Consulte l historique League pour le detail.',
    primaryCta: 'Voir l historique',
  },
  confirmed_upcoming: {
    focusSection: 'presence',
    helper: 'Le match est confirmé. Gérer maintenant la présence et le suivi d équipe.',
    primaryCta: 'Voir le match',
  },
  disputed: {
    focusSection: 'timeline',
    helper: 'Un litige est en cours. Ouvre la fiche pour consulter les éléments du match.',
    primaryCta: 'Traiter le litige',
  },
  forfeit: {
    focusSection: 'timeline',
    helper: 'Le match est terminé. Consulte l historique League pour le detail.',
    primaryCta: 'Voir l historique',
  },
  no_show: {
    focusSection: 'timeline',
    helper: 'Le match est terminé. Consulte l historique League pour le detail.',
    primaryCta: 'Voir l historique',
  },
  pending_validation: {
    focusSection: 'timeline',
    helper: 'Le score adverse a été soumis. Ouvre la fiche pour confirmer ou contester.',
    primaryCta: 'Valider le score',
  },
  post_slot_resolution: {
    focusSection: 'timeline',
    helper: 'Le match a commence sans terrain confirmé. Dites si le match a eu lieu.',
    primaryCta: 'Le match a-t-il eu lieu ?',
  },
  valid: {
    focusSection: 'timeline',
    helper: 'Le score est validé. Retrouve le récapitulatif dans l historique League.',
    primaryCta: 'Voir l historique',
  },
  waiting_proposal: {
    focusSection: 'negotiation',
    helper: 'Une proposition League est en cours. Ouvre la fiche pour negocier ce match.',
    primaryCta: 'Voir la négociation',
  },
  waiting_score: {
    focusSection: 'timeline',
    helper: 'Le match est joue. Ouvre la fiche pour saisir ou valider le score.',
    primaryCta: 'Saisir le score',
  },
  waiting_venue: {
    focusSection: 'venueBooking',
    helper: 'Le terrain doit maintenant être confirme dans la fiche match.',
    primaryCta: 'Marquer terrain réservé',
  },
};

/**
 * @type {Record<string, string>}
 */
const OWNER_BY_PHASE = {
  confirmed_upcoming: 'either',
  disputed: 'team',
  pending_validation: 'team',
  post_slot_resolution: 'captain',
  waiting_proposal: 'team',
  waiting_score: 'team',
  waiting_venue: 'team',
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
    helper: 'Consulte la fiche match pour suivre l état League.',
    primaryCta: 'Voir le match',
  };

  return {
    badge: phase,
    focusSection: config.focusSection,
    helper: workflow?.primaryAction === 'open_negotiation' && pendingAction?.proposalMessageId
      ? 'Une proposition League attend ton attention dans la fiche match.'
      : config.helper,
    isBlockingAction: ['disputed', 'pending_validation', 'post_slot_resolution', 'waiting_proposal', 'waiting_score', 'waiting_venue'].includes(phase),
    owner: workflow?.owner || OWNER_BY_PHASE[phase] || 'system',
    phase,
    primaryCta: config.primaryCta,
    secondaryCta: phase === 'waiting_proposal' ? 'Voir la conversation' : null,
    showMaskedOpponent: shouldMaskOpponentIdentity(match, viewerContext?.event || null),
  };
};

export default buildLeagueWorkflowViewModel;
