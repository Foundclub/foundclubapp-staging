import client from '@/services/client';

import {
  annulerReservationGeree,
  deciderDemande,
  lirePlanning,
  lireReservationGeree,
  lireReservationsDuComplexe,
  modifierExterieur,
  noterExterieur,
  retirerTerrain,
} from '../complexeService';

// RESA-L5A2 (14/10/2026) — les routes du gérant ajoutées par RESA-L2A (contrat d'API, partie
// « Ajouté après RESA-L2A » ; source qui fait foi : admin `origin/feat/RESAL2A-admin`,
// `src/api/complexe/routes/reservation-custom.ts`, `terrain-custom.ts`). Les doublures suivent ce
// contrat : corps `{ data }`, `dryRun` DANS LE CORPS.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: { items: [] } } });
  mockClient.post.mockResolvedValue({ data: { data: { documentId: 'r-1' } } });
  mockClient.put.mockResolvedValue({ data: { data: { documentId: 'r-1' } } });
});

describe('RESA-L5A2 — les lectures du gérant', () => {
  it('la liste : une vue, des filtres, une page ; rien d’autre dans l’adresse', async () => {
    await lireReservationsDuComplexe('cx-five', {
      page: 2, source: 'app', statut: '', terrain: 't-1', vue: 'a-venir',
    });
    expect(mockClient.get).toHaveBeenCalledWith('/complexes/cx-five/reservations', {
      params: {
        page: 2, source: 'app', terrain: 't-1', vue: 'a-venir',
      },
    });
  });

  it('la fiche et le planning', async () => {
    await lireReservationGeree('cx-five', 'r-1');
    expect(mockClient.get).toHaveBeenCalledWith('/complexes/cx-five/reservations/r-1');
    await lirePlanning('cx-five', { from: '2026-10-14', terrain: undefined, to: '2026-10-20' });
    expect(mockClient.get).toHaveBeenLastCalledWith('/complexes/cx-five/planning', {
      params: { from: '2026-10-14', to: '2026-10-20' },
    });
  });
});

describe('RESA-L5A2 — les gestes du gérant', () => {
  it('accepter, refuser avec un motif', async () => {
    await deciderDemande('cx-five', 'r-1', { decision: 'accepter' });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes/cx-five/reservations/r-1/decision',
      { data: { decision: 'accepter' } },
    );
    await deciderDemande('cx-five', 'r-1', { decision: 'refuser', reason: 'Fermeture' });
    expect(mockClient.post).toHaveBeenLastCalledWith(
      '/complexes/cx-five/reservations/r-1/decision',
      { data: { decision: 'refuser', reason: 'Fermeture' } },
    );
  });

  it('annuler (motif), noter « extérieur », modifier son nom', async () => {
    await annulerReservationGeree('cx-five', 'r-1', 'Terrain impraticable');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes/cx-five/reservations/r-1/annuler',
      { data: { reason: 'Terrain impraticable' } },
    );
    await annulerReservationGeree('cx-five', 'r-2', null);
    expect(mockClient.post).toHaveBeenLastCalledWith(
      '/complexes/cx-five/reservations/r-2/annuler',
      { data: {} },
    );
    await noterExterieur('cx-five', {
      date: '2026-10-16', externalName: 'M. Dupont', from: '20:00', terrain: 't-1',
    });
    expect(mockClient.post).toHaveBeenLastCalledWith('/complexes/cx-five/reservations', {
      data: {
        date: '2026-10-16', externalName: 'M. Dupont', from: '20:00', terrain: 't-1',
      },
    });
    await modifierExterieur('cx-five', 'r-2', 'Mme Roux');
    expect(mockClient.put).toHaveBeenCalledWith(
      '/complexes/cx-five/reservations/r-2',
      { data: { externalName: 'Mme Roux' } },
    );
  });

  it('retirer un terrain : l’aperçu porte `dryRun` DANS LE CORPS', async () => {
    await retirerTerrain('cx-five', 't-1', { apercu: true });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes/cx-five/terrains/t-1/retirer',
      { dryRun: true },
    );
    await retirerTerrain('cx-five', 't-1');
    expect(mockClient.post).toHaveBeenLastCalledWith('/complexes/cx-five/terrains/t-1/retirer', {});
  });
});
