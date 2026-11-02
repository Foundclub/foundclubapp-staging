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

// REPRISE-INSCRIPTION (01/11) — la contre-recette voyait encore 13e, 8e, 15e… à l'inscription : la
// base d'adresses donne à chaque arrondissement SA ville (« city: Marseille 13e Arrondissement »),
// relevé le 01/11 sur data.geopf.fr. Le regroupement par ville les prenait pour des communes
// à part.
describe('REPRISE-INSCRIPTION p13 — la réponse réelle de la base d’adresses', () => {
  beforeEach(() => mockGet.mockReset());

  it('chaque arrondissement porte sa propre ville : 1er → 16e', async () => {
    const vraiArr = (/** @type {number} */ n) => commune(
      `Marseille ${n}${n === 1 ? 'er' : 'e'} Arrondissement`,
      `130${String(n).padStart(2, '0')}`,
      BDR,
    );
    mockGet.mockResolvedValue({
      data: {
        features: [
          commune('Marseille', '13001', BDR),
          ...[13, 8, 15, 9, 12, 14, 10, 11, 3, 4, 5, 6, 1, 7, 2, 16].map(vraiArr),
          commune('Marseille-en-Beauvaisis', '60690', '60, Oise, Hauts-de-France'),
          commune('Marseillette', '11800', '11, Aude, Occitanie'),
        ],
      },
    });

    const lieux = await searchPlaces('Marseille', 'municipality');

    expect(lieux.map((lieu) => lieu.properties.label)).toEqual([
      'Marseille',
      ...Array.from({ length: 16 }, (_v, i) => (
        `Marseille ${i + 1}${i === 0 ? 'er' : 'e'} Arrondissement`
      )),
      'Marseille-en-Beauvaisis',
      'Marseillette',
    ]);
  });
});
