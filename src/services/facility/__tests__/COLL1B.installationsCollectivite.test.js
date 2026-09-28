// COLL1B (29/09) — lot 1b du chantier Collectivites (SPEC D2, §3).
// « L onglet Installations d un club rattache liste aussi celles de sa collectivite »
// et « un membre lit le planning d UNE installation » : ce que le service de l app
// demande au serveur, et ce qu il en fait. Le serveur est le seul juge (lot 1b,
// admin) : l app ne decide rien, elle demande et affiche.
//
// ROUGE avant le lot : ni `getFacilityPlanning`, ni l option `includeCollectivite`,
// ni la section de la collectivite n existaient.

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

const {
  getClubFacilityContext,
  getFacilityPlanning,
  getFacilitySections,
} = require('../facilityService');

const TERRAIN_DU_CLUB = { club: { name: 'AS Ville A' }, documentId: 'terrain-A', name: 'Terrain du club A' };
const GYMNASE_DE_LA_VILLE = {
  collectivite: { documentId: 'ville-demo', name: 'Ville de Demo' },
  documentId: 'gym-ville',
  maxSlots: 2,
  name: 'Gymnase de la Ville',
};

const reponse = (data) => ({ data: { data } });

describe('COLL1B — les installations de la collectivite, vues depuis le club', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  test('un membre : l onglet demande AUSSI les installations de la collectivite, en lecture seule', async () => {
    mockGet
      .mockResolvedValueOnce(reponse([TERRAIN_DU_CLUB]))
      .mockResolvedValueOnce(reponse([GYMNASE_DE_LA_VILLE]));

    const contexte = await getClubFacilityContext('club-A', null, { includeCollectivite: true, resolveCmId: false });

    expect(mockGet).toHaveBeenCalledWith('/clubs/club-A/collectivite-installations');
    expect(contexte.allFacilities.map((installation) => installation.name)).toEqual([
      'Terrain du club A',
      'Gymnase de la Ville',
    ]);
    const gymnase = contexte.allFacilities[1];
    expect(gymnase).toMatchObject({
      isReadOnly: true,
      isShared: true,
      ownerName: 'Ville de Demo',
      ownerType: 'collectivite',
    });
    // Le planning « partage » du club (omnisport) ne l embarque pas : ce n est pas le sien.
    expect(contexte.sharedFacilities).toEqual([]);
  });

  test('sans l option (annonce de recrutement, visiteur) : rien de nouveau, aucun appel en plus', async () => {
    mockGet.mockResolvedValueOnce(reponse([TERRAIN_DU_CLUB]));

    const contexte = await getClubFacilityContext('club-A', null, { resolveCmId: false });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).not.toHaveBeenCalledWith('/clubs/club-A/collectivite-installations');
    expect(contexte.allFacilities.map((installation) => installation.name)).toEqual(['Terrain du club A']);
  });

  test('le serveur refuse (403 : pas membre) : les installations du club restent, sans erreur', async () => {
    mockGet
      .mockResolvedValueOnce(reponse([TERRAIN_DU_CLUB]))
      .mockRejectedValueOnce({ status: 403 });

    const contexte = await getClubFacilityContext('club-A', null, { includeCollectivite: true, resolveCmId: false });

    expect(contexte.allFacilities.map((installation) => installation.name)).toEqual(['Terrain du club A']);
  });

  test('l onglet range les installations de la collectivite sous SON nom, a part du club', () => {
    const sections = getFacilitySections([
      { ...TERRAIN_DU_CLUB, isShared: false },
      {
        ...GYMNASE_DE_LA_VILLE, isReadOnly: true, isShared: true, ownerName: 'Ville de Demo', ownerType: 'collectivite',
      },
    ], { clubTitle: 'Installations du club', sharedTitle: 'Installations partagées' });

    expect(sections.map((section) => [section.title, section.data.map((installation) => installation.name)])).toEqual([
      ['Installations du club', ['Terrain du club A']],
      ['Installations · Ville de Demo', ['Gymnase de la Ville']],
    ]);
  });

  test('le planning d UNE installation se demande par semaine, a la route du lot 1b', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [], meta: { total: 0 } } });

    await expect(getFacilityPlanning('gym-ville', { from: '2026-10-05', to: '2026-10-11' }))
      .resolves.toEqual({ data: [], meta: { total: 0 } });

    expect(mockGet).toHaveBeenCalledWith('/facilities/gym-ville/planning', {
      params: { from: '2026-10-05', to: '2026-10-11' },
    });
  });
});
