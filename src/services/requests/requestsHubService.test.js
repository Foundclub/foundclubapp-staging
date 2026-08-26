import { getClubInterestRequests } from '@/services/clubInterestRequest/clubInterestRequestService';
import { getClubMembershipRequests } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { getEvents, getPendingFeaturedRequests } from '@/services/event/eventService';
import { getPendingFacilityOverrideRequests } from '@/services/facility/facilityService';
import {
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';
import { getTeamMembershipRequests } from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { getRequestsHubData } from './requestsHubService';

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
    getClubInterestRequests.mockResolvedValue(emptyPaginatedResponse);
    getClubMembershipRequests.mockResolvedValue(emptyPaginatedResponse);
    getEvents.mockResolvedValue(emptyPaginatedResponse);
    getPendingFeaturedRequests.mockResolvedValue({ data: [] });
    getPendingFacilityOverrideRequests.mockResolvedValue({ data: [] });
    getMyFriendlyMatchAds.mockResolvedValue([]);
    getMyFriendlyMatchApplications.mockResolvedValue([]);
    getTeamMembershipRequests.mockResolvedValue(emptyPaginatedResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('keeps pending event participation requests even after a training is closed again', async () => {
    getEvents.mockResolvedValue({
      data: [
        {
          documentId: 'event-1',
          externalParticipantLimit: 3,
          externalParticipantValidationMode: 'manual',
          participationRequests: [
            {
              createdAt: '2026-03-27T15:00:00.000Z',
              documentId: 'request-1',
              isActive: true,
              participationStatus: 'pending',
              user: {
                documentId: 'user-1',
                firstname: 'Leo',
                lastname: 'Martin',
              },
            },
          ],
          sessionStatus: 'closed',
          team: { name: 'Senior 2' },
          type: { name: 'Detection / Seance d essai' },
        },
      ],
      meta: emptyPaginatedResponse.meta,
    });

    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 'event:event-1:participation:request-1',
      title: 'Validation événement',
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
      friendly: 0,
      installation: 0,
      interest: 0,
      team: 0,
      teamInvite: 0,
      total: 0,
    });
  });

  test('maps pending club interest requests into the hub', async () => {
    getClubInterestRequests.mockResolvedValue({
      data: [
        {
          club: {
            documentId: 'club-1',
            name: 'FC Test',
          },
          documentId: 'interest-1',
          status: 'pending',
          team: {
            documentId: 'team-1',
            name: 'U19',
          },
          user: {
            documentId: 'user-1',
            firstname: 'Mina',
            lastname: 'Diallo',
          },
        },
      ],
      meta: emptyPaginatedResponse.meta,
    });

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      actions: { primary: 'respond', secondary: 'chat' },
      id: 'interest:interest-1',
      type: 'interest',
    }));
  });

  test('keeps owner-only team requests visible without action buttons', async () => {
    getTeamMembershipRequests.mockResolvedValue({
      data: [
        {
          documentId: 'team-request-1',
          permissions: {
            canManage: false,
            canView: true,
          },
          state: 'pending',
          team: {
            documentId: 'team-1',
            membershipRequestManagementMode: 'CLUB_OWNER_ONLY',
            name: 'U18',
          },
          user: {
            documentId: 'user-1',
            firstname: 'Leo',
            lastname: 'Martin',
          },
        },
      ],
      meta: emptyPaginatedResponse.meta,
    });

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      actions: {},
      id: 'team:team-request-1',
      subtitle: 'Leo Martin a demandé à rejoindre U18. Ton équipe doit attendre la validation par ton ou tes dirigeant(s).',
      type: 'team',
    }));
  });

  test('does not fetch installation requests when the user cannot manage them', async () => {
    await getRequestsHubData({
      canManageInstallationRequests: false,
      clubId: 'club-1',
    });

    expect(getPendingFacilityOverrideRequests).not.toHaveBeenCalled();
  });

  test('ignores forbidden installation source errors without surfacing a partial error', async () => {
    getPendingFacilityOverrideRequests.mockRejectedValue({
      message: 'Only club managers can process facility override requests',
      status: 403,
    });

    const result = await getRequestsHubData({
      canManageInstallationRequests: true,
      clubId: 'club-1',
    });

    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([]);
  });
});

