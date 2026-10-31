import { searchPlaces } from '../placesService';

// CORR-INSCRIPTION p13 (recette du site 30/10, décision A, C déjà en place) — « Marseille » rendait
// la liste dans l'ordre de la base d'adresses : le 13e, le 8e, le 15e arrondissement…, et des
// communes d'autres départements mêlées. Ordre voulu : la commune, puis ses arrondissements du 1er
// au dernier, le département de la meilleure réponse en tête, les autres départements ensuite. Le
// code postal reste affiché à côté du nom (autocompleteAddressInput).

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

/**
 * Une commune de la base d'adresses, comme elle répond (libellé, ville, contexte).
 * @param {string} label - Le libellé.
 * @param {string} postcode - Le code postal.
 * @param {string} context - « 13, Bouches-du-Rhône, Provence-Alpes-Côte d'Azur ».
 * @param {string} [city] - La ville (le nom sans l'arrondissement).
 * @returns {object}
 */
const commune = (label, postcode, context, city = label) => ({
  geometry: { coordinates: [5.37, 43.29] },
  properties: {
    city, context, id: `${label}-${postcode}`, label, postcode, type: 'municipality',
  },
});

const BDR = '13, Bouches-du-Rhône, Provence-Alpes-Côte d’Azur';
const arr = (/** @type {number} */ n) => commune(
  `Marseille ${n}${n === 1 ? 'er' : 'e'} Arrondissement`,
  `130${String(n).padStart(2, '0')}`,
  BDR,
  'Marseille',
);

describe('CORR-INSCRIPTION p13 — l’ordre des villes', () => {
  beforeEach(() => mockGet.mockReset());

  it('la commune, ses arrondissements du 1er au dernier, les autres départements', async () => {
    mockGet.mockResolvedValue({
      data: {
        features: [
          commune('Marseille', '13001', BDR),
          arr(13), arr(8), arr(15),
          commune('Marseille', '36150', '36, Indre, Centre-Val de Loire', 'Luçay-le-Libre'),
          arr(10), arr(1), arr(2),
          commune('Marseillan', '34340', '34, Hérault, Occitanie'),
        ],
      },
    });

    const lieux = await searchPlaces('Marseille', 'municipality');

    expect(lieux.map((lieu) => lieu.properties.label)).toEqual([
      'Marseille',
      'Marseille 1er Arrondissement',
      'Marseille 2e Arrondissement',
      'Marseille 8e Arrondissement',
      'Marseille 10e Arrondissement',
      'Marseille 13e Arrondissement',
      'Marseille 15e Arrondissement',
      'Marseille',
      'Marseillan',
    ]);
    expect(lieux[7].properties.postcode).toBe('36150');
  });

  it('sans arrondissement ni autre département, l’ordre de la base est gardé', async () => {
    mockGet.mockResolvedValue({
      data: {
        features: [
          commune('Vitrolles', '13127', BDR),
          commune('Velaux', '13880', BDR),
        ],
      },
    });

    const lieux = await searchPlaces('V', 'municipality');

    expect(lieux.map((lieu) => lieu.properties.label)).toEqual(['Vitrolles', 'Velaux']);
  });
});
