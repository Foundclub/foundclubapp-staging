import {
  buildRequestHubCounts,
  mapClubMembershipRequestToHubItem,
  mapEventParticipationRequestToHubItem,
  mapEventValidationRequestToHubItem,
  mapFeaturedRequestToHubItem,
  mapTeamMembershipRequestToHubItem,
  sortRequestHubItems,
} from '@/domains/requests/requestMappers';

import { getClubMembershipRequests } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { getEvents, getPendingFeaturedRequests } from '@/services/event/eventService';
import { getTeamMembershipRequests } from '@/services/teamMembershipRequest/teamMembershipRequestService';

const toUniqueIds = (values = []) => (
  [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))]
);

const toErrorMessage = (error) => {
  if (!error) return 'Erreur inconnue';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  return 'Erreur inconnue';
};

/**
 * @typedef {object} RequestsHubContext
 * @property {string[]} teamIds
 * @property {string} clubId
 * @property {string} cmId
 */

/**
 * @param {Partial<RequestsHubContext>} context
 * @returns {RequestsHubContext}
 */
export const normalizeRequestsHubContext = (context = {}) => ({
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

const fetchTeamRequests = async (teamIds) => {
  if (!teamIds.length) return [];

  return fetchAllPages((page) => getTeamMembershipRequests(teamIds, {
    page,
    pageSize: 50,
  }));
};

const fetchClubRequests = async (clubId) => {
  if (!clubId) return [];

  return fetchAllPages((page) => getClubMembershipRequests(clubId, {
    page,
    pageSize: 50,
  }));
};

const fetchEventValidationRequests = async (clubId) => {
  if (!clubId) return [];

  return fetchAllPages((page) => getEvents({
    club: { value: clubId },
    page,
    pageSize: 50,
    sessionStatus: 'open',
    startDateAfter: new Date(),
    validationMode: 'manual',
  }));
};

const fetchFeaturedRequests = async (cmId) => {
  if (!cmId) return [];
  const response = await getPendingFeaturedRequests(cmId);
  return Array.isArray(response?.data) ? response.data : [];
};

const getPendingParticipationRequests = (event) => (
  Array.isArray(event?.participationRequests)
    ? event.participationRequests.filter(
      (request) => request?.participationStatus === 'pending' && request?.isActive !== false,
    )
    : []
);

/**
 * @param {Partial<RequestsHubContext>} rawContext
 */
export const getRequestsHubData = async (rawContext = {}) => {
  const context = normalizeRequestsHubContext(rawContext);
  if (!hasAnyRequestsContext(context)) {
    return {
      counts: buildRequestHubCounts([]),
      errors: [],
      items: [],
    };
  }

  const sources = [
    {
      enabled: context.teamIds.length > 0,
      fetcher: () => fetchTeamRequests(context.teamIds),
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
      enabled: Boolean(context.cmId),
      fetcher: () => fetchFeaturedRequests(context.cmId),
      key: 'featured',
    },
  ];

  const enabledSources = sources.filter((source) => source.enabled);
  const settled = await Promise.allSettled(enabledSources.map((source) => source.fetcher()));

  const errors = [];
  const items = [];

  settled.forEach((result, index) => {
    const source = enabledSources[index];
    if (result.status === 'rejected') {
      errors.push({
        message: toErrorMessage(result.reason),
        source: source.key,
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
        .filter((event) => event?.validationMode === 'manual')
        .forEach((event) => {
          const pendingRequests = getPendingParticipationRequests(event);

          if (pendingRequests.length > 0) {
            items.push(
              ...pendingRequests.map((request) => mapEventParticipationRequestToHubItem(event, request)),
            );
            return;
          }

          items.push(mapEventValidationRequestToHubItem(event));
        });
    }

    if (source.key === 'featured') {
      items.push(...entries.map(mapFeaturedRequestToHubItem));
    }
  });

  const sortedItems = sortRequestHubItems(items);

  return {
    counts: buildRequestHubCounts(sortedItems),
    errors,
    items: sortedItems,
  };
};
