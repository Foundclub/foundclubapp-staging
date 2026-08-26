import { getRequestsHubData } from '../requestsHubService';

/**
 * Y04 — LA SOURCE « MATCH AMICAL » DE L ECRAN DEMANDES, ET SES DEUX PANNES.
 *
 * 🎁 Ce fichier reprend les trois temoins poses par R02. Ils decrivaient un
 * DEFAUT et etaient verts a ce titre ; ce lot les retourne, comme R02 l avait
 * annonce (« il le verrouille pour que le lot qui s en chargera parte d un
 * rouge »).
 *
 * 🚨 LES DEUX PANNES SONT DIFFERENTES, ET CORRIGER L UNE NE CORRIGE PAS L AUTRE.
 *
 * 1. LA PANNE SILENCIEUSE (R02) — un dirigeant qui gere son club sans entrainer
 *    d equipe avait `teamIds: []` : la source etait coupee AVANT tout appel
 *    reseau. Zero proposition, zero erreur, zero trace. Le serveur, lui,
 *    l autorise (admin, team/services/auth.ts:92-112). L app etait plus stricte
 *    que le serveur. ⇒ temoins 2 et 3 ci-dessous.
 *
 * 2. LA PANNE BRUYANTE (constat d Adel, 2026-08-19) — pour un entraineur qui a
 *    bien des equipes, la source s activait puis ECHOUAIT, et l ecran affichait
 *    « Match amical indisponible ». La cause est un 400 « Invalid key
 *    applications » sur la moitie ENVOYEE : elle filtre sur `applications`, et
 *    Strapi 5 exige l action `<cible>.find` du role des qu une requete
 *    authentifiee traverse une relation EN FILTRES. Droit accorde cote serveur
 *    par S01 (admin b2261de). ⇒ temoin 1 : cote app, une moitie qui tombe ne
 *    doit plus emporter l autre.
 */

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  getClubInterestRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  getClubMembershipRequests: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(async () => ({ data: [] })),
  getMyPendingEventTeamInvitations: jest.fn(async () => []),
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

/** Le 400 exact que le serveur rendait sur la moitie ENVOYEE. */
const INVALID_KEY_APPLICATIONS = Object.assign(
  new Error('Invalid key applications'),
  { status: 400 },
);

const friendlyItems = (data) => data.items.filter((item) => item.type === 'friendly');

describe('Y04 — la source « match amical » de l ecran Demandes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyFriendlyMatchAds.mockResolvedValue([AD_WITH_PENDING_APPLICATION]);
    mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('temoin 1 — la moitie ENVOYEE en panne ne rend plus d erreur', async () => {
    mockGetMyFriendlyMatchApplications.mockRejectedValue(INVALID_KEY_APPLICATIONS);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-1'] });

    // ⛔ Plus de banniere « Match amical indisponible »...
    expect(data.errors).toHaveLength(0);
    // ...et surtout, les propositions RECUES sont bien la : c est le travail
    // faisable que le `Promise.all` d avant jetait avec l eau du bain.
    expect(friendlyItems(data)).toHaveLength(1);
  });

  it('temoin 1 bis — les DEUX moities en panne restent annoncees', async () => {
    mockGetMyFriendlyMatchAds.mockRejectedValue(INVALID_KEY_APPLICATIONS);
    mockGetMyFriendlyMatchApplications.mockRejectedValue(INVALID_KEY_APPLICATIONS);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-1'] });

    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].source).toBe('friendly');
    expect(data.errors[0].status).toBe(400);
  });

  it('temoin 2 — un dirigeant sans equipe entrainee voit ses matchs amicaux', async () => {
    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: [] });

    // R02 mesurait exactement l inverse : « aucune proposition, rien demande ».
    expect(mockGetMyFriendlyMatchAds).toHaveBeenCalledWith({ clubId: 'club-1', teamIds: [] });
    expect(mockGetMyFriendlyMatchApplications).toHaveBeenCalledWith([], { clubId: 'club-1' });
    expect(friendlyItems(data)).toHaveLength(1);
  });

  it('temoin 2 bis — sans club NI equipe, la source reste coupee', async () => {
    const data = await getRequestsHubData({ cmId: 'cm-1', teamIds: [] });

    expect(mockGetMyFriendlyMatchAds).not.toHaveBeenCalled();
    expect(friendlyItems(data)).toHaveLength(0);
    expect(data.errors).toHaveLength(0);
  });

  it('temoin de controle — avec une equipe entrainee, la proposition arrive', async () => {
    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-1'] });

    expect(mockGetMyFriendlyMatchAds).toHaveBeenCalled();
    expect(friendlyItems(data)).toHaveLength(1);
  });

  it('temoin — un droit qui manque (403) ne s annonce PAS comme une panne', async () => {
    // 🔒 Une section qu on n a pas le droit de voir ne se dit pas « indisponible » :
    // ce serait promettre un retour qui n arrivera jamais, et inviter a reessayer
    // pour rien. Avant ce lot, la regle ne valait que pour `installation`.
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    mockGetMyFriendlyMatchAds.mockRejectedValue(forbidden);
    mockGetMyFriendlyMatchApplications.mockRejectedValue(forbidden);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-1'] });

    expect(data.errors).toHaveLength(0);
    expect(friendlyItems(data)).toHaveLength(0);
  });

  it('temoin — un 500 reste annonce : lui, un « Reessayer » peut le resoudre', async () => {
    const boom = Object.assign(new Error('boom'), { status: 500 });
    mockGetMyFriendlyMatchAds.mockRejectedValue(boom);
    mockGetMyFriendlyMatchApplications.mockRejectedValue(boom);

    const data = await getRequestsHubData({ clubId: 'club-1', teamIds: ['team-1'] });

    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].status).toBe(500);
  });
});
