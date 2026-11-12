import client from '@/services/client';

import { getFriendlyMatchAds } from '../friendlyMatchService';

// AMICAUX-FORMAT (« 4 A », « 5 A », 10/11/2026) — la recherche filtrée par sport et
// par format part AU SERVEUR. Avant, l'app chargeait 10 annonces puis cachait celles
// d'un autre format : une page pouvait sortir vide alors que d'autres existaient.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: { data: [], meta: {} } })) },
}));

describe('AMICAUX-FORMAT — getFriendlyMatchAds trie au serveur', () => {
  beforeEach(() => jest.clearAllMocks());

  // T9-RETOURS-A (12/11, M1193) : plus d'annonce sans format sous un filtre de format.
  it('sport + format : les clauses partent sous $and, sans les annonces sans format', async () => {
    await getFriendlyMatchAds({ format: '7v7', search: 'Marseille', sport: 'Football' });
    const { filters } = /** @type {any} */ (client.get).mock.calls[0][1].params;
    expect(filters.$and).toEqual([
      { activity: { name: { $eqi: 'Football' } } },
      { format: { $eq: '7v7' } },
    ]);
    // La recherche texte garde son propre $or, à côté.
    expect(Array.isArray(filters.$or)).toBe(true);
  });

  it('sans filtre de format : aucune clause $and, la requête d’avant', async () => {
    await getFriendlyMatchAds();
    const { filters } = /** @type {any} */ (client.get).mock.calls[0][1].params;
    expect(filters).not.toHaveProperty('$and');
  });
});
