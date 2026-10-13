import client from '@/services/client';

import {
  creerMonComplexe,
  creerTerrain,
  enregistrerCreneaux,
  lireComplexeGere,
  lireMesComplexes,
  lireTerrains,
  modifierComplexeGere,
  modifierTerrain,
} from '../complexeService';

// RESA-L5A1 (13/10/2026) — le service du gérant suit le contrat d'API L1
// (docs/RESERVATION_CONTRAT_API_L1.md) : routes, corps `{ data }`, et `dryRun` DANS LE CORPS
// (admin `src/api/complexe/services/terrain.ts`, `setCreneaux`).

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: [] } });
  mockClient.post.mockResolvedValue({ data: { data: { documentId: 'cx-1' } } });
  mockClient.put.mockResolvedValue({ data: { data: { documentId: 'cx-1' } } });
});

describe('RESA-L5A1 — les routes du complexe', () => {
  it('« Créer mon complexe » : POST /complexes/self-onboard, corps { data }', async () => {
    const corps = await creerMonComplexe({ acceptRules: true, name: 'Le Five' });
    expect(mockClient.post).toHaveBeenCalledWith('/complexes/self-onboard', {
      data: { acceptRules: true, name: 'Le Five' },
    });
    expect(corps).toEqual({ data: { documentId: 'cx-1' } });
  });

  it('« Mes complexes » : GET /complexes/mine', async () => {
    await lireMesComplexes();
    expect(mockClient.get).toHaveBeenCalledWith('/complexes/mine');
  });

  it('lire et modifier SON complexe : /complexes/:id/manage', async () => {
    await lireComplexeGere('cx 1');
    expect(mockClient.get).toHaveBeenCalledWith('/complexes/cx%201/manage');
    await modifierComplexeGere('cx-1', { minAge: 16 });
    expect(mockClient.put).toHaveBeenCalledWith('/complexes/cx-1/manage', { data: { minAge: 16 } });
  });
});

describe('RESA-L5A1 — les routes des terrains', () => {
  it('lister, créer, modifier', async () => {
    await lireTerrains('cx-1');
    expect(mockClient.get).toHaveBeenCalledWith('/complexes/cx-1/terrains');
    await creerTerrain('cx-1', { name: 'Terrain 1' });
    expect(mockClient.post).toHaveBeenCalledWith('/complexes/cx-1/terrains', {
      data: { name: 'Terrain 1' },
    });
    await modifierTerrain('cx-1', 't-1', { capacity: 10 });
    expect(mockClient.put).toHaveBeenCalledWith('/complexes/cx-1/terrains/t-1', {
      data: { capacity: 10 },
    });
  });

  it('les créneaux : enregistrer, ou l’aperçu avec dryRun DANS le corps', async () => {
    const plan = {
      extraSlots: [], period: null, ranges: [], rates: [],
    };
    await enregistrerCreneaux('cx-1', 't-1', plan);
    expect(mockClient.put).toHaveBeenLastCalledWith('/complexes/cx-1/terrains/t-1/creneaux', {
      data: plan,
    });
    await enregistrerCreneaux('cx-1', 't-1', plan, { apercu: true });
    expect(mockClient.put).toHaveBeenLastCalledWith('/complexes/cx-1/terrains/t-1/creneaux', {
      data: plan,
      dryRun: true,
    });
  });
});
