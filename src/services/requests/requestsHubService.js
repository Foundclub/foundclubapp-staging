import {
  buildRequestHubCounts,
  mapClubInterestRequestToHubItem,
  mapClubMembershipRequestToHubItem,
  mapEventParticipationRequestToHubItem,
  mapFacilityOverrideRequestToHubItem,
  mapFeaturedRequestToHubItem,
  mapTeamMembershipRequestToHubItem,
  sortRequestHubItems,
} from '@/domains/requests/requestMappers';

import { getClubInterestRequests } from '@/services/clubInterestRequest/clubInterestRequestService';
import { getClubMembershipRequests } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { getEvents, getPendingFeaturedRequests } from '@/services/event/eventService';
import { getPendingFacilityOverrideRequests } from '@/services/facility/facilityService';
import { getTeamMembershipRequests } from '@/services/teamMembershipRequest/teamMembershipRequestService';

const toUniqueIds = (values = []) => (
  [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))]
);

const toBoolean = (value) => value === true;

const toErrorMessage = (error) => {
  if (!error) return 'Erreur inconnue';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  return 'Erreur inconnue';
};

const toErrorStatus = (error) => (
  error?.status
  || error?.response?.status
  || error?.error?.status
  || null
);

/**
 * @typedef {object} RequestsHubContext
 * @property {boolean} canManageInstallationRequests
 * @property {string[]} teamIds
 * @property {string} clubId
 * @property {string} cmId
 */

/**
 * @param {Partial<RequestsHubContext>} context
 * @returns {RequestsHubContext}
 */
export const normalizeRequestsHubContext = (context = {}) => ({
  canManageInstallationRequests: toBoolean(context?.canManageInstallationRequests),
  clubId: String(context?.clubId || '').trim(),
  cmId: String(context?.cmId || '').trim(),
  teamIds: toUniqueIds(context?.teamIds || []),
});

/**
 * @param {RequestsHubContext} context
 */
export const hasAnyRequestsContext = (context) => (
  Boolean(context?.clubId || context?.cmId || (context?.teamIds || []).length)
);

const fetchAllPages = async (fetchPage) => {
  let currentPage = 1;
  const collected = [];

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetchPage(currentPage);
    const pageItems = Array.isArray(response?.data) ? response.data : [];
    collected.push(...pageItems);

    const pagination = response?.meta?.pagination;
    if (!pagination?.pageCount || currentPage >= pagination.pageCount) {
      break;
    }

    currentPage += 1;
  }

  return collected;
};

const mergeRequestsById = (entries = []) => {
  const byId = new Map();
  entries.forEach((entry) => {
    const id = String(entry?.documentId || entry?.id || '').trim();
    if (!id || byId.has(id)) return;
    byId.set(id, entry);
  });
  return Array.from(byId.values());
};

const fetchTeamRequests = async ({ clubId, teamIds }) => {
  const jobs = [];

  if (teamIds.length) {
    jobs.push(fetchAllPages((page) => getTeamMembershipRequests(teamIds, {
      page,
      pageSize: 50,
    })));
  }

  if (clubId) {
    jobs.push(fetchAllPages((page) => getTeamMembershipRequests([], {
      clubId,
      page,
      pageSize: 50,
    })));
  }

  if (!jobs.length) return [];

  const settled = await Promise.all(jobs);
  return mergeRequestsById(settled.flat());
};

const fetchClubRequests = async (clubId) => {
  if (!clubId) return [];

  return fetchAllPages((page) => getClubMembershipRequests(clubId, {
    page,
    pageSize: 50,
  }));
};

/**
 * @param {{ clubId?: string; teamIds?: string[] }} params
 */
const fetchClubInterestRequests = async ({ clubId = '', teamIds = [] }) => {
  const jobs = [];

  if (teamIds.length) {
    jobs.push(fetchAllPages((/** @type {number} */ page) => getClubInterestRequests({
      page,
      pageSize: 50,
      teamIds,
    })));
  }

  if (clubId) {
    jobs.push(fetchAllPages((/** @type {number} */ page) => getClubInterestRequests({
      clubId,
      page,
      pageSize: 50,
    })));
  }

  if (!jobs.length) return [];

  const settled = await Promise.all(jobs);
  return mergeRequestsById(settled.flat());
};

