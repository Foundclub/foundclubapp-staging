/**
 * @typedef {'all' | 'team' | 'club' | 'event' | 'featured' | 'installation' | 'interest'
 *  | 'friendly' | 'teamInvite'} RequestHubFilter
 * @typedef {'team' | 'club' | 'event' | 'featured' | 'installation' | 'interest'
 *  | 'friendly' | 'teamInvite'} RequestHubType
 * @typedef {'pending'} RequestHubStatus
 * @typedef {'accept' | 'reject' | 'validate' | 'respond' | 'chat' | 'open'} RequestHubAction
 * @typedef {object} RequestHubItem
 * @property {string} id
 * @property {RequestHubType} type
 * @property {RequestHubStatus} status
 * @property {string | null} createdAt
 * @property {string} title
 * @property {string} subtitle
 * @property {{ primary?: RequestHubAction; secondary?: RequestHubAction }} actions
 * @property {Record<string, any>} meta
 */

import i18next from 'i18next';

import {
  lieuAvecPreposition,
  momentDeLaDemande,
} from '@/domains/collectivite/collectiviteDemandes';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

export const REQUEST_HUB_FILTERS = /** @type {const} */ ([
  'all', 'team', 'club', 'event', 'featured', 'installation', 'interest', 'friendly', 'teamInvite',
]);

/**
 * @param {{
 *  canManageInstallationRequests?: boolean;
 *  clubId?: string;
 *  cmId?: string;
 *  teamIds?: string[];
 * }} context
 * @returns {RequestHubFilter[]}
 */
export const getAvailableRequestHubFilters = (context = {}) => {
  const {
    canManageInstallationRequests = false,
    clubId = '',
    cmId = '',
    teamIds = [],
  } = context;

  /** @type {RequestHubFilter[]} */
  const filters = ['all'];

  if ((Array.isArray(teamIds) && teamIds.length > 0) || clubId) {
    filters.push('team', 'interest');
  }
  // D92 — les matchs amicaux se proposent d equipe a equipe : le filtre n a de
  // sens que pour qui en encadre au moins une.
  // Y04 — « encadrer » ne veut pas dire « entrainer ». Un dirigeant gere les
  // equipes de son club sans en entrainer aucune : sans `clubId`, ses
  // propositions arrivaient bien dans « Toutes » mais aucun onglet « Amicaux »
  // ne permettait de les isoler. Meme porte que la source du meme nom.
  if ((Array.isArray(teamIds) && teamIds.length > 0) || clubId) {
    filters.push('friendly');
  }
  // S10-C / D1 — MEME PORTE QUE LE SERVEUR. Le contrat S10-A calcule le
  // perimetre comme « equipe que j entraine OU club que je dirige » : l onglet
  // s ouvre exactement dans ces deux cas, jamais pour un joueur.
  if ((Array.isArray(teamIds) && teamIds.length > 0) || clubId) {
    filters.push('teamInvite');
  }
  if (clubId) {
    filters.push('club', 'event');
  }
  if (clubId || cmId) {
    filters.push('featured');
  }
  if (canManageInstallationRequests) {
    filters.push('installation');
  }

  return filters;
};

