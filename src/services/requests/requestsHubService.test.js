import { getClubMembershipRequests } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { getEvents, getPendingFeaturedRequests } from '@/services/event/eventService';
import { getPendingFacilityOverrideRequests } from '@/services/facility/facilityService';
import { getTeamMembershipRequests } from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { getRequestsHubData } from './requestsHubService';

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(),
  getPendingFeaturedRequests: jest.fn(),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getPendingFacilityOverrideRequests: jest.fn(),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  getTeamMembershipRequests: jest.fn(),
}));

const emptyPaginatedResponse = {
  data: [],
  meta: {
    pagination: {
      page: 1,
      pageCount: 1,
      pageSize: 50,
      total: 0,
    },
  },
};

describe('requestsHubService', () => {
  beforeEach(() => {
    getClubMembershipRequests.mockResolvedValue(emptyPaginatedResponse);
    getEvents.mockResolvedValue(emptyPaginatedResponse);
    getPendingFeaturedRequests.mockResolvedValue({ data: [] });
    getPendingFacilityOverrideRequests.mockResolvedValue({ data: [] });
    getTeamMembershipRequests.mockResolvedValue(emptyPaginatedResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('keeps event participation requests when a pending request exists', async () => {
    getEvents.mockResolvedValue({
      data: [
        {
          documentId: 'event-1',
          participationRequests: [
            {
              createdAt: '2026-03-27T15:00:00.000Z',
              documentId: 'request-1',
              participationStatus: 'pending',
              user: {
                documentId: 'user-1',
                firstname: 'Leo',
                lastname: 'Martin',
              },
            },
          ],
          team: { name: 'Senior 2' },
          type: { name: 'Detection / Seance d essai' },
          validationMode: 'manual',
        },
      ],
      meta: emptyPaginatedResponse.meta,
    });

    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 'event:event-1:participation:request-1',
      title: 'Validation evenement',
      type: 'event',
    }));
  });

  test('does not recreate a legacy event validation card when no pending request remains', async () => {
    getEvents.mockResolvedValue({
      data: [
        {
          documentId: 'event-1',
          participationRequests: [],
          team: { name: 'Senior 2' },
          type: { name: 'Detection / Seance d essai' },
          validationMode: 'manual',
        },
      ],
      meta: emptyPaginatedResponse.meta,
    });

    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect(result.items).toEqual([]);
    expect(result.counts).toEqual({
      club: 0,
      event: 0,
      featured: 0,
      installation: 0,
      team: 0,
      total: 0,
    });
  });
});
