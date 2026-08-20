import { RouteNames } from '@/navigation/routeNames';

import { sportHasPositions } from '@/constants/positions';

export const normalizeTypeLabel = (/** @type {any} */ value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export const isDetectionEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('detection');
export const isStageEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('stage');
export const isTournamentEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('tournoi');
export const isTrainingEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('entrainement');
// Y02 — un match, et donc le seul parcours qui traverse « Contre qui ? ».
// ⚠️ `includes('match')` attrape aussi « Match amical », et c'est voulu : lui
// aussi a un adversaire.
export const isMatchEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('match');

const hasNonEmptyValue = (/** @type {any} */ value) => {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    return Boolean(
      value.documentId
      || value.id
      || value.value
      || value.label
      || value.description
      || value.name
      || value.address
      || Number.isFinite(value.lat)
      || Number.isFinite(value.lng)
      || Number.isFinite(value.latitude)
      || Number.isFinite(value.longitude),
    );
  }
  return true;
};

export const getActiveStageScheduleDays = (/** @type {any} */ state = {}) => (
  Array.isArray(state?.stageSchedule)
    ? state.stageSchedule.filter((/** @type {any} */ day) => day?.isActive !== false)
    : []
);

export const hasValidStageDayLocation = (/** @type {any} */ day = {}) => hasNonEmptyValue(
  day?.facilityId || day?.facility?.documentId || day?.facility || day?.location,
);

export const hasCompletePerDayLocations = (/** @type {any} */ state = {}) => {
  const activeDays = getActiveStageScheduleDays(state);
  return activeDays.length > 0 && activeDays.every(hasValidStageDayLocation);
};

export const shouldSkipEventWizardLocationStep = (/** @type {any} */ state = {}) => (
  isTournamentEventType(state?.type?.name)
  && state?.isMultiDayTournament === true
  && hasCompletePerDayLocations(state)
);

export const getEventWizardSportName = (/** @type {any} */ state = {}) => (
  state?.team?.sport?.name
  || state?.team?.activities?.[0]?.name
  || state?.tournamentActivity?.name
  || ''
);

/**
 * Les postes recherches sont-ils proposes sur l'etape « Participants » ?
 *
 * 🔀 D58 — jusqu'au 2026-08-10 ce predicat decidait d'un ECRAN a part entiere,
 * et c'est lui qui mettait une detection a 9 etapes la ou le pack « Tunnel
 * Evenement » du 2026-08-05 en promet 8. Decision d'Adel du 2026-08-09 : on
 * fusionne. Les postes sont desormais une SECTION de l'etape Participants,
 * derriere un interrupteur (pack §2.5), et ce predicat decide de la section.
 * Sa regle, elle, n'a pas bouge d'un iota : detection + sport a postes + non
 * recurrent.
 * @param {any} state Etat courant du tunnel.
 * @returns {boolean} Vrai si la section « Postes recherches » doit etre offerte.
 */
