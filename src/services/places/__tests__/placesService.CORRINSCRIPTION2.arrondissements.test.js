import { searchPlaces } from '../placesService';

// CORR-INSCRIPTION-2 (récolte du 31/10, capture p13) — le tri des communes (7d78e88e) ne jouait que
// pour un champ en communes. Le champ Ville de « Mes informations » sur le site cherche sans type :
// sa liste gardait l'ordre brut (Marseille, 11e, 10e, 12e). Partout, les arrondissements d'une même
// ville se rangent du 1er au dernier ; ils ne changent que de place entre eux : une rue, un club ou
// une autre commune garde son rang (la pertinence des adresses ne bouge pas).

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

/**
 * Une proposition de `/geo/search`.
 * @param {string} label - Le libellé.
 * @param {string} city - La ville.
 * @returns {object}
 */
const geo = (label, city = 'Marseille') => ({
  address_line: '', city, label, lat: 43.29, lng: 5.37, postcode: '13001', provider: 'ban',
});

const libelles = (/** @type {any[]} */ lieux) => lieux.map((lieu) => lieu.properties.label);

describe('CORR-INSCRIPTION-2 — les arrondissements dans l’ordre, sans type', () => {
  beforeEach(() => mockGet.mockReset());

  it('Marseille, 11e, rue, 10e, 12e ⇒ Marseille, 10e, rue, 11e, 12e', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          geo('Marseille'),
          geo('Marseille 11e Arrondissement'),
          geo('Rue de Marseille 13001 Marseille'),
          geo('Marseille 10e Arrondissement'),
          geo('Marseille 12e Arrondissement'),
        ],
      },
    });

    const lieux = await searchPlaces('Marseille');

    expect(mockGet.mock.calls[0][0]).toBe('/geo/search');
    expect(libelles(lieux)).toEqual([
      'Marseille',
      'Marseille 10e Arrondissement',
      'Rue de Marseille 13001 Marseille',
      'Marseille 11e Arrondissement',
      'Marseille 12e Arrondissement',
    ]);
  });

  it('une liste d’adresses sans arrondissement garde son ordre', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          geo('12 rue Paradis 13006 Marseille'),
          geo('2 rue Paradis 13001 Marseille'),
          geo('Paradis', 'Vitrolles'),
        ],
      },
    });

    const lieux = await searchPlaces('rue Paradis');

    expect(libelles(lieux)).toEqual([
      '12 rue Paradis 13006 Marseille',
      '2 rue Paradis 13001 Marseille',
      'Paradis',
    ]);
  });
});