const normalizeString = (/** @type {any} */ value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const toIsoString = (/** @type {any} */ value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const resolveRequesterName = (/** @type {any} */ requester = {}) => {
  const firstname = normalizeString(
    requester?.firstname || requester?.firstName || requester?.requesterFirstname,
  );
  const lastname = normalizeString(
    requester?.lastname || requester?.lastName || requester?.requesterLastname,
  );
  const fullName = [firstname, lastname].filter(Boolean).join(' ').trim();

  if (fullName) return fullName;
  return normalizeString(
    requester?.displayName || requester?.username || requester?.phoneNumber || requester?.phone,
  ) || i18next.t('requestMappers.requesterFallback', 'Utilisateur');
};

const toStableTime = (/** @type {any} */ value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  return date.getTime();
};

const resolveRequesterAvatarUrl = (/** @type {any} */ requester = {}) => {
  const directAvatar = requester?.avatar;

  if (typeof directAvatar === 'string' && directAvatar.trim()) {
    return directAvatar.trim();
  }

  if (directAvatar && typeof directAvatar === 'object') {
    const directUrl = normalizeString(directAvatar?.url);
    if (directUrl) return directUrl;

    const nestedUrl = normalizeString(directAvatar?.data?.attributes?.url);
    if (nestedUrl) return nestedUrl;
  }

  const nestedUserAvatar = requester?.user?.avatar;
  if (typeof nestedUserAvatar === 'string' && nestedUserAvatar.trim()) {
    return nestedUserAvatar.trim();
  }
  if (nestedUserAvatar && typeof nestedUserAvatar === 'object') {
    const nestedDirectUrl = normalizeString(nestedUserAvatar?.url);
    if (nestedDirectUrl) return nestedDirectUrl;

    const nestedDeepUrl = normalizeString(nestedUserAvatar?.data?.attributes?.url);
    if (nestedDeepUrl) return nestedDeepUrl;
  }

  return '';
};

/**
 * @param {Record<string, any>} request
 * @returns {RequestHubItem}
 */
export const mapTeamMembershipRequestToHubItem = (request = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  const teamName = normalizeString(request?.team?.name) || i18next.t(
    'requestMappers.teamFallback',
    'Equipe',
  );
  const requester = request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester);
  const canManage = request?.permissions?.canManage !== false;
  const isOwnerOnly = request?.team?.membershipRequestManagementMode === 'CLUB_OWNER_ONLY';
  const isReadOnly = !canManage;
  let readOnlyReason = '';
  if (isReadOnly) {
    readOnlyReason = isOwnerOnly ? 'club_owner_only' : 'manager_required';
  }
  const readOnlySubtitle = isOwnerOnly
    ? [
      i18next.t(
        'requestMappers.team.asked',
        '{{requester}} a demandé à rejoindre {{team}}.',
        { requester: requesterName, team: teamName, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'requestMappers.team.waitForManagers',
        'Ton équipe doit attendre la validation par ton ou tes dirigeant(s).',
      ),
    ].join(' ')
    : [
      i18next.t(
        'requestMappers.team.asked',
        '{{requester}} a demandé à rejoindre {{team}}.',
        { requester: requesterName, team: teamName, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'requestMappers.team.managerRequired',
        'Un responsable autorisé doit traiter cette demande.',
      ),
    ].join(' ');

  return {
    actions: isReadOnly ? {} : { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt),
    id: `team:${requestId}`,
    meta: {
      canManage,
      governanceMode: normalizeString(request?.team?.membershipRequestManagementMode),
      infoOnly: isReadOnly,
      raw: request,
      readOnlyReason,
      requesterAvatarUrl,
      requesterId: normalizeString(request?.user?.documentId),
      requesterName,
      requestId,
      teamId: normalizeString(request?.team?.documentId),
      teamName,
    },
    status: 'pending',
    subtitle: isReadOnly
      ? readOnlySubtitle
      : i18next.t(
        'requestMappers.team.wantsToJoin',
        '{{requester}} souhaite rejoindre {{team}}.',
        { requester: requesterName, team: teamName, ...SANS_ECHAPPEMENT },
      ),
    title: isReadOnly
      ? i18next.t('requestMappers.team.titleReadOnly', 'Demande équipe en validation')
      : i18next.t('requestMappers.team.title', 'Demande adhésion équipe'),
    type: 'team',
  };
};

/**
 * Les demandes de type 'claim' (revendication de club) ne peuvent etre traitees
 * que par un superadmin cote backend : pour tout autre viewer, l'item est mappe
 * en lecture seule (aucune action accept/reject).
 * @param {Record<string, any>} request
 * @param {Record<string, any>} [options]
 * @returns {RequestHubItem}
 */
export const mapClubMembershipRequestToHubItem = (request = {}, options = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  const clubName = normalizeString(request?.club?.name) || i18next.t(
    'requestMappers.clubFallback',
    'Club',
  );
  const requester = request?.requester || request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester)
    || resolveRequesterAvatarUrl(request?.user || {});
  const requestType = normalizeString(request?.type) === 'claim' ? 'claim' : 'join';
  const isSuperAdmin = options?.isSuperAdmin === true;
  const isReadOnly = requestType === 'claim' && !isSuperAdmin;
  const title = requestType === 'claim'
    ? i18next.t('requestMappers.club.claimTitle', 'Revendication club')
    : i18next.t('requestMappers.club.joinTitle', 'Demande affiliation club');
  const subtitle = requestType === 'claim'
    ? i18next.t(
      'requestMappers.club.claim',
      '{{requester}} veut revendiquer la gestion du club {{club}}.',
      { club: clubName, requester: requesterName, ...SANS_ECHAPPEMENT },
    )
    : i18next.t(
      'requestMappers.club.join',
      '{{requester}} demande une affiliation au club {{club}}.',
      { club: clubName, requester: requesterName, ...SANS_ECHAPPEMENT },
    );
  const readOnlySubtitle = [
    i18next.t(
      'requestMappers.club.claim',
      '{{requester}} veut revendiquer la gestion du club {{club}}.',
      { club: clubName, requester: requesterName, ...SANS_ECHAPPEMENT },
    ),
    i18next.t(
      'requestMappers.club.claimReview',
      'Revendication en cours de vérification FoundClub.',
    ),
  ].join(' ');

  return {
    actions: isReadOnly ? {} : { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt),
    id: `club:${requestId}`,
    meta: {
      clubId: normalizeString(request?.club?.documentId),
      clubName,
      infoOnly: isReadOnly,
      raw: request,
      readOnlyReason: isReadOnly ? 'superadmin_required' : '',
      requesterAvatarUrl,
      requesterId: normalizeString(requester?.documentId || request?.user?.documentId),
      requesterName,
      requestId,
      requestType,
    },
    status: 'pending',
    subtitle: isReadOnly ? readOnlySubtitle : subtitle,
    title: isReadOnly ? i18next.t(
      'requestMappers.club.claimTitleReadOnly',
      'Revendication club en vérification',
    ) : title,
    type: 'club',
  };
};

/**
 * @param {Record<string, any>} request
 * @returns {RequestHubItem}
 */
export const mapClubInterestRequestToHubItem = (request = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  // V01 — un interet peut viser LE CLUB et ne nommer aucune equipe. Le repli
  // « Equipe » racontait alors une equipe qui n'existe pas : le dirigeant lisait
  // « X est interesse par Equipe ». L'absence d'equipe se dit, elle ne se
  // remplace pas.
  const teamName = normalizeString(request?.team?.name);
  const clubName = normalizeString(request?.club?.name || request?.team?.club?.name) || i18next.t(
    'requestMappers.clubFallback',
    'Club',
  );
  const requester = request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester);

  // 👶 PARENT P3 (11/09) — UNE PLACE DEMANDEE POUR UN ENFANT. Decision d'Adel « 1- a » :
  // les responsables voient son PRENOM et son AGE, et ils TRANCHENT. La ligne dit
  // donc pour qui, et propose Accepter / Refuser — pas « Repondre », qui laisserait
  // la demande traitee sans que l'enfant soit jamais entre dans l'equipe.
  //
  // 👪 PAR-L2L3 · L3 (12/10, PAR-007) — L'ENFANT AU PREMIER PLAN. Le coach doit
  // reconnaitre l'enfant, pas deduire qui il est d'une phrase sur son parent :
  // le TITRE est l'enfant (« Anissa, 11 ans »), la phrase dit ce qu'il demande,
  // et le parent reste dans `meta` (la carte le nomme en second). Prenom et age
  // SEULEMENT, comme avant : rien de plus d'un mineur avant l'acceptation.
  const child = request?.declaredChild;
  const childId = normalizeString(child?.documentId);
  if (childId) {
    const childFirstname = normalizeString(child?.firstname);
    const childAge = Number.isFinite(child?.age) ? child.age : null;
    const childTitle = childAge === null
      ? childFirstname
      : i18next.t(
        'requestMappers.interest.childTitleWithAge',
        '{{firstname}}, {{age}} ans',
        { age: childAge, firstname: childFirstname, ...SANS_ECHAPPEMENT },
      );
    const destination = teamName || clubName;
    return {
      actions: { primary: 'accept', secondary: 'reject' },
      createdAt: toIsoString(request?.createdAt),
      id: `interest:${requestId}`,
      meta: {
        childAge,
        childFirstname,
        childId,
        clubId: normalizeString(request?.club?.documentId || request?.team?.club?.documentId),
        clubName,
        raw: request,
        requesterAvatarUrl,
        requesterId: normalizeString(requester?.documentId),
        requesterName,
        requestId,
        teamId: normalizeString(request?.team?.documentId),
        teamName,
      },
      status: 'pending',
      subtitle: i18next.t(
        'requestMappers.interest.childAsk',
        'Demande une place dans {{destination}}.',
        { destination, ...SANS_ECHAPPEMENT },
      ),
      title: childTitle
        || i18next.t('requestMappers.interest.childPlaceTitle', 'Place pour un enfant'),
      type: 'interest',
    };
  }

  // 👪 PAR-L9a (13/10, E15) — la CONVERSATION est le geste principal de la carte, « Repondre »
  // le second (la carte les empile dans cet ordre). Le prenom seul sert aux phrases qui
  // s adressent a la personne : « Reponse envoyee a Maryline. ».
  return {
    actions: { primary: 'chat', secondary: 'respond' },
    createdAt: toIsoString(request?.createdAt),
    id: `interest:${requestId}`,
    meta: {
      clubId: normalizeString(request?.club?.documentId || request?.team?.club?.documentId),
      clubName,
      raw: request,
      requesterAvatarUrl,
      requesterFirstname: normalizeString(requester?.firstname || requester?.firstName),
      requesterId: normalizeString(requester?.documentId),
      requesterName,
      requestId,
      teamId: normalizeString(request?.team?.documentId),
      teamName,
    },
    status: 'pending',
    subtitle: teamName
      ? i18next.t(
        'requestMappers.interest.team',
        '{{requester}} est intéressé·e par {{team}}.',
        { requester: requesterName, team: teamName, ...SANS_ECHAPPEMENT },
      )
      : i18next.t(
        'requestMappers.interest.club',
        '{{requester}} est intéressé·e par le club {{club}}.',
        { club: clubName, requester: requesterName, ...SANS_ECHAPPEMENT },
      ),
    title: i18next.t('requestMappers.interest.title', 'Intérêt pour le club'),
    type: 'interest',
  };
};

/**
 * @param {Record<string, any>} event
 * @returns {RequestHubItem}
 */
export const mapEventValidationRequestToHubItem = (event = {}) => {
  const eventId = String(event?.documentId || event?.id || '');
  const teamName = normalizeString(event?.team?.name) || i18next.t(
    'requestMappers.teamFallback',
    'Equipe',
  );
  const eventName = normalizeString(event?.name || event?.type?.name) || i18next.t(
    'requestMappers.eventFallback',
    'Événement',
  );
  const startDate = toIsoString(event?.date);

  return {
    actions: { primary: 'validate', secondary: 'reject' },
    createdAt: toIsoString(event?.createdAt) || startDate,
    id: `event:${eventId}`,
    meta: {
      eventId,
      eventName,
      raw: event,
      teamName,
    },
    status: 'pending',
    subtitle: `${eventName} - ${teamName}`,
    title: i18next.t('requestMappers.event.validationTitle', 'Validation événement'),
    type: 'event',
  };
};

/**
 * @param {Record<string, any>} event
 * @param {Record<string, any>} request
 * @returns {RequestHubItem}
 */
export const mapEventParticipationRequestToHubItem = (event = {}, request = {}) => {
  const eventId = String(event?.documentId || event?.id || '');
  const requestId = String(request?.documentId || request?.id || '');
  const teamName = normalizeString(event?.team?.name) || i18next.t(
    'requestMappers.teamFallback',
    'Equipe',
  );
  const eventName = normalizeString(event?.name || event?.type?.name) || i18next.t(
    'requestMappers.eventFallback',
    'Événement',
  );
  const requester = request?.requester || request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester)
    || resolveRequesterAvatarUrl(request?.user || {});
  const sourceTeamName = normalizeString(request?.sourceTeam?.name);

  return {
    actions: { primary: 'validate', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt || request?.updatedAt || event?.createdAt || event?.date),
    id: `event:${eventId}:participation:${requestId}`,
    meta: {
      eventId,
      eventName,
      participationRequestId: requestId,
      raw: event,
      rawParticipationRequest: request,
      requesterAvatarUrl,
      requesterId: normalizeString(requester?.documentId || request?.user?.documentId),
      requesterName,
      sourceTeamName,
      teamName,
    },
    status: 'pending',
    subtitle: `${eventName} - ${teamName}`,
    title: i18next.t('requestMappers.event.validationTitle', 'Validation événement'),
    type: 'event',
  };
};