const fetchEventValidationRequests = async (clubId) => {
  if (!clubId) return [];

  return fetchAllPages((page) => getEvents({
    club: { value: clubId },
    page,
    pageSize: 50,
    requestHub: true,
    startDateAfter: new Date(),
  }));
};

const fetchFeaturedRequests = async ({ clubId, cmId }) => {
  if (!clubId && !cmId) return [];
  const response = await getPendingFeaturedRequests({ clubId, cmId });
  return Array.isArray(response?.data) ? response.data : [];
};

const fetchFacilityRequests = async (clubId) => {
  if (!clubId) return [];
  const response = await getPendingFacilityOverrideRequests(clubId);
  return Array.isArray(response?.data) ? response.data : [];
};

const getPendingParticipationRequests = (event) => (
  Array.isArray(event?.participationRequests)
    ? event.participationRequests.filter(
      (request) => request?.participationStatus === 'pending' && request?.isActive !== false,
    )
    : []
);

export const EMPTY_REQUESTS_HUB_DATA = {
  counts: buildRequestHubCounts([]),
  errors: [],
  items: [],
};

/**
 * @param {Partial<RequestsHubContext>} rawContext
 */
export const getRequestsHubData = async (rawContext = {}) => {
  const context = normalizeRequestsHubContext(rawContext);
  if (!hasAnyRequestsContext(context)) {
    return EMPTY_REQUESTS_HUB_DATA;
  }

  const sources = [
    {
      enabled: context.teamIds.length > 0 || Boolean(context.clubId),
      fetcher: () => fetchTeamRequests({ clubId: context.clubId, teamIds: context.teamIds }),
      key: 'team',
    },
    {
      enabled: Boolean(context.clubId),
      fetcher: () => fetchClubRequests(context.clubId),
      key: 'club',
    },
    {
      enabled: Boolean(context.clubId),
      fetcher: () => fetchEventValidationRequests(context.clubId),
      key: 'event',
    },
    {
      enabled: Boolean(context.clubId || context.cmId),
      fetcher: () => fetchFeaturedRequests({ clubId: context.clubId, cmId: context.cmId }),
      key: 'featured',
    },
    {
      enabled: Boolean(context.clubId) && context.canManageInstallationRequests,
      fetcher: () => fetchFacilityRequests(context.clubId),
      key: 'installation',
    },
    {
      enabled: context.teamIds.length > 0 || Boolean(context.clubId),
      fetcher: () => fetchClubInterestRequests({ clubId: context.clubId, teamIds: context.teamIds }),
      key: 'interest',
    },
  ];

  const enabledSources = sources.filter((source) => source.enabled);
  const settled = await Promise.allSettled(enabledSources.map((source) => source.fetcher()));

  const errors = [];
  const items = [];

  settled.forEach((result, index) => {
    const source = enabledSources[index];
    if (result.status === 'rejected') {
      if (source.key === 'installation' && toErrorStatus(result.reason) === 403) {
        return;
      }
      errors.push({
        message: toErrorMessage(result.reason),
        source: source.key,
        status: toErrorStatus(result.reason),
      });
      return;
    }

    const entries = Array.isArray(result.value) ? result.value : [];

    if (source.key === 'team') {
      items.push(
        ...entries
          .filter((request) => request?.state === 'pending')
          .map(mapTeamMembershipRequestToHubItem),
      );
    }

    if (source.key === 'club') {
      items.push(
        ...entries
          .filter((request) => request?.state === 'pending')
          .map(mapClubMembershipRequestToHubItem),
      );
    }

    if (source.key === 'event') {
      entries
        .forEach((event) => {
          const pendingRequests = getPendingParticipationRequests(event);

          if (!pendingRequests.length) return;

          items.push(
            ...pendingRequests.map((request) => mapEventParticipationRequestToHubItem(event, request)),
          );
        });
    }

    if (source.key === 'featured') {
      items.push(...entries.map(mapFeaturedRequestToHubItem));
    }

    if (source.key === 'installation') {
      items.push(...entries.map(mapFacilityOverrideRequestToHubItem));
    }

    if (source.key === 'interest') {
      items.push(
        ...entries
          .filter((request) => request?.status === 'pending')
          .map(mapClubInterestRequestToHubItem),
      );
    }
  });

  const sortedItems = sortRequestHubItems(items);

  return {
    counts: buildRequestHubCounts(sortedItems),
    errors,
    items: sortedItems,
  };
};
