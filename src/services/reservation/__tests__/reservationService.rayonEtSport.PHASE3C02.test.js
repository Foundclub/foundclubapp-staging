import client from '@/services/client';
import { getReservations } from '@/services/reservation/reservationService';

// PHASE3C02 (27/10/2026) — deux restes de la chasse, lot C02.
// Q2-04 : « ville · N km » envoyait une seule case de geohash (`$contains`), qui excluait des
// réservations situées dans le rayon. /events sait déjà filtrer à la vraie distance quand il reçoit
// `lat`, `lon` et `radius` (bornes du cercle puis Haversine, comme la liste des événements).
// Q2-07 : les pastilles de sport écrivent `activitySlug` (« padel », « foot »…) ; le service ne le
// lisait pas : la pastille n'avait aucun effet sans texte tapé.

jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

/**
 * Les paramètres envoyés à /events pour ces filtres d'écran.
 * @param {Record<string, any>} filtres - Les filtres de l'écran.
 * @returns {Promise<Record<string, any>>} Les paramètres de la requête.
 */
const envoyes = async (filtres) => {
  jest.mocked(client.get).mockReset();
  jest.mocked(client.get).mockResolvedValue({ data: { data: [], meta: {} } });
  await getReservations(filtres);
  expect(client.get).toHaveBeenCalledTimes(1);
  return jest.mocked(client.get).mock.calls[0][1]?.params;
};

describe('Q2-04 — « ville · N km » des réservations', () => {
  it('avec un point et un rayon : la vraie distance, sans la case', async () => {
    const params = await envoyes({
      geohash: 'spey', lat: 43.2965, lon: 5.3698, radius: 30,
    });
    expect(params).toMatchObject({ lat: 43.2965, lon: 5.3698, radius: 30 });
    expect(params.filters.geohash).toBeUndefined();
  });

  it('sans point : la case, comme avant', async () => {
    const params = await envoyes({ geohash: 'spey' });
    expect(params.filters.geohash).toEqual({ $contains: 'spey' });
    expect(params.lat).toBeUndefined();
  });
});

describe('Q2-07 — pastilles de sport', () => {
  it.each([
    ['padel', ['Padel']],
    ['tennis', ['Tennis']],
    // « Foot 5 » : les deux noms lus en prod par le chef (28/10).
    ['foot', ['Football', 'Football à 5']],
    ['basket', ['Basketball', 'Basket']],
  ])('« %s » filtre le sport de l\'équipe par son nom', async (slug, noms) => {
    const params = await envoyes({ activitySlug: slug });
    expect(params.filters.team).toEqual({
      activities: { $or: noms.map((name) => ({ name: { $eqi: name } })) },
    });
  });

  it('un sport choisi par son identifiant garde la priorité', async () => {
    const params = await envoyes({ activity: 'doc-padel', activitySlug: 'tennis' });
    expect(params.filters.team).toEqual({ activities: { documentId: { $eq: 'doc-padel' } } });
  });

  it('« Tous » (null) ne filtre aucun sport', async () => {
    const params = await envoyes({ activitySlug: null });
    expect(params.filters.team).toBeUndefined();
  });
});