export const mapFeaturedRequestToHubItem = (/** @type {Record<string, any>} */ event = {}) => {
  const requestId = String(event?.documentId || event?.id || '');
  const requestKind = normalizeString(event?.kind).toUpperCase();
  const eventEntity = event?.event || {};
  const eventId = String(eventEntity?.documentId || eventEntity?.id || '');
  const eventName = normalizeString(eventEntity?.name || eventEntity?.type?.name) || i18next.t(
    'requestMappers.eventFallback',
    'Événement',
  );
  const clubName = normalizeString(eventEntity?.team?.club?.name) || i18next.t(
    'requestMappers.clubFallback',
    'Club',
  );
  const scopeLabelByKind = /** @type {Record<string, string>} */ ({
    CM: i18next.t('requestMappers.featured.scope.multisport', 'Multisport'),
    PUBLIC: i18next.t('requestMappers.featured.scope.public', 'Public'),
  });
  const scopeLabel = scopeLabelByKind[requestKind] || i18next.t(
    'requestMappers.featured.scope.club',
    'Club',
  );
  const targetName = normalizeString(event?.targetClub?.name || event?.multisportClub?.name || clubName);
  const requester = event?.requester || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester);

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(event?.createdAt) || toIsoString(eventEntity?.date),
    id: `featured:${requestId}`,
    meta: {
      clubName,
      eventId,
      eventName,
      raw: eventEntity,
      requesterAvatarUrl,
      requesterId: normalizeString(requester?.documentId),
      requesterName,
      requestId,
      scope: requestKind,
      scopeLabel,
      targetName,
    },
    status: 'pending',
    subtitle: i18next.t(
      'requestMappers.featured.subtitle',
      '{{requester}} demande une mise à la une {{scope}}{{target}}.',
      {
        requester: requesterName,
        scope: scopeLabel.toLowerCase(),
        target: targetName
          ? i18next.t(
            'requestMappers.featured.forTarget',
            ' pour {{target}}',
            { target: targetName, ...SANS_ECHAPPEMENT },
          )
          : '',
        ...SANS_ECHAPPEMENT,
      },
    ),
    title: i18next.t(
      'requestMappers.featured.title',
      'Mise à la une {{scope}} - {{event}}',
      { event: eventName, scope: scopeLabel, ...SANS_ECHAPPEMENT },
    ),
    type: 'featured',
  };
};

