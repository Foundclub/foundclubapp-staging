/**
 * @typedef {'all' | 'team' | 'club' | 'event' | 'featured'} RequestHubFilter
 * @typedef {'team' | 'club' | 'event' | 'featured'} RequestHubType
 * @typedef {'pending'} RequestHubStatus
 * @typedef {'accept' | 'reject' | 'validate'} RequestHubAction
 * @typedef {object} RequestHubItem
 * @property {string} id
 * @property {RequestHubType} type
 * @property {RequestHubStatus} status
 * @property {string | null} createdAt
 * @property {string} title
 * @property {string} subtitle
 * @property {{ primary: RequestHubAction; secondary?: RequestHubAction }} actions
 * @property {Record<string, any>} meta
 */

export const REQUEST_HUB_FILTERS = /** @type {const} */ (['all', 'team', 'club', 'event', 'featured']);

const fallbackRequesterName = 'Utilisateur';

const normalizeString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const toIsoString = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const resolveRequesterName = (requester = {}) => {
  const firstname = normalizeString(
    requester?.firstname || requester?.firstName || requester?.requesterFirstname,
  );
  const lastname = normalizeString(
    requester?.lastname || requester?.lastName || requester?.requesterLastname,
  );
  const fullName = [firstname, lastname].filter(Boolean).join(' ').trim();

  if (fullName) return fullName;
  return normalizeString(requester?.displayName || requester?.username) || fallbackRequesterName;
};

const toStableTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  return date.getTime();
};

const resolveRequesterAvatarUrl = (requester = {}) => {
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
  const teamName = normalizeString(request?.team?.name) || 'Équipe';
  const requester = request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester);

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt),
    id: `team:${requestId}`,
    meta: {
      raw: request,
      requesterAvatarUrl,
      requesterId: normalizeString(request?.user?.documentId),
      requesterName,
      requestId,
      teamId: normalizeString(request?.team?.documentId),
      teamName,
    },
    status: 'pending',
    subtitle: `${requesterName} souhaite rejoindre ${teamName}.`,
    title: 'Demande adhésion équipe',
    type: 'team',
  };
};

/**
 * @param {Record<string, any>} request
 * @returns {RequestHubItem}
 */
export const mapClubMembershipRequestToHubItem = (request = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  const clubName = normalizeString(request?.club?.name) || 'Club';
  const requester = request?.requester || request?.user || {};
  const requesterName = resolveRequesterName(requester);
  const requesterAvatarUrl = resolveRequesterAvatarUrl(requester)
    || resolveRequesterAvatarUrl(request?.user || {});
  const requestType = normalizeString(request?.type) === 'claim' ? 'claim' : 'join';
  const title = requestType === 'claim'
    ? 'Revendication club'
    : 'Demande affiliation club';
  const subtitle = requestType === 'claim'
    ? `${requesterName} veut revendiquer la gestion du club ${clubName}.`
    : `${requesterName} demande une affiliation au club ${clubName}.`;

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt),
    id: `club:${requestId}`,
    meta: {
      clubId: normalizeString(request?.club?.documentId),
      clubName,
      raw: request,
      requesterAvatarUrl,
      requesterId: normalizeString(requester?.documentId || request?.user?.documentId),
      requesterName,
      requestId,
      requestType,
    },
    status: 'pending',
    subtitle,
    title,
    type: 'club',
  };
};

/**
 * @param {Record<string, any>} event
 * @returns {RequestHubItem}
 */
export const mapEventValidationRequestToHubItem = (event = {}) => {
  const eventId = String(event?.documentId || event?.id || '');
  const teamName = normalizeString(event?.team?.name) || 'Équipe';
  const eventName = normalizeString(event?.name || event?.type?.name) || 'Événement';
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
 * @returns {RequestHubItem}
 */
export const mapFeaturedRequestToHubItem = (event = {}) => {
  const eventId = String(event?.documentId || event?.id || '');
  const eventName = normalizeString(event?.name || event?.type?.name) || 'Événement';
  const clubName = normalizeString(event?.team?.club?.name) || 'Club';

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(event?.createdAt) || toIsoString(event?.date),
    id: `featured:${eventId}`,
    meta: {
      clubName,
      eventId,
      eventName,
      raw: event,
    },
    status: 'pending',
    subtitle: `${clubName} demande une mise à la une.`,
    title: `Mise à la une - ${eventName}`,
    type: 'featured',
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
  const counts = {
    club: 0,
    event: 0,
    featured: 0,
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
