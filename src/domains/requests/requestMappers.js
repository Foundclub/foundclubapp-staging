/**
 * @typedef {'all' | 'team' | 'club' | 'event' | 'featured'} RequestHubFilter
 * @typedef {'team' | 'club' | 'event' | 'featured'} RequestHubType
 * @typedef {'pending'} RequestHubStatus
 * @typedef {'accept' | 'reject' | 'validate'} RequestHubAction
 *
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
    requester?.firstname || requester?.firstName || requester?.requesterFirstname
  );
  const lastname = normalizeString(
    requester?.lastname || requester?.lastName || requester?.requesterLastname
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

/**
 * @param {Record<string, any>} request
 * @returns {RequestHubItem}
 */
export const mapTeamMembershipRequestToHubItem = (request = {}) => {
  const requestId = String(request?.documentId || request?.id || '');
  const teamName = normalizeString(request?.team?.name) || 'Equipe';
  const requesterName = resolveRequesterName(request?.user || {});

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt),
    id: `team:${requestId}`,
    meta: {
      raw: request,
      requestId,
      requesterId: normalizeString(request?.user?.documentId),
      requesterName,
      teamId: normalizeString(request?.team?.documentId),
      teamName,
    },
    status: 'pending',
    subtitle: `${requesterName} souhaite rejoindre ${teamName}.`,
    title: 'Demande adhesion equipe',
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

  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: toIsoString(request?.createdAt),
    id: `club:${requestId}`,
    meta: {
      clubId: normalizeString(request?.club?.documentId),
      clubName,
      raw: request,
      requestId,
      requesterId: normalizeString(requester?.documentId || request?.user?.documentId),
      requesterName,
    },
    status: 'pending',
    subtitle: `${requesterName} demande une affiliation au club ${clubName}.`,
    title: 'Demande affiliation club',
    type: 'club',
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
    title: 'Validation evenement',
    type: 'event',
  };
};

/**
 * @param {Record<string, any>} event
 * @returns {RequestHubItem}
 */
export const mapFeaturedRequestToHubItem = (event = {}) => {
  const eventId = String(event?.documentId || event?.id || '');
  const eventName = normalizeString(event?.name || event?.type?.name) || 'Evenement';
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
    subtitle: `${clubName} demande une mise a la une.`,
    title: `Mise a la une - ${eventName}`,
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