export const mapFacilityOverrideRequestToHubItem = (/** @type {Record<string, any>} */ request = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  const requester = request?.requestedBy || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester);
  const eventEntity = request?.event || {};
  const eventId = normalizeString(eventEntity?.documentId || eventEntity?.id);
  const eventName = normalizeString(eventEntity?.name || eventEntity?.type?.name) || i18next.t(
    'requestMappers.eventFallback',
    'Événement',
  );
  const facilityName = normalizeString(request?.facility?.name) || i18next.t(
    'requestMappers.facilityFallback',
    'Installation',
  );
  const teamName = normalizeString(request?.team?.name) || i18next.t(
    'requestMappers.teamFallback',
    'Equipe',
  );
  const overlapCount = Number(request?.overlapCount || 0);
  const maxSlots = Number(request?.maxSlots || 1);
  const startDate = toIsoString(request?.requestedStart || request?.createdAt);

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: startDate,
    id: `installation:${requestId}`,
    meta: {
      clubId: normalizeString(request?.club?.documentId),
      eventId,
      eventName,
      facilityName,
      maxSlots,
      overlapCount,
      raw: request,
      reason: normalizeString(request?.reason),
      requesterAvatarUrl,
      requesterId: normalizeString(requester?.documentId),
      requesterName,
      requestId,
      teamId: normalizeString(request?.team?.documentId),
      teamName,
      windowEnd: toIsoString(request?.requestedEnd),
      windowStart: startDate,
    },
    status: 'pending',
    // COLL-C3B (02/10, planche P6v2) — la MÊME phrase que la mairie lit : « AS Montrivage
    // demande le jeudi 1 oct., de 18:00 à 19:30, au Gymnase des Tilleuls, pour ses U13. Il y a
    // déjà 2 équipes : c est complet. » (avant : « … (2/2 slots deja pris). »).
    subtitle: phraseDeLaDemandeDuHub(request, {
      facilityName, maxSlots, overlapCount, teamName,
    }),
    title: i18next.t('requestMappers.facility.title', 'Exception installation'),
    type: 'installation',
  };
};

