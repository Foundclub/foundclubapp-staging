import {
  bloquerCreneau,
  fermerTerrains,
  lireApercuFermeture,
  lireFermetures,
  rouvrirFermetures,
} from '../complexeService';

// RESA-L5A2 (14/10/2026) — les fermetures d'un terrain de complexe (E-G10, E-G03) passent par les
// routes des fermetures des Villes, élargies par RESA-L2A : UNE fermeture PAR terrain (règle d'app
// du contrat), l'aperçu porte `meta.reservations`, un blocage a un motif facultatif.

const mockListe = jest.fn();
const mockApercu = jest.fn();
const mockFermer = jest.fn();
const mockRouvrir = jest.fn();
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: (...args) => mockFermer(...args),
  listFacilityClosures: (...args) => mockListe(...args),
  previewFacilityClosure: (...args) => mockApercu(...args),
  reopenFacilityClosure: (...args) => mockRouvrir(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RESA-L5A2 — les fermetures du complexe', () => {
  it('la liste : une lecture par terrain, réunies, chacune avec son terrain', async () => {
    mockListe.mockImplementation(async (terrainId) => ({
      data: [{ documentId: `f-${terrainId}` }],
    }));
    const liste = await lireFermetures(['t-1', 't-2']);
    // RESA-FIN-APP-2 : les rouvertes aussi (plan E-G10 §5, « rouverte »).
    expect(mockListe).toHaveBeenCalledWith('t-1', { status: 'all' });
    expect(liste).toEqual([
      { documentId: 'f-t-1', terrainId: 't-1' },
      { documentId: 'f-t-2', terrainId: 't-2' },
    ]);
  });

  it('l’aperçu : les réservations touchées des terrains, additionnées', async () => {
    mockApercu.mockImplementation(async (terrainId) => ({
      meta: {
        reservations: {
          count: terrainId === 't-1' ? 3 : 1,
          items: [{ documentId: `r-${terrainId}` }],
        },
      },
    }));
    const apercu = await lireApercuFermeture(['t-1', 't-2'], {
      endDate: '2026-10-26', startDate: '2026-10-25',
    });
    expect(mockApercu).toHaveBeenCalledWith('t-1', {
      endDate: '2026-10-26', kind: 'closure', startDate: '2026-10-25',
    });
    expect(apercu.count).toBe(4);
    expect(apercu.items.map((item) => item.terrainId)).toEqual(['t-1', 't-2']);
  });

  it('fermer : une fermeture par terrain, sans actualité ; un échec garde le reste', async () => {
    mockFermer
      .mockResolvedValueOnce({ data: { reservations: { annulees: 3 } } })
      .mockRejectedValueOnce(new Error('refus'));
    const bilan = await fermerTerrains(['t-1', 't-2'], {
      endDate: '2026-10-26', reason: 'travaux', startDate: '2026-10-25',
    });
    expect(mockFermer).toHaveBeenNthCalledWith(1, 't-1', {
      endDate: '2026-10-26',
      kind: 'closure',
      publishActualite: false,
      reason: 'travaux',
      startDate: '2026-10-25',
    });
    expect(bilan.annulees).toBe(3);
    expect(bilan.faits).toBe(1);
    expect(bilan.echecs.map((echec) => echec.id)).toEqual(['t-2']);
  });

  it('tout échoue : le premier refus remonte à l’écran', async () => {
    mockRouvrir.mockRejectedValue(new Error('déjà rouverte'));
    await expect(rouvrirFermetures(['f-1', 'f-2'])).rejects.toThrow('déjà rouverte');
  });

  it('bloquer un créneau : une plage d’un jour, le motif seulement s’il est donné', async () => {
    mockFermer.mockResolvedValue({ data: {} });
    await bloquerCreneau('t-1', { date: '2026-10-16', from: '14:00', to: '16:00' });
    expect(mockFermer).toHaveBeenCalledWith('t-1', {
      endDate: '2026-10-16',
      endTime: '16:00',
      kind: 'block',
      startDate: '2026-10-16',
      startTime: '14:00',
    });
    await bloquerCreneau('t-1', {
      date: '2026-10-16', from: '14:00', motif: 'Entretien', to: '16:00',
    });
    expect(mockFermer)
      .toHaveBeenLastCalledWith('t-1', expect.objectContaining({ label: 'Entretien' }));
  });
});