/**
 * D92 — une proposition de match amical que personne ne voit est une
 * fonctionnalite qui n existe pas. Avant ce lot, `RequestsHub` ne parlait JAMAIS
 * des amicaux (`grep -ci friendly` rendait 0) : le destinataire recevait une
 * notification push, et rien d autre — ni ligne dans « Demandes », ni compteur.
 */
describe('D92 — les propositions de match amical arrivent dans « Demandes »', () => {
  const adWithPendingApplication = {
    applications: [
      {
        createdAt: '2026-08-12T09:00:00.000Z',
        documentId: 'application-1',
        status: 'pending',
        team: { club: { name: 'AS Voisine' }, documentId: 'team-adverse', name: 'U15 Voisine' },
      },
    ],
    candidateDates: [],
    documentId: 'ad-1',
    status: 'open',
    team: { documentId: 'team-1', name: 'U15 Maison' },
  };

  test('temoin 1 — le staff de l annonce VOIT la proposition recue', async () => {
    getMyFriendlyMatchAds.mockResolvedValue([adWithPendingApplication]);

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    const received = result.items.find((item) => item?.meta?.applicationId === 'application-1');
    expect(received).toBeDefined();
    expect(received.type).toBe('friendly');
    expect(received.meta.adId).toBe('ad-1');
    // Elle se compte, sinon la pastille de « Demandes » reste a zero.
    expect(result.counts.friendly).toBe(1);
    expect(result.counts.total).toBe(1);
  });

  test('temoin 1 bis — le nom de l equipe qui propose est dit, pas « Utilisateur »', async () => {
    getMyFriendlyMatchAds.mockResolvedValue([adWithPendingApplication]);

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(result.items[0].subtitle).toContain('U15 Voisine');
  });

  test('une proposition deja traitee ne revient pas encombrer la liste', async () => {
    getMyFriendlyMatchAds.mockResolvedValue([{
      ...adWithPendingApplication,
      applications: [{
        ...adWithPendingApplication.applications[0],
        status: 'declined',
      }],
    }]);

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(result.items).toEqual([]);
  });

  test('temoin 4 — l expediteur voit SA proposition « en attente »', async () => {
    getMyFriendlyMatchApplications.mockResolvedValue([{
      ...adWithPendingApplication,
      applicationStatus: 'pending',
      myApplication: {
        createdAt: '2026-08-12T10:00:00.000Z',
        documentId: 'application-mine',
        status: 'pending',
        team: { documentId: 'team-1', name: 'U15 Maison' },
      },
      team: { documentId: 'team-adverse', name: 'U15 Voisine' },
    }]);

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    const sent = result.items.find((item) => item?.meta?.applicationId === 'application-mine');
    expect(sent).toBeDefined();
    expect(sent.meta.isOutgoing).toBe(true);
    // Elle s affiche, mais elle ne se repond pas : c est l autre staff qui tranche.
    expect(sent.actions.primary).toBeUndefined();
    expect(sent.subtitle).toContain('U15 Voisine');
  });

  test('une source amicale en panne n efface pas le reste des demandes', async () => {
    // ⚠️ Y04 — LES DEUX MOITIES TOMBENT ICI, ET C EST EXPRES. Depuis ce lot, une
    // seule moitie en echec ne rend plus d erreur (l autre est servie). Ce
    // temoin-la parle d autre chose : quand la source amicale tombe pour de
    // bon, les demandes d equipe restent a l ecran.
    getMyFriendlyMatchAds.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    getMyFriendlyMatchApplications
      .mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    getTeamMembershipRequests.mockResolvedValue({
      ...emptyPaginatedResponse,
      data: [{
        createdAt: '2026-08-12T08:00:00.000Z',
        documentId: 'team-request-1',
        state: 'pending',
        team: { documentId: 'team-1', name: 'U15 Maison' },
        user: { documentId: 'user-9', firstname: 'Sam', lastname: 'Dupont' },
      }],
    });

    const result = await getRequestsHubData({ teamIds: ['team-1'] });

    expect(result.items).toHaveLength(1);
    expect(result.errors.map((error) => error.source)).toContain('friendly');
  });
});