/**
 * COLL-C3B — la phrase d une demande d installation, et ce qu il y a sur place.
 * @param {Record<string, any>} request - La demande (club, installation, fenetre).
 * @param {{ facilityName: string, maxSlots: number, overlapCount: number, teamName: string }} mots
 * @returns {string} « X demande le …, de … à …, au …, pour ses …. Il y a deja … : c est complet. »
 */
const phraseDeLaDemandeDuHub = (request, {
  facilityName, maxSlots, overlapCount, teamName,
}) => {
  // Les clés et leurs replis vivent avec « Demandes de la Ville » (CollectiviteRequests.js).
  const t = i18next.t.bind(i18next);
  const moment = momentDeLaDemande(request);
  const valeurs = {
    club: normalizeString(request?.club?.name) || teamName,
    equipe: teamName,
    lieu: lieuAvecPreposition(facilityName, t),
    ...SANS_ECHAPPEMENT,
  };
  const demande = moment
    ? t('collectiviteDemandes.phrase.unique', {
      ...valeurs, debut: moment.debut, fin: moment.fin, jour: moment.jour, ...SANS_ECHAPPEMENT,
    })
    : t('collectiviteDemandes.hub.sansMoment', valeurs);
  const equipes = overlapCount === 1
    ? t('collectiviteDemandes.nombre.uneEquipe')
    : t('collectiviteDemandes.nombre.equipes', { nombre: overlapCount });
  const libres = Math.max(0, maxSlots - overlapCount);
  const places = libres === 1
    ? t('collectiviteDemandes.nombre.unePlace')
    : t('collectiviteDemandes.nombre.places', { nombre: libres });
  const place = overlapCount >= maxSlots
    ? t('collectiviteDemandes.place.complet', { equipes, ...SANS_ECHAPPEMENT })
    : t('collectiviteDemandes.hub.reste', 'Il reste {{places}}.', { places, ...SANS_ECHAPPEMENT });
  return `${demande} ${place}`;
};

