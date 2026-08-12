/**
 * @typedef {'all' | 'team' | 'club' | 'event' | 'featured' | 'installation' | 'interest' | 'friendly'} RequestHubFilter
 * @typedef {'team' | 'club' | 'event' | 'featured' | 'installation' | 'interest' | 'friendly'} RequestHubType
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

export const REQUEST_HUB_FILTERS = /** @type {const} */ (['all', 'team', 'club', 'event', 'featured', 'installation', 'interest', 'friendly']);

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
  if (Array.isArray(teamIds) && teamIds.length > 0) {
    filters.push('friendly');
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

const fallbackRequesterName = 'Utilisateur';

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
  ) || fallbackRequesterName;
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
  const teamName = normalizeString(request?.team?.name) || 'Equipe';
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
      `${requesterName} a demandé à rejoindre ${teamName}.`,
      'Ton équipe doit attendre la validation par ton ou tes dirigeant(s).',
    ].join(' ')
    : [
      `${requesterName} a demandé à rejoindre ${teamName}.`,
      'Un responsable autorisé doit traiter cette demande.',
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
    subtitle: isReadOnly ? readOnlySubtitle : `${requesterName} souhaite rejoindre ${teamName}.`,
    title: isReadOnly ? 'Demande équipe en validation' : 'Demande adhésion équipe',
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
  const clubName = normalizeString(request?.club?.name) || 'Club';
  const requester = request?.requester || request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester)
    || resolveRequesterAvatarUrl(request?.user || {});
  const requestType = normalizeString(request?.type) === 'claim' ? 'claim' : 'join';
  const isSuperAdmin = options?.isSuperAdmin === true;
  const isReadOnly = requestType === 'claim' && !isSuperAdmin;
  const title = requestType === 'claim'
    ? 'Revendication club'
    : 'Demande affiliation club';
  const subtitle = requestType === 'claim'
    ? `${requesterName} veut revendiquer la gestion du club ${clubName}.`
    : `${requesterName} demande une affiliation au club ${clubName}.`;
  const readOnlySubtitle = [
    `${requesterName} veut revendiquer la gestion du club ${clubName}.`,
    'Revendication en cours de vérification FoundClub.',
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
    title: isReadOnly ? 'Revendication club en vérification' : title,
    type: 'club',
  };
};

/**
 * @param {Record<string, any>} request
 * @returns {RequestHubItem}
 */
export const mapClubInterestRequestToHubItem = (request = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  const teamName = normalizeString(request?.team?.name) || 'Equipe';
  const clubName = normalizeString(request?.club?.name || request?.team?.club?.name) || 'Club';
  const requester = request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester);

  return {
    actions: { primary: 'respond', secondary: 'chat' },
    createdAt: toIsoString(request?.createdAt),
    id: `interest:${requestId}`,
    meta: {
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
    subtitle: `${requesterName} est intéressé par ${teamName}.`,
    title: 'Intérêt club',
    type: 'interest',
  };
};

/**
 * @param {Record<string, any>} event
 * @returns {RequestHubItem}
 */
export const mapEventValidationRequestToHubItem = (event = {}) => {
  const eventId = String(event?.documentId || event?.id || '');
  const teamName = normalizeString(event?.team?.name) || 'Equipe';
  const eventName = normalizeString(event?.name || event?.type?.name) || 'Evenement';
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
    title: 'Validation événement',
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
  const teamName = normalizeString(event?.team?.name) || 'Equipe';
  const eventName = normalizeString(event?.name || event?.type?.name) || 'Evenement';
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
    title: 'Validation événement',
    type: 'event',
  };
};

export const mapFeaturedRequestToHubItem = (/** @type {Record<string, any>} */ event = {}) => {
  const requestId = String(event?.documentId || event?.id || '');
  const requestKind = normalizeString(event?.kind).toUpperCase();
  const eventEntity = event?.event || {};
  const eventId = String(eventEntity?.documentId || eventEntity?.id || '');
  const eventName = normalizeString(eventEntity?.name || eventEntity?.type?.name) || 'Evenement';
  const clubName = normalizeString(eventEntity?.team?.club?.name) || 'Club';
  const scopeLabelByKind = /** @type {Record<string, string>} */ ({
    CM: 'Multisport',
    PUBLIC: 'Public',
  });
  const scopeLabel = scopeLabelByKind[requestKind] || 'Club';
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
    subtitle: `${requesterName} demande une mise à la une ${scopeLabel.toLowerCase()}${targetName ? ` pour ${targetName}` : ''}.`,
    title: `Mise à la une ${scopeLabel} - ${eventName}`,
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
  const eventName = normalizeString(eventEntity?.name || eventEntity?.type?.name) || 'Evenement';
  const facilityName = normalizeString(request?.facility?.name) || 'Installation';
  const teamName = normalizeString(request?.team?.name) || 'Equipe';
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
    subtitle: `${teamName} demande une place supplementaire sur ${facilityName} (${overlapCount}/${maxSlots} slots deja pris).`,
    title: 'Exception installation',
    type: 'installation',
  };
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
  const opponentName = normalizeString(application?.team?.name) || 'Une equipe';
  const myTeamName = normalizeString(ad?.team?.name) || 'ton equipe';

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
    subtitle: `${opponentName} propose un match à ${myTeamName}.`,
    title: 'Proposition de match amical',
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
  const opponentName = normalizeString(ad?.team?.name) || 'Une equipe';

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
    subtitle: `Envoyée à ${opponentName}. En attente de sa réponse.`,
    title: 'Ta proposition de match',
    type: 'friendly',
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
    total: 0,
  };

  items.forEach((item) => {
    if (!item?.type || typeof counts[item.type] !== 'number') return;
    counts[item.type] += 1;
    counts.total += 1;
  });

  return counts;
};
