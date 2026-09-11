import { getClubInterestRequests } from '@/services/clubInterestRequest/clubInterestRequestService';
import {
  getClubMembershipRequests,
} from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { getEvents, getPendingFeaturedRequests } from '@/services/event/eventService';
import { getPendingFacilityOverrideRequests } from '@/services/facility/facilityService';
import {
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';
import {
  getTeamMembershipRequests,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { getRequestsHubData } from '../requestsHubService';

// 👶 PARENT P3 (2026-09-11) — « DEMANDES » DOIT DEMANDER LES LIGNES D ENFANT.
// Le serveur ne les rend qu'aux clients qui le disent (`includeChildRequests`) :
// c'est ce qui les cache aux apps deja installees. Cet ecran-ci sait les trancher,
// il doit donc le dire — sur les DEUX lectures, par equipe et par club.

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  getClubInterestRequests: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(),
  getMyPendingEventTeamInvitations: jest.fn(async () => []),
  getPendingFeaturedRequests: jest.fn(),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getPendingFacilityOverrideRequests: jest.fn(),
}));

jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: jest.fn(),
  getMyFriendlyMatchApplications: jest.fn(),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  getTeamMembershipRequests: jest.fn(),
}));

const PAGE_VIDE = {
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

describe('P3 — « Demandes » et les places demandees pour un enfant', () => {
  beforeEach(() => {
    getClubInterestRequests.mockResolvedValue(PAGE_VIDE);
    getClubMembershipRequests.mockResolvedValue(PAGE_VIDE);
    getEvents.mockResolvedValue(PAGE_VIDE);
    getPendingFeaturedRequests.mockResolvedValue({ data: [] });
    getPendingFacilityOverrideRequests.mockResolvedValue({ data: [] });
    getMyFriendlyMatchAds.mockResolvedValue([]);
    getMyFriendlyMatchApplications.mockResolvedValue([]);
    getTeamMembershipRequests.mockResolvedValue(PAGE_VIDE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('les DEUX lectures des interets demandent les lignes d enfant', async () => {
    await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-u11'] });

    expect(getClubInterestRequests).toHaveBeenCalledTimes(2);
    getClubInterestRequests.mock.calls.forEach(([params]) => {
      expect(params.includeChildRequests).toBe(true);
    });
  });

  test('une place pour un enfant arrive dans « Demandes » avec Accepter / Refuser', async () => {
    getClubInterestRequests.mockResolvedValue({
      ...PAGE_VIDE,
      data: [{
        club: { documentId: 'club-1', name: 'FC Test' },
        declaredChild: { age: 7, documentId: 'enfant-lea', firstname: 'Léa' },
        documentId: 'interest-lea',
        status: 'pending',
        team: { documentId: 'team-u11', name: 'U11' },
        user: { documentId: 'parent-1', firstname: 'Karim', lastname: 'Benali' },
      }],
    });

    const resultat = await getRequestsHubData({ teamIds: ['team-u11'] });

    expect(resultat.items).toHaveLength(1);
    expect(resultat.items[0]).toEqual(expect.objectContaining({
      actions: { primary: 'accept', secondary: 'reject' },
      id: 'interest:interest-lea',
      type: 'interest',
    }));
  });
});