/**
 * D92 — une proposition de match amical RECUE : une equipe a repondu a l annonce
 * de la mienne, et j ai le dernier mot.
 *
 * Elle n embarque pas ses boutons « accepter / refuser » : l ecran de l annonce
 * les porte deja, avec les modalites a convenir (FriendlyMatchApplicationCard).
 * Deux jeux de boutons pour un meme geste, c est deux endroits ou se tromper.
 * @param {Record<string, any>} ad
 * @param {Record<string, any>} application
 * @returns {RequestHubItem}
 */
export const mapFriendlyMatchApplicationToHubItem = (ad = {}, application = {}) => {
  const applicationId = String(application?.documentId || application?.id || '');
  const opponentName = normalizeString(application?.team?.name) || i18next.t(
    'requestMappers.friendly.opponentFallback',
    'Une equipe',
  );
  const myTeamName = normalizeString(ad?.team?.name) || i18next.t(
    'requestMappers.friendly.myTeamFallback',
    'ton equipe',
  );

  return {
    actions: { primary: 'open' },
    createdAt: toIsoString(application?.createdAt),
    id: `friendly:${applicationId}`,
    meta: {
      adId: String(ad?.documentId || ad?.id || ''),
      applicationId,
      isOutgoing: false,
      opponentName,
      raw: application,
      teamName: myTeamName,
    },
    status: 'pending',
    subtitle: i18next.t(
      'requestMappers.friendly.received',
      '{{opponent}} propose un match à {{team}}.',
      { opponent: opponentName, team: myTeamName, ...SANS_ECHAPPEMENT },
    ),
    title: i18next.t('requestMappers.friendly.receivedTitle', 'Proposition de match amical'),
    type: 'friendly',
  };
};

