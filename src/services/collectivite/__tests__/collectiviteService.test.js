import {
  addAdminCollectiviteGestionnaire,
  ADMIN_COLLECTIVITE_DETAIL_POPULATE,
  ADMIN_COLLECTIVITES_LIST_PAYLOAD,
  attachAdminCollectiviteClub,
  createAdminCollectivite,
  detachAdminCollectiviteClub,
  getAdminCollectivite,
  getAdminCollectivites,
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getCollectiviteRequests,
  getMyCollectivites,
  removeAdminCollectiviteGestionnaire,
  saveCollectiviteInstallation,
  searchAdminCollectiviteTargets,
  setAdminCollectiviteActive,
} from '../collectiviteService';

// 🏛️ COLLECTIVITES 1c — LE CONTRAT avec le serveur (admin feat/COLL1C) : chaque ecran
// « Ma collectivite » appelle la BONNE route, avec le BON corps. Le client HTTP est double ;
// c est lui qui dit ou part la requete.

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: (...args) => mockDelete(...args),
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

beforeEach(() => {
  [mockGet, mockPost, mockPut, mockDelete].forEach((doublure) => {
    doublure.mockReset();
    doublure.mockResolvedValue({ data: { data: [] } });
  });
});

describe('collectiviteService — les routes du gestionnaire', () => {
  it('la porte : GET /collectivites/mine', async () => {
    await getMyCollectivites();
    expect(mockGet).toHaveBeenCalledWith('/collectivites/mine');
  });

  it('les demandes : GET /collectivites/:id/requests?status=…', async () => {
    await getCollectiviteRequests('ville', 'pending');
    await getCollectiviteRequests('ville', 'decided');
    const route = '/collectivites/ville/requests';
    expect(mockGet).toHaveBeenNthCalledWith(1, route, { params: { status: 'pending' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, route, { params: { status: 'decided' } });
  });

  it('les installations et les clubs : GET /collectivites/:id/installations|clubs', async () => {
    await getCollectiviteInstallations('ville');
    await getCollectiviteClubs('ville');
    expect(mockGet).toHaveBeenNthCalledWith(1, '/collectivites/ville/installations');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/collectivites/ville/clubs');
  });

  it('créer : POST /collectivites/:id/installations ; modifier : PUT …/:facilityId', async () => {
    const data = { maxSlots: 2, name: 'Gymnase', type: 'Gymnase' };
    await saveCollectiviteInstallation({ collectiviteId: 'ville', data });
    await saveCollectiviteInstallation({ collectiviteId: 'ville', data, facilityId: 'gym' });
    expect(mockPost).toHaveBeenCalledWith('/collectivites/ville/installations', { data });
    expect(mockPut).toHaveBeenCalledWith('/collectivites/ville/installations/gym', { data });
  });
});

// 🏛️ D61 (29/09) — LE CONTRAT de la console super-admin avec le serveur (admin ce384ce) :
// aucune route neuve. Lectures par l explorateur super-admin, gestes par les 6 routes
// `/superadmin/collectivites/...` (collectivite-custom.ts), toutes `global::is-superadmin`.
describe('collectiviteService — la console super-admin (D61)', () => {
  const EXPLORATEUR = '/superadmin/content/api%3A%3Acollectivite.collectivite/list';

  // eslint-disable-next-line max-len
  it('la liste : l explorateur, une ligne par collectivité, ses clubs réduits à leur identifiant', async () => {
    await getAdminCollectivites();
    expect(mockPost).toHaveBeenCalledWith(EXPLORATEUR, {
      // COLL-CONSOLE-BIS (03/10) — + la date d activation (« Activée le »).
      // COLL-C6-DEMO (03/10) — + `isDemo` (la Ville de démonstration ne compte pas comme un client).
      fields: ['documentId', 'name', 'type', 'isActive', 'activatedAt', 'isDemo'],
      pagination: { page: 1, pageSize: 100 },
      populate: { clubs: { fields: ['documentId'] } },
      sort: ['name:asc'],
    });
    expect(mockPost.mock.calls[0][1]).toBe(ADMIN_COLLECTIVITES_LIST_PAYLOAD);
  });

  // eslint-disable-next-line max-len
  it('le détail : la même lecture filtrée sur UNE collectivité ; des gestionnaires, nom et e-mail', async () => {
    mockPost.mockResolvedValue({ data: { data: [{ documentId: 'ville', name: 'Ville de X' }] } });
    // eslint-disable-next-line max-len
    await expect(getAdminCollectivite('ville')).resolves.toEqual({ documentId: 'ville', name: 'Ville de X' });
    expect(mockPost).toHaveBeenCalledWith(EXPLORATEUR, {
      fields: ['documentId', 'name', 'type', 'isActive', 'codeInsee', 'siren', 'activatedAt'],
      filters: { documentId: { $eq: 'ville' } },
      pagination: { page: 1, pageSize: 1 },
      populate: ADMIN_COLLECTIVITE_DETAIL_POPULATE,
    });
    expect(ADMIN_COLLECTIVITE_DETAIL_POPULATE.gestionnaires).toEqual({
      fields: ['documentId', 'firstname', 'lastname', 'email'],
    });
    mockPost.mockResolvedValue({ data: { data: [] } });
    await expect(getAdminCollectivite('absente')).resolves.toBeNull();
  });

  // eslint-disable-next-line max-len
  it('activer / couper : PUT /superadmin/collectivites/:id/active { data: { isActive } }', async () => {
    await setAdminCollectiviteActive({ collectiviteId: 'ville', isActive: true });
    await setAdminCollectiviteActive({ collectiviteId: 'ville', isActive: false });
    expect(mockPut).toHaveBeenNthCalledWith(1, '/superadmin/collectivites/ville/active', {
      data: { isActive: true },
    });
    expect(mockPut).toHaveBeenNthCalledWith(2, '/superadmin/collectivites/ville/active', {
      data: { isActive: false },
    });
  });

  it('rattacher / détacher un club : POST | DELETE …/clubs/:clubId', async () => {
    await attachAdminCollectiviteClub({ clubId: 'as-montrivage', collectiviteId: 'ville' });
    await detachAdminCollectiviteClub({ clubId: 'as-montrivage', collectiviteId: 'ville' });
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites/ville/clubs/as-montrivage');
    expect(mockDelete).toHaveBeenCalledWith('/superadmin/collectivites/ville/clubs/as-montrivage');
  });

  it('nommer / retirer un gestionnaire : POST | DELETE …/gestionnaires/:userId', async () => {
    await addAdminCollectiviteGestionnaire({ collectiviteId: 'ville', userId: 'karim' });
    await removeAdminCollectiviteGestionnaire({ collectiviteId: 'ville', userId: 'karim' });
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites/ville/gestionnaires/karim');
    expect(mockDelete).toHaveBeenCalledWith('/superadmin/collectivites/ville/gestionnaires/karim');
  });

  it('créer : POST /superadmin/collectivites { data }', async () => {
    const data = { codeInsee: '13055', name: 'Ville de Marseille', type: 'commune' };
    await createAdminCollectivite(data);
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites', { data });
  });

  // COLL-CONSOLE (02/10) — un club se cherche aussi avec son adresse publique : la console dit
  // sa ville.
  it('chercher : un club par son nom (et sa ville), un compte par nom et e-mail', async () => {
    await searchAdminCollectiviteTargets('club', ' mont ');
    await searchAdminCollectiviteTargets('user', 'karim');
    expect(mockPost).toHaveBeenNthCalledWith(1, '/superadmin/relations/api%3A%3Aclub.club/search', {
      // COLL-CONSOLE-BIS (03/10) — + la ville officielle, l INSEE (proximite) et le sport.
      fields: ['documentId', 'name', 'addressDetails', 'cityName', 'inseeCom'],
      pageSize: 20,
      populate: { activites: { fields: ['name'] } },
      q: 'mont',
    });
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      '/superadmin/relations/plugin%3A%3Ausers-permissions.user/search',
      { fields: ['documentId', 'firstname', 'lastname', 'email'], pageSize: 10, q: 'karim' },
    );
  });

  it('un identifiant est encodé dans l adresse', async () => {
    await attachAdminCollectiviteClub({ clubId: 'a/b', collectiviteId: 'v?x' });
    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites/v%3Fx/clubs/a%2Fb');
  });
});
