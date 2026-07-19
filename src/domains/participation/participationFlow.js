import { USER_ROLES } from '@/domains/auth/authUseCases';
import {
  normalizeEventTypeLabel,
  resolveTrainingOpenConfig,
} from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';

export const ParticipationFlowKind = Object.freeze({
  detectionSlot: 'detection-slot',
  eventClosed: 'event-closed',
  eventOpen: 'event-open',
  eventStageDayRedirect: 'event-stage-day-redirect',
  recruitmentCoach: 'recruitment-ad-coach',
  recruitmentPlayer: 'recruitment-ad-player',
  reservationRecruiting: 'reservation-recruiting',
});

const getUserDocumentId = (user) => String(user?.documentId || '').trim();

const getTeamBuckets = (event) => [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])]
  .filter(Boolean);

const getEntityIdentifiers = (entity) => [
  entity?.documentId,
  entity?.id,
]
  .map((value) => String(value || '').trim())
  .filter(Boolean);

const getUserTeamBuckets = (user) => [
  ...(Array.isArray(user?.myTeams) ? user.myTeams : []),
  ...(Array.isArray(user?.trainedTeams) ? user.trainedTeams : []),
  ...(Array.isArray(user?.teams) ? user.teams : []),
  user?.team,
].filter(Boolean);

