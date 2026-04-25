import { getSubmissionScoreLabel } from '@/utils/leagueScoreDetails';

import {
  getMatchDerivedPhase,
  getMatchStartDate,
  isScoreWindowOpen,
  isVenueBookedForMatch,
  normalizeMatchStatus,
} from './matchStatus';

const HOURS = 60 * 60 * 1000;
const SCORE_DEADLINE_HOURS = 48;

const ensureObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

export const hasScoreSubmission = (submission) => {
  const value = ensureObject(submission);
  return (
    value.score_a !== undefined
    || value.score_b !== undefined
    || value.score_details !== undefined
    || value.submittedAt !== undefined
  );
};

const parseScore = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toIso = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const getScoreDeadlineAt = (match) => {
  const start = getMatchStartDate(match);
  if (!start) return null;
  return new Date(start.getTime() + (SCORE_DEADLINE_HOURS * HOURS));
};

const getUnlockAt = (match) => {
  const start = getMatchStartDate(match);
  if (!start) return null;
  return new Date(start.getTime() + (60 * 1000));
};

const formatSubmission = (submission, side) => {
  if (!hasScoreSubmission(submission)) return null;
  const value = ensureObject(submission);
  return {
    dispute: value.dispute === true || String(value.dispute || '').toLowerCase() === 'true',
    disputeComment: value.dispute_comment || value.disputeComment || null,
    disputeType: value.dispute_type || value.disputeType || null,
    scoreA: parseScore(value.score_a),
    scoreB: parseScore(value.score_b),
    scoreDetails: value.score_details || value.scoreDetails || null,
    scoreLabel: getSubmissionScoreLabel(value),
    side,
    submittedAt: toIso(value.submittedAt || value.submitted_at),
  };
};

const getPrimaryCta = (state, isCaptain) => {
  if (!isCaptain) return null;
  if (state === 'ready_to_submit') return { label: 'Saisir le score' };
  if (state === 'opponent_score_pending') return { label: 'Valider le score adverse' };
  if (state === 'submitted_waiting_opponent' || state === 'auto_validation_pending') {
    return { label: 'Score saisi' };
  }
  if (state === 'disputed' || state === 'admin_resolution') {
    return { label: 'Traiter le litige' };
  }
  if (state === 'locked_before_start') return { label: 'Score verrouillé' };
  if (state === 'locked_no_venue') return { label: 'Confirmer le terrain' };
  if (state === 'valid') return { label: 'Résultat validé' };
  return null;
};

export const buildLocalScoreFlow = (match, options = {}) => {
  const backendFlow = ensureObject(match?.scoreFlow);
  const status = normalizeMatchStatus(match?.status);
  const phase = getMatchDerivedPhase(match);
  const isCaptainA = Boolean(options.isCaptainA);
  const isCaptainB = Boolean(options.isCaptainB);
  const isCaptain = isCaptainA || isCaptainB || Boolean(options.isCaptain);

  let viewerSide = options.teamSide || null;
  if (isCaptainA) viewerSide = 'a';
  if (isCaptainB) viewerSide = 'b';

  let ownSubmission = null;
  if (viewerSide === 'a') {
    ownSubmission = formatSubmission(match?.submitted_score_team_a, 'a');
  } else if (viewerSide === 'b') {
    ownSubmission = formatSubmission(match?.submitted_score_team_b, 'b');
  }

  let opponentSide = null;
  if (viewerSide === 'a') {
    opponentSide = 'b';
  } else if (viewerSide === 'b') {
    opponentSide = 'a';
  }

  let opponentSubmission = null;
  if (opponentSide === 'a') {
    opponentSubmission = formatSubmission(match?.submitted_score_team_a, 'a');
  } else if (opponentSide === 'b') {
    opponentSubmission = formatSubmission(match?.submitted_score_team_b, 'b');
  }

  const submissionA = formatSubmission(match?.submitted_score_team_a, 'a');
  const submissionB = formatSubmission(match?.submitted_score_team_b, 'b');
  const deadlineAt = getScoreDeadlineAt(match);
  const remainingSeconds = deadlineAt
    ? Math.max(0, Math.ceil((deadlineAt.getTime() - Date.now()) / 1000))
    : null;
  const postSlotResolution = String(
    match?.automation_meta?.post_slot_resolution?.resolution || '',
  ).toLowerCase();
  const venueValidated = isVenueBookedForMatch(match) || postSlotResolution === 'score_flow';
  const scoreWindowOpen = isScoreWindowOpen(match);

  let state = backendFlow.state || 'locked_no_venue';
  if (status === 'valid') {
    state = 'valid';
  } else if (status === 'disputed') {
    state = match?.automation_meta?.score_admin_escalated_at
      ? 'admin_resolution'
      : 'disputed';
  } else if (status === 'pending_validation') {
    if (opponentSubmission && !ownSubmission) {
      state = 'opponent_score_pending';
    } else if (ownSubmission && !opponentSubmission) {
      state = 'submitted_waiting_opponent';
    } else {
      state = 'auto_validation_pending';
    }
  } else if (phase === 'waiting_score') {
    state = 'ready_to_submit';
  } else if (status === 'scheduled' && venueValidated && !scoreWindowOpen) {
    state = 'locked_before_start';
  } else if (status === 'scheduled' && !venueValidated) {
    state = 'locked_no_venue';
  }

  return {
    ...backendFlow,
    actionRequired: isCaptain
      && ['admin_resolution', 'disputed', 'opponent_score_pending', 'ready_to_submit'].includes(state),
    autoValidationAt:
      backendFlow.autoValidationAt
      || (
        status === 'pending_validation'
        || ['submitted_waiting_opponent', 'opponent_score_pending', 'auto_validation_pending'].includes(state)
          ? toIso(deadlineAt)
          : null
      ),
    canDispute: isCaptain
      && ['admin_resolution', 'disputed', 'opponent_score_pending'].includes(state),
    canSubmit: isCaptain
      && [
        'admin_resolution',
        'disputed',
        'opponent_score_pending',
        'ready_to_submit',
        'submitted_waiting_opponent',
      ].includes(state),
    canValidate: isCaptain && state === 'opponent_score_pending',
    deadlineAt: backendFlow.deadlineAt || toIso(deadlineAt),
    isCaptain,
    mySubmission: ownSubmission,
    opponentSubmission,
    phase,
    primaryCta: backendFlow.primaryCta || getPrimaryCta(state, isCaptain),
    remainingSeconds,
    scoreWindowOpen,
    state,
    status,
    submissions: {
      teamA: submissionA,
      teamB: submissionB,
    },
    unlockAt: backendFlow.unlockAt || toIso(getUnlockAt(match)),
    venueValidated,
  };
};

export const formatScoreFlowCountdown = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "moins d'une minute";
  const hours = Math.floor(value / 3600);
  const minutes = Math.ceil((value % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}j${remainingHours ? ` ${remainingHours}h` : ''}`;
  }
  if (hours > 0) return `${hours}h${minutes ? ` ${minutes}min` : ''}`;
  return `${minutes}min`;
};