/**
 * D92 — une proposition ENVOYEE, tant que personne n a repondu.
 *
 * Adel a demande exactement ca pour les demandes de club (lot D87) : ce qu on
 * envoie doit rester visible quelque part, sinon on ne sait plus si c est parti.
 * Elle est en lecture seule — c est l autre staff qui tranche, pas moi.
 * @param {Record<string, any>} ad
 * @returns {RequestHubItem}
 */
export const mapMyFriendlyMatchProposalToHubItem = (ad = {}) => {
  const application = ad?.myApplication || {};
  const applicationId = String(application?.documentId || application?.id || '');
  const opponentName = normalizeString(ad?.team?.name) || i18next.t(
    'requestMappers.friendly.opponentFallback',
    'Une equipe',
  );

  return {
    actions: {},
    createdAt: toIsoString(application?.createdAt),
    id: `friendly-sent:${applicationId}`,
    meta: {
      adId: String(ad?.documentId || ad?.id || ''),
      applicationId,
      infoOnly: true,
      isOutgoing: true,
      opponentName,
      raw: application,
    },
    status: 'pending',
    subtitle: i18next.t(
      'requestMappers.friendly.sent',
      'Envoyée à {{opponent}}. En attente de sa réponse.',
      { opponent: opponentName, ...SANS_ECHAPPEMENT },
    ),
    title: i18next.t('requestMappers.friendly.sentTitle', 'Ta proposition de match'),
    type: 'friendly',
  };
};