const isFutureDatedEntity = (entity) => {
  if (!entity?.date) return true;
  const timestamp = new Date(entity.date).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export const isReservationParticipationEntity = (entity) => {
  const typeLabel = normalizeEventTypeLabel(entity?.type?.name);
  if (typeLabel) {
    return typeLabel.includes('reservation');
  }

  const reservationMode = String(entity?.reservationMode || '').trim().toUpperCase();
  const bookingStatus = String(entity?.bookingStatus || '').trim().toLowerCase();
  return ['FULL_GROUP', 'RECRUITING'].includes(reservationMode)
    && ['booked', 'cancelled', 'open', 'shared'].includes(bookingStatus);
};

export const resolveClientSourceTeamForUser = (event, user) => {
  const userDocumentId = getUserDocumentId(user);
  if (!userDocumentId) return null;
  const userTeamIds = new Set(getUserTeamBuckets(user).flatMap(getEntityIdentifiers));

  return getTeamBuckets(event).find((team) => (
    (
      Array.isArray(team?.players)
      && team.players.some((player) => String(player?.documentId || '').trim() === userDocumentId)
    )
    || getEntityIdentifiers(team).some((teamId) => userTeamIds.has(teamId))
  )) || null;
};

const buildReservationFlow = (entity, context) => {
  const user = context?.user;
  const participationState = context?.participationState
    || getCurrentUserEventParticipationState({
      missings: entity?.missings,
      participationRequests: entity?.participationRequests,
      participations: entity?.participations,
      user,
    });
  const alreadyHandled = Boolean(
    participationState?.isParticipating
    || participationState?.hasAcceptedRequest
    || participationState?.hasPendingRequest,
  );
  const missingPlayers = Number(entity?.missingPlayers || 0);
  const isRecruiting = String(entity?.reservationMode || '').trim().toUpperCase() === 'RECRUITING';
  const isShared = String(entity?.bookingStatus || '').trim().toLowerCase() === 'shared' || isRecruiting;
  const isPlayer = user?.role?.name === USER_ROLES.player;

  let blockedReason = '';
  if (!isPlayer) {
    blockedReason = 'Seuls les joueurs peuvent rejoindre cette réservation.';
  } else if (alreadyHandled) {
    blockedReason = 'Tu participes déjà à cette réservation.';
  } else if (!isFutureDatedEntity(entity)) {
    blockedReason = 'Cette réservation est déjà passee.';
  } else if (!isRecruiting || !isShared) {
    blockedReason = 'Cette réservation n accepte pas de nouveaux joueurs.';
  } else if (missingPlayers <= 0) {
    blockedReason = 'Cette réservation est déjà complété.';
  }

  return {
    actionLabel: 'Reserver',
    blockedReason,
    canAct: !blockedReason,
    confirmLabel: 'Reserver',
    kind: ParticipationFlowKind.reservationRecruiting,
    submitMode: 'joinReservation',
    usesConfirmationModal: true,
  };
};

const buildEventFlow = (entity, context) => {
  const user = context?.user;
  const userDocumentId = getUserDocumentId(user);
  const participationState = context?.participationState
    || getCurrentUserEventParticipationState({
      missings: entity?.missings,
      participationRequests: entity?.participationRequests,
      participations: entity?.participations,
      user,
    });
  const detectionSlotsCount = Number(context?.detectionSlotsCount || 0);
  const alreadyHandled = Boolean(
    participationState?.isParticipating
    || participationState?.hasAcceptedRequest
    || participationState?.hasPendingRequest,
  );
  const isPlayer = user?.role?.name === USER_ROLES.player;

  if (String(entity?.eventFormat || '').trim().toLowerCase() === 'stage_day' && entity?.parentEvent?.documentId) {
    return {
      actionLabel: 'Voir le stage principal',
      blockedReason: '',
      canAct: true,
      confirmLabel: '',
      kind: ParticipationFlowKind.eventStageDayRedirect,
      submitMode: 'redirect-parent',
      usesConfirmationModal: false,
    };
  }

  if (detectionSlotsCount > 0) {
    return {
      actionLabel: 'Participer',
      blockedReason: isPlayer ? '' : 'Seuls les joueurs peuvent candidater à cette détection.',
      canAct: isPlayer && !alreadyHandled,
      confirmLabel: 'Participer',
      kind: ParticipationFlowKind.detectionSlot,
      submitMode: 'detection-slot-picker',
      usesConfirmationModal: false,
    };
  }

  const sessionStatus = normalizeStatus(entity?.sessionStatus);
  const isClosed = sessionStatus === 'closed';
  const isDetection = normalizeEventTypeLabel(entity?.type?.name).includes('detection');
  const sourceTeam = resolveClientSourceTeamForUser(entity, user);
  const trainingOpenConfig = resolveTrainingOpenConfig(entity);
  const isTrainingEvent = trainingOpenConfig?.isTraining === true;
  const isExternalTrainingParticipant = isTrainingEvent && !sourceTeam;
  const capacity = Number(entity?.capacity || 0);
  const participationsCount = Array.isArray(entity?.participations) ? entity.participations.length : 0;
  const externalParticipationRequests = Array.isArray(entity?.participationRequests)
    ? entity.participationRequests.filter((request) => (
      request?.isActive !== false
      && ['accepted', 'pending'].includes(String(request?.participationStatus || '').trim().toLowerCase())
      && !request?.sourceTeam
    ))
    : [];
  const externalActiveRequestsCount = isExternalTrainingParticipant
    ? externalParticipationRequests.length
    : 0;

  let blockedReason = '';
  if (!isPlayer) {
    blockedReason = 'Seuls les joueurs peuvent participer à cet événement.';
  } else if (alreadyHandled) {
    blockedReason = 'Tu as déjà répondu à cet événement.';
  } else if (!isFutureDatedEntity(entity) && !entity?.league_match) {
    blockedReason = 'Cet événement est déjà passe.';
  } else if (isClosed && !sourceTeam) {
    blockedReason = 'Cet événement fermé est réservé aux équipes concernées.';
  } else if (
    isExternalTrainingParticipant
    && Number(trainingOpenConfig?.externalParticipantLimit || 0) < 1
  ) {
    blockedReason = 'Cet entraînement n accepte pas de joueurs externes pour le moment.';
  } else if (
    isExternalTrainingParticipant
    && Number(trainingOpenConfig?.externalParticipantLimit || 0) > 0
    && externalActiveRequestsCount >= Number(trainingOpenConfig?.externalParticipantLimit || 0)
  ) {
    blockedReason = 'Le quota de joueurs externes pour cet entraînement est déjà atteint.';
  } else if (!isTrainingEvent && capacity > 0 && participationsCount >= capacity) {
    blockedReason = 'Cet événement est complet.';
  } else if (
    userDocumentId
    && Array.isArray(entity?.participations)
    && entity.participations.some((participant) => String(participant?.documentId || '').trim() === userDocumentId)
  ) {
    blockedReason = 'Tu participes déjà à cet événement.';
  }

  let actionLabel = isClosed ? 'Present' : 'Participer';
  let confirmLabel = isClosed ? 'Confirmer ma présence' : 'Participer';
  if (isDetection) {
    actionLabel = 'Participer';
    confirmLabel = 'Confirmer ma participation';
  }

  return {
    actionLabel,
    blockedReason,
    canAct: !blockedReason,
    confirmLabel,
    kind: isClosed ? ParticipationFlowKind.eventClosed : ParticipationFlowKind.eventOpen,
    submitMode: 'createEventParticipation',
    usesConfirmationModal: true,
  };
};

const buildRecruitmentFlow = (entity, context) => {
  const audienceType = String(entity?.audienceType || '').trim().toLowerCase() === 'coach' ? 'coach' : 'player';
  const normalizedStatus = normalizeStatus(context?.applicationState?.status);
  const isDetectionLinked = normalizeEventTypeLabel(entity?.event?.type?.name).includes('detection');
  const isOwner = Boolean(context?.isOwner);
  const canWithdraw = Boolean(
    !isOwner
    && !isDetectionLinked
    && context?.currentUserApplication?.documentId
    && ['accepted', 'pending'].includes(normalizedStatus),
  );

  let blockedReason = '';
  if (isOwner) {
    blockedReason = 'Tu ne peux pas candidater à ta propre annonce.';
  } else if (!entity?.isActive) {
    blockedReason = 'Cette annonce n est plus active.';
  } else if (normalizedStatus === 'accepted') {
    blockedReason = isDetectionLinked
      ? 'Tu participes déjà à cette détection.'
      : 'Ta candidature est déjà validée.';
  } else if (normalizedStatus === 'pending') {
    blockedReason = isDetectionLinked
      ? 'Tu as déjà une candidature en attente sur cette détection.'
      : 'Ta candidature est déjà en attente.';
  }

  let kind = ParticipationFlowKind.recruitmentPlayer;
  if (isDetectionLinked) {
    kind = ParticipationFlowKind.detectionSlot;
  } else if (audienceType === 'coach') {
    kind = ParticipationFlowKind.recruitmentCoach;
  }

  return {
    actionLabel: audienceType === 'coach' ? 'Candidater comme entraîneur' : 'Postuler',
    blockedReason,
    canAct: !blockedReason,
    canWithdraw,
    confirmLabel: audienceType === 'coach' ? 'Envoyer ma candidature' : 'Confirmer ma candidature',
    kind,
    submitMode: 'applyToRecruitmentAd',
    usesConfirmationModal: false,
  };
};

/**
 * Resolve the participation flow for events, reservations and recruitment ads.
 * @param {any} entity
 * @param {{
 *   entityType?: 'event' | 'recruitment-ad';
 *   currentUserApplication?: any;
 *   detectionSlotsCount?: number;
 *   isOwner?: boolean;
 *   participationState?: ReturnType<typeof getCurrentUserEventParticipationState>;
 *   applicationState?: { status?: string | null };
 *   user?: any;
 * }} [context]
 */
export const resolveParticipationFlow = (entity, context = {}) => {
  if (!entity || typeof entity !== 'object') {
    return {
      actionLabel: 'Participer',
      blockedReason: 'Contenu indisponible.',
      canAct: false,
      confirmLabel: 'Confirmer',
      kind: ParticipationFlowKind.eventOpen,
      submitMode: 'createEventParticipation',
      usesConfirmationModal: false,
    };
  }

  if (context?.entityType === 'recruitment-ad') {
    return buildRecruitmentFlow(entity, context);
  }

  if (isReservationParticipationEntity(entity)) {
    return buildReservationFlow(entity, context);
  }

  return buildEventFlow(entity, context);
};

export const getParticipationErrorMessage = (error, fallback = 'Action impossible pour le moment.') => String(
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.message
  || fallback,
).trim() || fallback;
