import { getClubInterestRequests } from '@/services/clubInterestRequest/clubInterestRequestService';
import {
  getClubMembershipRequests,
} from '@/services/clubMembershipRequest/clubMembershipRequestService';
import {
  getEvents,
  getPendingEventParticipationRequestsForHub,
  getPendingFeaturedRequests,
} from '@/services/event/eventService';
import { getPendingFacilityOverrideRequests } from '@/services/facility/facilityService';
import {
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';
import {
  getTeamMembershipRequests,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { getRequestsHubData } from '../requestsHubService';

/**
 * DEMR / T1 — « DEMANDES » NE LIT PLUS TOUTES LES ACTIVITES DU CLUB.
 *
 * 🔎 MESURE EN PRODUCTION LE 16/09 : une ouverture de l'onglet par un dirigeant du
 * club de demonstration (323 activites a venir) = 7 lectures `GET /events` de
 * ~9 s, l'une apres l'autre. 7 = arrondi superieur de 323 / 50 : la source
 * « event » parcourait TOUTES les activites a venir pour y chercher les
 * demandes de participation en attente.
 *
 * Le serveur est simule tel qu'il repond aujourd'hui : le chemin « split » de
 * `event.find` ne relit jamais plus de 90 lignes par moitie — une demande posee
 * au-dela (ici, sur la 200e activite) ne sort sur AUCUNE page.
 *
 * Ce que ce fichier verrouille :
 *   1. une lecture du hub fait UN appel pour cette source, quel que soit le
 *      nombre d'activites, et montre les 3 demandes ;
 *   2. tant que le serveur n'a pas la route (404), repli sur l'ancien chemin
 *      LIMITE A LA PREMIERE PAGE, sans banniere d'erreur ;
 *   3. une vraie panne de la route se dit, et ne declenche aucun repli.
 */

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  getClubInterestRequests: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(),
  getMyPendingEventTeamInvitations: jest.fn(async () => []),
  getPendingEventParticipationRequestsForHub: jest.fn(),
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

const PAGE_SIZE = 50;
const UPCOMING_COUNT = 323;
// Le plafond du chemin « split » (admin, event.ts : EVENT_VISIBILITY_SPLIT_MAX_ITEMS
// = 90 par moitie, fusion <= 180) : au-dela, aucune page ne rend plus rien.
const SPLIT_WINDOW = 180;
const WANTED_INDEXES = [0, 121, 200];

const PAGE_VIDE = {
  data: [],
  meta: {
    pagination: {
      page: 1, pageCount: 1, pageSize: PAGE_SIZE, total: 0,
    },
  },
};

const pendingRequest = (index) => ({
  createdAt: '2026-09-16T08:00:00.000Z',
  documentId: `request-${index}`,
  isActive: true,
  participationStatus: 'pending',
  sourceTeam: { documentId: 'team-ext', name: 'Exterieurs' },
  user: { documentId: `user-${index}`, firstname: 'Joueur', lastname: `N${index}` },
});

const buildActivity = (index) => ({
  date: new Date(Date.UTC(2026, 8, 17) + index * 3600 * 1000).toISOString(),
  documentId: `event-${index}`,
  name: `Seance ${index}`,
  participationRequests: WANTED_INDEXES.includes(index) ? [pendingRequest(index)] : [],
  team: { documentId: 'team-1', name: 'Senior' },
  type: { documentId: 'type-1', name: 'Entrainement' },
});

const ACTIVITIES = Array.from({ length: UPCOMING_COUNT }, (_, index) => buildActivity(index));

/**
 * `GET /events` tel qu'il repond aujourd'hui au hub : 50 par page, pages
 * comptees sur le total, fenetre plafonnee a 180.
 * @param {{ page?: number, pageSize?: number }} params La page demandee.
 * @returns {Promise<any>} La page.
 */
const simulerEventsFind = async ({ page = 1, pageSize = PAGE_SIZE } = {}) => {
  const visible = ACTIVITIES.slice(0, SPLIT_WINDOW);
  const start = (page - 1) * pageSize;
  return {
    data: visible.slice(start, start + pageSize),
    meta: {
      pagination: {
        page,
        pageCount: Math.ceil(UPCOMING_COUNT / pageSize),
        pageSize,
        total: UPCOMING_COUNT,
      },
    },
  };
};

/**
 * La route dediee : les seules activites qui portent une demande en attente.
 * @returns {Promise<any>} La reponse.
 */
const simulerRouteDediee = async () => ({
  data: ACTIVITIES.filter((activity) => activity.participationRequests.length > 0),
  meta: { limit: 200, total: WANTED_INDEXES.length, truncated: false },
});

const eventItemIds = (result) => result.items
  .filter((item) => item.type === 'event')
  .map((item) => item.id)
  .sort();

const appelsSourceEvenement = () => (
  /** @type {jest.Mock} */ (getEvents).mock.calls.length
  + /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub).mock.calls.length
);

describe('DEMR / T1 — la source « event » du hub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    /** @type {jest.Mock} */ (getClubInterestRequests).mockResolvedValue(PAGE_VIDE);
    /** @type {jest.Mock} */ (getClubMembershipRequests).mockResolvedValue(PAGE_VIDE);
    /** @type {jest.Mock} */ (getEvents).mockImplementation(simulerEventsFind);
    /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub)
      .mockImplementation(simulerRouteDediee);
    /** @type {jest.Mock} */ (getPendingFeaturedRequests).mockResolvedValue({ data: [] });
    /** @type {jest.Mock} */ (getPendingFacilityOverrideRequests).mockResolvedValue({ data: [] });
    /** @type {jest.Mock} */ (getMyFriendlyMatchAds).mockResolvedValue([]);
    /** @type {jest.Mock} */ (getMyFriendlyMatchApplications).mockResolvedValue([]);
    /** @type {jest.Mock} */ (getTeamMembershipRequests).mockResolvedValue(PAGE_VIDE);
  });

  it('T1.1 — 323 activites a venir : UN appel, et les 3 demandes (200e comprise)', async () => {
    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect({ appels: appelsSourceEvenement() }).toEqual({ appels: 1 });
    expect(eventItemIds(result)).toEqual([
      'event:event-0:participation:request-0',
      'event:event-121:participation:request-121',
      'event:event-200:participation:request-200',
    ]);
    expect(result.errors).toEqual([]);
  });

  it('T1.2 — la route dediee recoit le club et rien d autre', async () => {
    await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-9'] });

    expect(getPendingEventParticipationRequestsForHub).toHaveBeenCalledTimes(1);
    expect(/** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub).mock.calls[0][0])
      .toEqual({ clubId: 'club-1' });
  });

  it('T1.3 — serveur pas a jour (404) : repli sur la PREMIERE PAGE, sans banniere', async () => {
    /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub)
      .mockRejectedValue({ message: 'Not Found', name: 'NotFoundError', status: 404 });

    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect(getEvents).toHaveBeenCalledTimes(1);
    expect(/** @type {jest.Mock} */ (getEvents).mock.calls[0][0]).toEqual(expect.objectContaining({
      club: expect.objectContaining({ value: 'club-1' }),
      page: 1,
      pageSize: PAGE_SIZE,
      requestHub: true,
    }));
    // La premiere page porte la demande de la 1re activite ; les autres sont
    // hors de portee du repli, et c'est assume jusqu'a la mise en ligne.
    expect(eventItemIds(result)).toEqual(['event:event-0:participation:request-0']);
    expect(result.errors).toEqual([]);
  });

  it('T1.4 — une vraie panne de la route se dit, et ne relance PAS l ancien parcours', async () => {
    /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub)
      .mockRejectedValue({
        message: 'Internal Server Error', name: 'ApplicationError', status: 500,
      });

    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect(getEvents).not.toHaveBeenCalled();
    expect(result.errors).toEqual([
      expect.objectContaining({ source: 'event', status: 500 }),
    ]);
  });

  it('T1.5 — un refus (403) reste silencieux, comme pour les autres sources', async () => {
    /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub)
      .mockRejectedValue({ message: 'Forbidden', name: 'ForbiddenError', status: 403 });

    const result = await getRequestsHubData({ clubId: 'club-1' });

    expect(getEvents).not.toHaveBeenCalled();
    expect(result.errors).toEqual([]);
    expect(eventItemIds(result)).toEqual([]);
  });
});
