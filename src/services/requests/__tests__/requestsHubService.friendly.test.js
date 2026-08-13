import { getRequestsHubData } from '../requestsHubService';

/**
 * R02 — pourquoi les propositions de match amical n'apparaissent pas dans
 * « Demandes », et pourquoi ce N'EST PAS le 403 de `club-request`.
 *
 * 🔎 CE QUE CE FILET ETABLIT, ET QUI SE LISAIT NULLE PART :
 *
 * `getRequestsHubData` agrege SEPT sources. Aucune n'appelle `/club-requests` —
 * la banniere « Certaines demandes n'ont pas pu etre chargees » ne peut donc pas
 * venir de ce 403. C'est un defaut a part.
 *
 * La source `friendly` (D92) est conditionnee a `teamIds.length > 0`, et
 * `RequestsHub.js:152-155` alimente `teamIds` avec `userData.trainedTeams` —
 * les equipes qu'on ENTRAINE. Un dirigeant qui gere son club sans entrainer
 * d'equipe a donc `teamIds: []`, et la source est coupee AVANT tout appel
 * reseau : zero proposition a l'ecran, zero erreur, zero trace.
 *
 * ⚠️ Or le serveur, lui, l'autorise : `team/services/auth.ts:92-112` accorde la
 * gestion d'une equipe au staff `dirigeant`/`president` du club, pas seulement a
 * ses entraineurs. L'app est donc plus stricte que le serveur — et c'est l'app
 * qui prive le dirigeant, pas une permission manquante.
 *
 * ⛔ Ce lot ne CORRIGE pas cet ecart : elargir le perimetre des equipes changerait
 * aussi les sources `team` et `interest`, qui partagent `teamIds`. Il le mesure
 * et le verrouille pour que le lot qui s'en chargera parte d'un temoin rouge.
 */

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  getClubInterestRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(async () => ({ data: [] })),
  getPendingFeaturedRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getPendingFacilityOverrideRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  getTeamMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

const mockGetMyFriendlyMatchAds = jest.fn();
const mockGetMyFriendlyMatchApplications = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: (...args) => mockGetMyFriendlyMatchAds(...args),
  getMyFriendlyMatchApplications: (...args) => mockGetMyFriendlyMatchApplications(...args),
}));

const AD_WITH_PENDING_APPLICATION = {
  applications: [
    {
      applicant: { documentId: 'user-9' },
      documentId: 'app-1',
      status: 'pending',
      team: { documentId: 'team-adverse', name: 'US Voisine' },
    },
  ],
  documentId: 'ad-1',
  team: { documentId: 'team-1', name: 'U15 Maison' },
};

describe('R02 — la source « match amical » de l ecran Demandes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyFriendlyMatchAds.mockResolvedValue([AD_WITH_PENDING_APPLICATION]);
    mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('temoin — un dirigeant SANS equipe entrainee n a AUCUNE proposition, et rien n est meme demande au serveur', async () => {
    const data = await getRequestsHubData({
      clubId: 'club-1',
      teamIds: [],
    });

    expect(mockGetMyFriendlyMatchAds).not.toHaveBeenCalled();
    expect(mockGetMyFriendlyMatchApplications).not.toHaveBeenCalled();
    expect(data.items.filter((item) => item.type === 'friendly')).toHaveLength(0);
    // 🔑 Et surtout : AUCUNE erreur. L'ecran ne peut donc rien signaler.
    expect(data.errors).toHaveLength(0);
  });

  it('temoin de controle — avec une equipe entrainee, la meme proposition arrive bien', async () => {
    const data = await getRequestsHubData({
      clubId: 'club-1',
      teamIds: ['team-1'],
    });

    expect(mockGetMyFriendlyMatchAds).toHaveBeenCalled();
    expect(data.items.filter((item) => item.type === 'friendly')).toHaveLength(1);
  });

  it('temoin — une source en echec est nommee par sa clef, jamais fondue dans les autres', async () => {
    const failure = Object.assign(new Error('Forbidden'), { status: 403 });
    mockGetMyFriendlyMatchAds.mockRejectedValue(failure);

    const data = await getRequestsHubData({
      clubId: 'club-1',
      teamIds: ['team-1'],
    });

    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].source).toBe('friendly');
    expect(data.errors[0].status).toBe(403);
  });
});