/**
 * S10-C / D1 — UNE INVITATION D EQUIPE QUI ATTEND MA REPONSE.
 *
 * Forme d entree : celle de `GET /event-team-audiences/mine` (contrat S10-A du
 * 2026-08-26, section 5). Elle ne porte AUCUNE donnee personnelle — ni membres
 * coches, ni joueurs, ni encadrants : la rangee n en affiche donc aucune.
 *
 * 🚪 ELLE N EMBARQUE PAS SES BOUTONS (decision D5) : accepter et refuser vivent
 * a UN seul endroit, la section « Invitations d equipe » de la fiche
 * evenement. `meta.eventId` suffit a y mener en un appui — deux jeux de boutons
 * pour un meme geste, c est deux endroits ou diverger, et le meme motif que
 * les propositions de match amical (D92).
 * @param {Record<string, any>} audience
 * @returns {RequestHubItem}
 */
export const mapEventTeamInvitationToHubItem = (audience = {}) => {
  const event = audience?.event || {};
  const invitedTeam = audience?.team || {};
  const audienceId = String(audience?.audienceId || audience?.documentId || audience?.id || '');
  const eventId = String(event?.id || event?.documentId || '');
  const typeName = normalizeString(event?.typeName);
  const eventName = normalizeString(event?.name) || typeName || i18next.t(
    'requestMappers.eventFallback',
    'Événement',
  );
  const invitedTeamName = normalizeString(invitedTeam?.name) || i18next.t(
    'requestMappers.teamInvite.myTeamFallback',
    'Ton équipe',
  );
  const organizerTeamName = normalizeString(event?.teamName);

  return {
    actions: {},
    // Le contrat ne promet pas de date de creation : la date de l evenement
    // range les invitations entre elles plutot que de les jeter toutes au
    // fond de la liste (`createdAt` absent vaut moins l infini au tri).
    createdAt: toIsoString(audience?.createdAt) || toIsoString(event?.date),
    id: `teamInvite:${audienceId}`,
    meta: {
      audienceId,
      eventDate: toIsoString(event?.date),
      eventId,
      eventName,
      invitedTeamName,
      organizerTeamName,
      raw: audience,
      teamId: normalizeString(invitedTeam?.id || invitedTeam?.documentId),
      teamName: invitedTeamName,
    },
    status: 'pending',
    subtitle: organizerTeamName
      ? i18next.t(
        'requestMappers.teamInvite.invites',
        '{{organizer}} invite {{team}}.',
        { organizer: organizerTeamName, team: invitedTeamName, ...SANS_ECHAPPEMENT },
      )
      : i18next.t(
        'requestMappers.teamInvite.invited',
        '{{team}} est invitee a cet evenement.',
        { team: invitedTeamName, ...SANS_ECHAPPEMENT },
      ),
    title: i18next.t(
      'requestMappers.teamInvite.title',
      'Invitation - {{event}}',
      { event: eventName, ...SANS_ECHAPPEMENT },
    ),
    type: 'teamInvite',
  };
};

/**
 * @param {RequestHubItem[]} items
 * @returns {RequestHubItem[]}
 */
export const sortRequestHubItems = (items = []) => (
  [...items].sort((a, b) => {
    const diff = toStableTime(b?.createdAt) - toStableTime(a?.createdAt);
    if (diff !== 0) return diff;
    const aFallback = `${a?.type || ''}:${a?.id || ''}`;
    const bFallback = `${b?.type || ''}:${b?.id || ''}`;
    return aFallback.localeCompare(bFallback);
  })
);

/**
 * @param {RequestHubItem[]} items
 */
export const buildRequestHubCounts = (items = []) => {
  // ⚠️ Un type absent de cette table est compte NULLE PART — pas meme dans
  // `total` (voir le garde ci-dessous). Ajouter un type de demande sans ajouter
  // sa ligne ici, c est le rendre invisible dans la pastille.
  const counts = {
    club: 0,
    event: 0,
    featured: 0,
    friendly: 0,
    installation: 0,
    interest: 0,
    team: 0,
    teamInvite: 0,
    total: 0,
  };

  items.forEach((item) => {
    if (!item?.type || typeof counts[item.type] !== 'number') return;
    counts[item.type] += 1;
    counts.total += 1;
  });

  return counts;
};
