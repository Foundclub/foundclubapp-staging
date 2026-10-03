import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { useAdminCollectivitesATraiter } from '../collectiviteQueries';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 8 — LES NOMBRES des deux lignes « Collectivités » de
// l'accueil du SuperAdmin (planche 12), lus par les DEUX lectures existantes de la console :
// la liste des collectivités (« Mairies à activer » : les inactives qui ont des clubs, comme la
// tuile) et la file des demandes de gestionnaire en attente. Aucune lecture neuve ; pour un autre
// compte, AUCUNE requête. ROUGE avant le lot : le crochet n'existait pas.

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

const EXPLORATEUR = '/superadmin/content/api%3A%3Acollectivite.collectivite/list';
const FILE = '/superadmin/collectivite-manager-requests';

const attendre = async (/** @type {() => boolean} */ condition) => {
  const fin = Date.now() + 5000;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 10); }); });
  }
};

const lire = async (/** @type {boolean} */ superAdmin) => {
  /** @type {any} */
  const vu = { valeur: null };
  /**
   * Lit le crochet comme le ferait l accueil.
   * @returns {null} Rien a l ecran.
   */
  function Sonde() {
    vu.valeur = useAdminCollectivitesATraiter(superAdmin);
    return null;
  }
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  await act(async () => {
    renderer.create(<QueryClientProvider client={client}><Sonde /></QueryClientProvider>);
  });
  return vu;
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPost.mockResolvedValue({
    data: {
      data: [
        { clubs: [{ documentId: 'a' }], documentId: 'v1', isActive: false },
        { clubs: [], documentId: 'v2', isActive: false },
        { clubs: [{ documentId: 'b' }], documentId: 'v3', isActive: true },
      ],
      meta: { pagination: { total: 3 } },
    },
  });
  mockGet.mockResolvedValue({ data: { data: [{ documentId: 'dm-1' }, { documentId: 'dm-2' }] } });
});

describe('COLL-CONSOLE-BIS — les nombres « Collectivités » de l accueil du SuperAdmin', () => {
  it('SuperAdmin : les lectures de la console, et leurs nombres', async () => {
    const vu = await lire(true);
    await attendre(() => vu.valeur?.demandesGestionnaire === 2 && vu.valeur?.mairiesAActiver === 1);
    expect(vu.valeur).toEqual({ demandesGestionnaire: 2, mairiesAActiver: 1 });
    expect(mockPost.mock.calls[0][0]).toBe(EXPLORATEUR);
    expect(mockGet).toHaveBeenCalledWith(FILE, { params: { status: 'pending' } });
  });

  it('un autre compte : AUCUNE requête, des zéros', async () => {
    const vu = await lire(false);
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 200); }); });
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(vu.valeur).toEqual({ demandesGestionnaire: 0, mairiesAActiver: 0 });
  });
});
