import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getCollectiviteRequests,
  getMyCollectivites,
  saveCollectiviteInstallation,
} from '../collectiviteService';

// 🏛️ COLLECTIVITES 1c — LE CONTRAT avec le serveur (admin feat/COLL1C) : chaque ecran
// « Ma collectivite » appelle la BONNE route, avec le BON corps. Le client HTTP est double ;
// c est lui qui dit ou part la requete.

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

beforeEach(() => {
  [mockGet, mockPost, mockPut].forEach((doublure) => {
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
