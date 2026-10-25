import client from '@/services/client';
import { getReservations } from '@/services/reservation/reservationService';

// BUGHUNT C02 (25/10/2026) — Q2-07 : la feuille de filtres des réservations écrit `maxPrice`, le
// service ne lisait que `maxPricePerPerson` : sans texte tapé (liste et carte), « Prix maximum »
// n'avait aucun effet.

jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

/**
 * Les filtres envoyés au serveur pour ces filtres d'écran.
 * @param {Record<string, any>} filtres - Les filtres de l'écran.
 * @returns {Promise<Record<string, any>>} Les filtres de la requête.
 */
const envoyes = async (filtres) => {
  jest.mocked(client.get).mockResolvedValue({ data: { data: [], meta: {} } });
  await getReservations(filtres);
  return jest.mocked(client.get).mock.calls.at(-1)?.[1]?.params.filters;
};

describe('Q2-07 — « Prix maximum » de la feuille des réservations', () => {
  it('maxPrice (la feuille) filtre le prix par personne', async () => {
    expect((await envoyes({ maxPrice: '15', startDateAfter: '2026-10-25' })).pricePerPerson)
      .toEqual({ $lte: '15' });
  });

  it('maxPricePerPerson garde la priorité', async () => {
    expect((await envoyes({ maxPrice: '15', maxPricePerPerson: 10 })).pricePerPerson)
      .toEqual({ $lte: 10 });
  });

  it('sans prix, aucun filtre de prix', async () => {
    expect((await envoyes({ maxPrice: '' })).pricePerPerson).toBeUndefined();
  });
});
