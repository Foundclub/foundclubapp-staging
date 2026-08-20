import { USER_ROLES } from '@/domains/auth/authUseCases';
import {
  normalizeEventTypeLabel,
  resolveTrainingOpenConfig,
} from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';

import { getApiErrorTranslation } from '@/utils/errors/displayError';

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

/**
 * Les membres d une equipe : ses joueurs ET ses encadrants.
 *
 * W01 — copie fidele de `getTeamMembers` cote serveur (`event-audience.ts:253`),
 * que `resolveSourceTeamForUser` consulte depuis le lot U02. Ne lire que
 * `players` ecartait de sa propre equipe l encadrant qui n y est pas inscrit
 * comme joueur — a commencer par le createur de l equipe.
 * @param {any} team
 * @returns {any[]} Joueurs et encadrants, dans cet ordre.
 */
const getTeamMemberEntities = (team) => [
  ...(Array.isArray(team?.players) ? team.players : []),
  ...(Array.isArray(team?.trainers) ? team.trainers : []),
];

export const resolveClientSourceTeamForUser = (event, user) => {
  const userDocumentId = getUserDocumentId(user);
  if (!userDocumentId) return null;
  const userTeamIds = new Set(getUserTeamBuckets(user).flatMap(getEntityIdentifiers));

  return getTeamBuckets(event).find((team) => (
    getTeamMemberEntities(team)
      .some((member) => String(member?.documentId || '').trim() === userDocumentId)
    || getEntityIdentifiers(team).some((teamId) => userTeamIds.has(teamId))
  )) || null;
};

/**
 * « Cette personne doit-elle repondre Present / Absent ? »
 *
 * Y07 (GO Adel du 2026-08-20) — le miroir EXACT de `resolveResponderDecision`
 * cote serveur (`event-audience.ts:819`) : seuls les JOUEURS repondent.
 *
 * ⛔ `getTeamMemberEntities` ci-dessus ne bouge PAS : etre MEMBRE (voir
 * l evenement, en recevoir les notifications, rester rattache a son equipe) et
 * devoir REPONDRE sont deux questions differentes. Y07 ne ferme que la seconde.
 *
 * Le serveur DIT deja la reponse sur la fiche (`viewerCanRespond`, pose par
 * `event.findOne`) : quand il l a dite, on lui obeit au lieu de recalculer. Les
 * listes et le planning ne portent pas encore ce drapeau, d ou le repli — qui
 * est la MEME regle, ecrite une seule fois, ici.
 * @param {any} event
 * @param {any} user
 * @returns {{ isStaffOnly: boolean, sourceTeam: any }} `isStaffOnly` vrai veut
 *   dire une chose et une seule : membre d une equipe conviee, mais pas joueur.
 */
