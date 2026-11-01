// REPRISE-DONNEES p110 (recette du site, 01/11) — la liste des sports de « Modifier mon profil »,
// de l'inscription, des assistants d'équipe et de parcours arrive dans l'ordre du serveur :
// « Échecs » et « Équitation » APRÈS « Yoga », « Football » noyé au milieu. Adel : « mettre les sports les
// plus populaires en premier, comme ailleurs dans l'app » (le choix du sport de la recherche,
// ChoixDuSport : football, basketball, handball, rugby, volleyball).
// 1er bloc = témoin CARACTÉRISANT (E6 : le fichier n'avait aucun test), vert avant et après.
// 2e bloc = le défaut, ROUGE avant la correction.

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const { getActivities } = require('../activityService');

// L'ordre que rend le serveur de recette (tri SQL sur les octets : les accents après le Z).
const ORDRE_DU_SERVEUR = ['Aviron', 'Badminton', 'Basketball', 'Football', 'Handball', 'Rugby',
  'Volleyball', 'Yoga', 'Échecs', 'Équitation'];
const repondre = (noms) => mockGet.mockResolvedValueOnce({
  data: { data: noms.map((name, i) => ({ documentId: `doc-${i}`, name })) },
});

describe('getActivities — ce qui ne change pas (témoin caractérisant)', () => {
  beforeEach(() => mockGet.mockReset());

  it('demande /activities, 200 par page, triés par nom, avec les paramètres', async () => {
    repondre(['Football']);
    await getActivities({ filters: { isLeague: true } });
    expect(mockGet).toHaveBeenCalledWith('/activities', {
      params: {
        filters: { isLeague: true }, pagination: { page: 1, pageSize: 200 }, sort: ['name:asc'],
      },
    });
  });

  it('rend chaque sport avec son documentId, sans en perdre ni en ajouter', async () => {
    repondre(ORDRE_DU_SERVEUR);
    const sports = await getActivities();
    expect(sports).toHaveLength(ORDRE_DU_SERVEUR.length);
    expect(sports.map((s) => s.name).sort()).toEqual([...ORDRE_DU_SERVEUR].sort());
    expect(sports.find((s) => s.name === 'Yoga')).toEqual({ documentId: 'doc-7', name: 'Yoga' });
  });

  it('rend une erreur lisible si le serveur répond mal', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));
    await expect(getActivities()).rejects.toThrow('Failed to fetch activities: Network Error');
  });
});

describe('getActivities — p110 : populaires d abord, puis de A à Z sans les accents', () => {
  beforeEach(() => mockGet.mockReset());

  it('met football, basketball, handball, rugby, volleyball en tête, dans cet ordre', async () => {
    repondre(ORDRE_DU_SERVEUR);
    const noms = (await getActivities()).map((s) => s.name);
    expect(noms.slice(0, 5)).toEqual(['Football', 'Basketball', 'Handball', 'Rugby', 'Volleyball']);
  });

  it('range le reste de A à Z : « Échecs » et « Équitation » avant « Yoga »', async () => {
    repondre(ORDRE_DU_SERVEUR);
    const noms = (await getActivities()).map((s) => s.name);
    expect(noms.slice(5)).toEqual(['Aviron', 'Badminton', 'Échecs', 'Équitation', 'Yoga']);
  });

  it('reconnaît « Volley-ball », et garde le tri demandé par l appelant', async () => {
    repondre(['Aïkido', 'Volley-ball', 'Escrime']);
    const noms = (await getActivities()).map((s) => s.name);
    expect(noms).toEqual(['Volley-ball', 'Aïkido', 'Escrime']);
    repondre(['Zumba', 'Aviron']);
    const tries = (await getActivities({ sort: ['name:desc'] })).map((s) => s.name);
    expect(tries).toEqual(['Zumba', 'Aviron']);
  });
});