export const shouldOfferDetectionSlots = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return false;
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const shouldExplainDetectionSlotsDisabled = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return false;
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (!state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const shouldSkipEventWizardParticipantsStep = (/** @type {any} */ state = {}) => (
  isTrainingEventType(state?.type?.name)
  && String(state?.sessionStatus || 'open').trim().toLowerCase() === 'closed'
);

/**
 * LA CHAINE DU TUNNEL, ecrite UNE SEULE FOIS (D08).
 *
 * Avant ce lot, l'ordre des ecrans etait encode DEUX fois : ici sous forme de
 * numeros d'etape, et dans le `handleNext` de chaque ecran sous forme de
 * `navigate`. Rien ne verifiait que les deux restaient d'accord. Tout le reste
 * de ce fichier — le nombre d'etapes, la place de chaque ecran, l'ecran suivant
 * — se deduit desormais de cette seule liste.
 *
 * `EventWizardInvites` n'y figure volontairement pas : il est sorti de la
 * chaine par D08 et se rejoint depuis le Recap. Il reste enregistre et
 * atteignable ; il n'a simplement plus de numero d'etape.
 * @param {any} state Etat courant du tunnel.
 * @returns {string[]} Les ecrans traverses, dans l'ordre.
 */
export const getEventWizardStepRoutes = (state = {}) => {
  const routes = [RouteNames.EventWizardType, RouteNames.EventWizardTeam];

  if (isStageEventType(state?.type?.name)) {
    routes.push(RouteNames.EventWizardStageProgram);
  } else {
    routes.push(RouteNames.EventWizardLogistics);
  }

  // Y02 — « Contre qui ? », UNIQUEMENT pour un match. Elle est placee juste
  // apres l'equipe et la date parce que c'est la qu'on pense a l'adversaire,
  // et avant le lieu : savoir qui l'on recoit aide a choisir ou l'on joue.
  if (isMatchEventType(state?.type?.name)) {
    routes.push(RouteNames.EventWizardOpponent);
  }

  routes.push(RouteNames.EventWizardLocation);

  if (isTournamentEventType(state?.type?.name)) {
    routes.push(
      RouteNames.EventWizardTournamentSettings,
      RouteNames.EventWizardTournamentStructure,
    );
  }

  if (!shouldSkipEventWizardParticipantsStep(state)) {
    routes.push(RouteNames.EventWizardParticipants);
  }

  routes.push(
    RouteNames.EventWizardAccess,
    RouteNames.EventWizardDescription,
    RouteNames.EventWizardRecap,
  );

  return routes;
};

/**
 * La place d'un ecran dans le parcours courant, comptee a partir de 1.
 * @param {string} routeName Nom de la route.
 * @param {any} state Etat courant du tunnel.
 * @returns {number} Le rang de l'ecran, ou 0 s'il n'appartient pas au parcours.
 */
export const getEventWizardStepIndex = (routeName, state = {}) => (
  getEventWizardStepRoutes(state).indexOf(routeName) + 1
);

/**
 * L'ecran vers lequel envoie le bouton « Suivant ».
 * Un ecran hors chaine (aujourd'hui `EventWizardInvites`, rejoint depuis le
 * Recap) rend la main au Recap : c'est de la qu'on y est entre.
 * @param {string} routeName Ecran courant.
 * @param {any} state Etat courant du tunnel.
 * @returns {string} Nom de la route suivante.
 */
export const getEventWizardNextRoute = (routeName, state = {}) => {
  const routes = getEventWizardStepRoutes(state);
  const position = routes.indexOf(routeName);
  if (position < 0 || position === routes.length - 1) return RouteNames.EventWizardRecap;
  return routes[position + 1];
};

export const getEventWizardStepCount = (/** @type {any} */ state = {}) => (
  getEventWizardStepRoutes(state).length
);

/**
 * LE BILLET DE RETOUR, pose par le recapitulatif sur l'etape qu'il ouvre.
 *
 * 🧨 Defaut trouve a la recette du 2026-08-07 : depuis le recapitulatif,
 * « modifier » ouvrait bien la bonne etape, mais il fallait ensuite RETRAVERSER
 * toutes les suivantes au lieu de revenir au recap. Le recap naviguait en
 * aveugle — `navigate(EventWizardXxx)` sans aucun parametre — donc l'etape ne
 * pouvait pas savoir d'ou elle avait ete ouverte : elle enchainait normalement.
 *
 * ⛔ L'information voyage en PARAMETRE, jamais en inspectant la pile de
 * navigation : une pile s'inspecte mal, se teste encore plus mal, et casse au
 * premier remaniement (lecon du lot L40-B, deja payee).
 * @type {{ returnTo: string }}
 */
export const EVENT_WIZARD_RETURN_TO_RECAP = { returnTo: RouteNames.EventWizardRecap };

/**
 * Ou mene « Suivant », une fois pris en compte le billet de retour.
 *
 * Se lit « la ou tu serais alle, SAUF si le recap t'a ouvert ». C'est pour ca
 * qu'elle prend la destination deja calculee plutot que de la recalculer : les
 * etapes ne visent pas toutes `getEventWizardNextRoute` — le stage saute vers
 * les reglages de tournoi, la logistique multi-jours saute vers le lieu — et
 * ces sauts doivent honorer le retour eux aussi.
 *
 * ⚠️ SANS le parametre, elle rend exactement la destination qu'on lui passe :
 * un tunnel ouvert normalement ne change donc rien du tout.
 * @param {string} nextRouteName La destination prevue par la chaine.
 * @param {any} [routeParams] Les parametres de l'ecran courant (`route.params`).
 * @returns {string} La destination effective.
 */
export const getEventWizardExitRoute = (nextRouteName, routeParams = {}) => (
  routeParams?.returnTo === RouteNames.EventWizardRecap
    ? RouteNames.EventWizardRecap
    : nextRouteName
);

export const getEventWizardLogisticsStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardLogistics, state)
);

export const getEventWizardOpponentStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardOpponent, state)
);

export const getEventWizardLocationStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardLocation, state)
);

export const getEventWizardTournamentSettingsStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardTournamentSettings, state)
);

export const getEventWizardTournamentStructureStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardTournamentStructure, state)
);

export const getEventWizardParticipantsStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardParticipants, state)
);

export const getEventWizardStageProgramStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardStageProgram, state)
);

/**
 * L'ecran « Acces » : visibilite ET mode de validation, fusionnes par D08.
 * @param {any} state Etat courant du tunnel.
 * @returns {number} Le rang de l'ecran dans le parcours courant.
 */
export const getEventWizardAccessStepIndex = (state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardAccess, state)
);

export const getEventWizardDescriptionStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardDescription, state)
);

export const getEventWizardRecapStepIndex = (/** @type {any} */ state = {}) => (
  getEventWizardStepIndex(RouteNames.EventWizardRecap, state)
);