export const resolveClientResponderDecision = (event, user) => {
  const sourceTeam = resolveClientSourceTeamForUser(event, user);

  if (typeof event?.viewerCanRespond === 'boolean') {
    return { isStaffOnly: event.viewerCanRespond === false, sourceTeam };
  }

  if (!sourceTeam) return { isStaffOnly: false, sourceTeam: null };

  const userDocumentId = getUserDocumentId(user);
  const isListedIn = (collection) => (Array.isArray(collection) ? collection : [])
    .some((member) => String(member?.documentId || '').trim() === userDocumentId);
  const sourceTeamIds = getEntityIdentifiers(sourceTeam);
  const ownsSourceTeamIn = (bucket) => (Array.isArray(bucket) ? bucket : [])
    .flatMap(getEntityIdentifiers)
    .some((teamId) => sourceTeamIds.includes(teamId));

  // JOUEUSE — les deux faces de la MEME relation Strapi : `team.players` est
  // declare `inversedBy: 'myTeams'` (`admin/src/api/team/.../schema.json`).
  // Lire le profil n est donc pas une approximation, c est le meme fait vu de
  // l autre bout — et c est le SEUL bout disponible sur les listes.
  // 🎯 Teste EN PREMIER : le coach-joueur figure dans les deux, il repond.
  if (isListedIn(sourceTeam?.players) || ownsSourceTeamIn(user?.myTeams)) {
    return { isStaffOnly: false, sourceTeam };
  }

  // ENCADRANTE — l autre relation (`team.trainers` inversedBy `trainedTeams`).
  if (isListedIn(sourceTeam?.trainers) || ownsSourceTeamIn(user?.trainedTeams)) {
    return { isStaffOnly: true, sourceTeam };
  }

  // ⛔ AUCUNE PREUVE : on ne fait PAS taire la personne. Ne lire que
  // `sourceTeam.players` faisait dire « tu encadres » a TOUS LES JOUEURS des
  // que la charge utile ne portait pas la liste — or le peuplement des cartes
  // (`buildCompactEventCardPopulate`, `eventService.js:674`) ne descend NI
  // `players` NI `trainers`, et `viewerCanRespond` n existe que sur la fiche
  // (`event.ts:1695`). Toutes les listes tombaient donc dans ce trou.
  // La porte qui tranche vraiment reste le serveur (`assertUserCanRespond`).
  return { isStaffOnly: false, sourceTeam };
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
  const bookingLabel = String(entity?.bookingStatus || '').trim().toLowerCase();
  const isShared = bookingLabel === 'shared' || isRecruiting;
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
  // Y07 : la MEME lecture rend l equipe source ET « doit-elle repondre ? ».
  const { isStaffOnly, sourceTeam } = resolveClientResponderDecision(entity, user);
  const trainingOpenConfig = resolveTrainingOpenConfig(entity);
  const isTrainingEvent = trainingOpenConfig?.isTraining === true;
  const isExternalTrainingParticipant = isTrainingEvent && !sourceTeam;
  const capacity = Number(entity?.capacity || 0);
  const participationsCount = Array.isArray(entity?.participations)
    ? entity.participations.length
    : 0;
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

  // W01 — CE QUI OUVRE LE DROIT DE REPONDRE, C EST L APPARTENANCE, PAS LE ROLE.
  //
  // Le serveur ne lit `user.role.name` NULLE PART sur ce chemin : il demande
  // `resolveSourceTeamForUser` (`event-audience.ts:612`), c est-a-dire « figure
  // dans `players` ou dans `trainers` d une equipe conviee ». Depuis le lot U02
  // il accepte donc la reponse d un entraineur ou d un dirigeant membre — et
  // l app, elle, continuait a griser son bouton sur le seul intitule du compte.
  //
  // 🔒 Un encadrant ETRANGER a toutes les equipes conviees reste bloque : sans
  // equipe source, la porte suivante le refuse, exactement comme le serveur.
  const isConvenedMember = Boolean(sourceTeam);

  let blockedReason = '';
  // Le motif de l evenement ferme passe AVANT celui du role : c est la phrase
  // que le serveur renverrait (`EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR`), et un
  // non-membre doit lire pourquoi il est dehors, pas ce qu il est.
  if (isClosed && !sourceTeam) {
    blockedReason = 'Cet événement fermé est réservé aux équipes concernées.';
  } else if (isStaffOnly && !alreadyHandled) {
    // Y07 : la phrase que le serveur renverrait (`EVENT_STAFF_DOES_NOT_RSVP`).
    // ⛔ Elle ne doit JAMAIS accompagner un bouton eteint : les surfaces qui
    // montent la rangee de reponse rendent la phrase SEULE (voir
    // `EventAnswerButtons`). Elle vit ici pour que le motif soit dit au meme
    // endroit que tous les autres, pas pour griser quoi que ce soit.
    // 🔒 `&& !alreadyHandled` : une reponse DEJA ENREGISTREE garde son motif
    // (« tu as deja repondu »), comme `hasOwnAnswer` cote `EventAnswerButtons`.
    // Y07 retire le droit de repondre, il n efface aucune reponse posee avant
    // lui — un encadrant coche dans la compo publiee a repondu, ca reste vrai.
    blockedReason = 'Tu encadres cet événement : ce sont les joueurs qui répondent.';
  } else if (!isPlayer && !isConvenedMember) {
    blockedReason = 'Seuls les joueurs peuvent participer à cet événement.';
  } else if (alreadyHandled) {
    blockedReason = 'Tu as déjà répondu à cet événement.';
  } else if (!isFutureDatedEntity(entity) && !entity?.league_match) {
    blockedReason = 'Cet événement est déjà passe.';
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

  // AA01 (constat d Adel du 2026-08-20) — REPONDRE A SON EQUIPE N EST PAS
  // DEMANDER A ENTRER.
  //
  // Un membre d une equipe conviee ne demande rien : il repond a une
  // convocation. Sa reponse passe donc par la porte des REPONSES
  // (`POST /events/:id/rsvp`), en UN geste, sans declaration de responsabilite —
  // exactement ce que le bandeau de l accueil fait deja (`useHomeEventAnswer.js`,
  // lot T02). `POST /event-participations`, lui, est la porte des DEMANDES : sur
  // un evenement a validation manuelle il rendait la reponse « en attente », et
  // « en attente » n entre ni dans `participations` ni dans `missings` cote
  // serveur — a l ecran, « sans reponse ».
  //
  // 🔒 CE QUI GARDE LA DECHARGE, ET POURQUOI : tout le reste. Une DETECTION est
  // nommee ici. Un evenement public et une seance d essai (joueur externe a un
  // entrainement) n ont pas d equipe source, donc `isConvenedMember` y est deja
  // faux. La declaration de responsabilite y est une protection juridique, pas
  // une formalite : elle ne bouge pas.
  const answersAsConvenedMember = isConvenedMember && !isDetection;

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
    submitMode: answersAsConvenedMember ? 'rsvpPresent' : 'createEventParticipation',
    usesConfirmationModal: !answersAsConvenedMember,
  };
};

const buildRecruitmentFlow = (entity, context) => {
  const audienceType = String(entity?.audienceType || '').trim().toLowerCase() === 'coach' ? 'coach' : 'player';
  const normalizedStatus = normalizeStatus(context?.applicationState?.status);
  const isDetectionLinked = normalizeEventTypeLabel(entity?.event?.type?.name)
    .includes('detection');
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

const DEFAULT_PARTICIPATION_ERROR = 'Action impossible pour le moment.';

/**
 * Message montre au joueur quand le serveur REFUSE sa reponse a un evenement.
 *
 * Contrat : le code machine traduit gagne, sinon le repli francais de l'appelant.
 * La phrase brute du serveur — anglaise — n'est JAMAIS rendue. C'est la seule
 * difference avec `getErrorMessage`, qui la laisse passer quand `__DEV__` est
 * vrai pour aider le developpeur : ici l'ecran est celui du joueur, y compris en
 * recette sur emulateur, ou `__DEV__` vaut justement vrai.
 *
 * L'ancienne version lisait `error.response.data.…` : l'intercepteur axios
 * DEBALLE deja la charge Strapi (services/client.native.js:89-95), cette branche
 * n'avait plus d'appelant et le repli francais etait du code mort.
 * @param {any} error
 * @param {string} [fallback] - Repli francais, propre a l'appel.
 * @returns {string} Un message en francais, toujours.
 */
export const getParticipationErrorMessage = (error, fallback = DEFAULT_PARTICIPATION_ERROR) => (
  getApiErrorTranslation(error)
  || String(fallback || '').trim()
  || DEFAULT_PARTICIPATION_ERROR
);
