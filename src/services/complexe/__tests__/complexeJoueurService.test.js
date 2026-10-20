import client from '@/services/client';

import {
  annulerMaReservation,
  apercuDeReservation,
  chercherDesTerrains,
  lireComplexePublic,
  lireCreneauxDuJour,
  lireMaReservation,
  lireTerrainsPublics,
  reserverUnCreneau,
} from '../complexeJoueurService';

// RESA-L6A (14/10/2026) — le service du JOUEUR suit le contrat d'API L1 + L2A
// (docs/RESERVATION_CONTRAT_API_L1.md, admin `origin/feat/RESAL2A-admin` f76ddb38) : la lecture
// publique (sans compte) du complexe, de ses terrains et de leurs créneaux, la recherche, puis
// réserver (`dryRun` DANS LE CORPS : `readBookingPayload` lit `payload.dryRun`), lire et annuler
// SA réservation.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: { complexes: [], date: '2026-10-14' } } });
  mockClient.post.mockResolvedValue({ data: { data: { documentId: 'r-1' } } });
});

describe('RESA-L6A — la lecture publique (E-P01, E-P02, E-P03)', () => {
  it('chercher : GET /public-complexes avec les seuls filtres remplis', async () => {
    const corps = await chercherDesTerrains({
      apres: '18:00', cadre: '', date: '2026-10-14', q: 'five', rayon: 10, sport: null,
    });
    expect(mockClient.get).toHaveBeenCalledWith('/public-complexes', {
      params: {
        apres: '18:00', date: '2026-10-14', q: 'five', rayon: 10,
      },
    });
    expect(corps).toEqual({ data: { complexes: [], date: '2026-10-14' } });
  });

  it('la page publique, ses terrains, les créneaux d’un jour : par le slug', async () => {
    await lireComplexePublic('le five');
    expect(mockClient.get).toHaveBeenCalledWith('/public-complexes/le%20five');
    await lireTerrainsPublics('le-five');
    expect(mockClient.get).toHaveBeenCalledWith('/public-complexes/le-five/terrains');
    await lireCreneauxDuJour('le-five', 't-1', '2026-10-14');
    expect(mockClient.get).toHaveBeenCalledWith(
      '/public-complexes/le-five/terrains/t-1/creneaux',
      { params: { date: '2026-10-14' } },
    );
  });
});

describe('RESA-L6A — réserver (E-P04, E-P05) et ma réservation (E-P07)', () => {
  const demande = {
    date: '2026-10-14',
    from: '18:00',
    note: 'Foot du mardi',
    phoneShared: false,
    players: 10,
    terrain: 't-1',
  };

  it('l’aperçu : POST /reservations-terrain, `dryRun` dans le corps', async () => {
    await apercuDeReservation(demande);
    expect(mockClient.post).toHaveBeenCalledWith('/reservations-terrain', {
      data: demande,
      dryRun: true,
    });
  });

  it('réserver : POST /reservations-terrain, sans `dryRun`', async () => {
    const corps = await reserverUnCreneau(demande);
    expect(mockClient.post).toHaveBeenCalledWith('/reservations-terrain', { data: demande });
    expect(corps).toEqual({ data: { documentId: 'r-1' } });
  });

  it('lire et annuler SA réservation', async () => {
    await lireMaReservation('r 1');
    expect(mockClient.get).toHaveBeenCalledWith('/reservations-terrain/r%201');
    await annulerMaReservation('r-1');
    expect(mockClient.post).toHaveBeenCalledWith('/reservations-terrain/r-1/annuler', {});
  });
});
