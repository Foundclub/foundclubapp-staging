import i18next from 'i18next';

import {
  getMatchDerivedPhase,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';

/**
 * Les actions par phase : une fonction, pour que la langue soit lue a l'appel.
 * @returns {Record<string, { focusSection: string, helper: string, primaryCta: string }>}
 */
const ctaByPhase = () => ({
  cancelled: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.cancelled',
      'Ce match est terminé. Consulte l historique League pour le detail.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewHistory', 'Voir l historique'),
  },
  confirmed_upcoming: {
    focusSection: 'presence',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.confirmedUpcoming',
      'Le match est confirmé. Gérer maintenant la présence et le suivi d équipe.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewMatch', 'Voir le match'),
  },
  disputed: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.disputed',
      'Un litige est en cours. Ouvre la fiche pour consulter les éléments du match.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.handleDispute', 'Traiter le litige'),
  },
  forfeit: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.finished',
      'Le match est terminé. Consulte l historique League pour le detail.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewHistory', 'Voir l historique'),
  },
  no_show: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.finished',
      'Le match est terminé. Consulte l historique League pour le detail.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewHistory', 'Voir l historique'),
  },
  pending_validation: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.pendingValidation',
      'Le score adverse a été soumis. Ouvre la fiche pour confirmer ou contester.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.validateScore', 'Valider le score'),
  },
  post_slot_resolution: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.postSlotResolution',
      'Le match a commence sans terrain confirmé. Dites si le match a eu lieu.',
    ),
    primaryCta: i18next.t(
      'leagueWorkflowPresenter.cta.didMatchHappen',
      'Le match a-t-il eu lieu ?',
    ),
  },
  valid: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.valid',
      'Le score est validé. Retrouve le récapitulatif dans l historique League.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewHistory', 'Voir l historique'),
  },
  waiting_proposal: {
    focusSection: 'negotiation',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.waitingProposal',
      'Une proposition League est en cours. Ouvre la fiche pour negocier ce match.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewNegotiation', 'Voir la négociation'),
  },
  waiting_score: {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.waitingScore',
      'Le match est joue. Ouvre la fiche pour saisir ou valider le score.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.enterScore', 'Saisir le score'),
  },
  waiting_venue: {
    focusSection: 'venueBooking',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.waitingVenue',
      'Le terrain doit maintenant être confirme dans la fiche match.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.markVenueBooked', 'Marquer terrain réservé'),
  },
});

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
  const config = ctaByPhase()[phase] || {
    focusSection: 'timeline',
    helper: i18next.t(
      'leagueWorkflowPresenter.helpers.default',
      'Consulte la fiche match pour suivre l état League.',
    ),
    primaryCta: i18next.t('leagueWorkflowPresenter.cta.viewMatch', 'Voir le match'),
  };

  return {
    badge: phase,
    focusSection: config.focusSection,
    helper: workflow?.primaryAction === 'open_negotiation' && pendingAction?.proposalMessageId
      ? i18next.t(
        'leagueWorkflowPresenter.helpers.pendingProposal',
        'Une proposition League attend ton attention dans la fiche match.',
      )
      : config.helper,
    isBlockingAction: ['disputed', 'pending_validation', 'post_slot_resolution', 'waiting_proposal', 'waiting_score', 'waiting_venue'].includes(phase),
    owner: workflow?.owner || OWNER_BY_PHASE[phase] || 'system',
    phase,
    primaryCta: config.primaryCta,
    secondaryCta: phase === 'waiting_proposal' ? i18next.t(
      'leagueWorkflowPresenter.cta.viewConversation',
      'Voir la conversation',
    ) : null,
    showMaskedOpponent: shouldMaskOpponentIdentity(match, viewerContext?.event || null),
  };
};

export default buildLeagueWorkflowViewModel;
