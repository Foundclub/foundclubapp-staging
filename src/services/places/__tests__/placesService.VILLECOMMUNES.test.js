import { searchPlaces } from '../placesService';

// VILLE-COMMUNES (29/10/2026, décision d'Adel « 1- A ») — l'étape « Où habites-tu ? » de
// l'inscription ne propose QUE des communes. Diagnostic ETAPE-VILLE (mesures en prod le 29/10) :
// notre recherche (`/geo/search`) classait nos clubs importés devant la base d'adresses
// (« Vitrolles » ⇒ 20 sièges de clubs, dont des domiciles), rendait des RUES marquées
// `autocomplete` même en commune (« plan de cuques »), deux fois la même commune
// (« Plan-de-Cuques » ×2) et aucune commune pour un code postal (« 13380 »). Une commune demandée
// interroge donc la base d'adresses, en communes, et ne retombe jamais sur les rues. Les réponses
// ci-dessous sont celles relevées le 29/10.

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

/**
 * Une proposition de `/geo/search`.
 * @param {string} label - Le libellé.
 * @param {string} provider - `ban` ou `internal`.
 * @param {string} source - `autocomplete`, `import`…
 * @returns {object}
 */
const geo = (label, provider = 'ban', source = 'autocomplete') => ({
  address_line: '',
  city: '',
  label,
  lat: 43.4,
  lng: 5.2,
  postcode: '',
  provider,
  provider_id: label,
  source,
});

/**
 * Une commune de la base d'adresses.
 * @param {string} label - Le nom.
 * @param {string} postcode - Le code postal.
 * @param {string} id - Le code INSEE.
 * @returns {object}
 */
const commune = (label, postcode, id) => ({
  geometry: { coordinates: [5.2, 43.4] },
  properties: {
    city: label, id, label, postcode, type: 'municipality',
  },
});

/** Ce que rendait notre recherche, le 29/10, en communes (`type=municipality`). */
const GEO = {
  13380: [geo('1 RUE THEODORE RAMPAL 13380 PLAN-DE-CUQUES', 'internal', 'import'),
    geo('Avenue de la Libération 13380 Plan-de-Cuques')],
  Marseile: [geo('Marseille'), geo('Marseille 83470 Saint-Maximin-la-Sainte-Baume')],
  'plan de cuques': [geo('Av du Mal de Lattre de Tassigny 13380 Plan-de-Cuques'),
    geo('Avenue de la Libération 13380 Plan-de-Cuques'),
    geo('Plan-de-Cuques'), geo('Plan-de-Cuques')],
  'Saint-Étienne': [geo('Saint Etienne 13800 Istres'), geo('Saint-Étienne')],
  Vitrolles: [geo('Vitrolles', 'internal', 'import'),
    geo('CHEZ MME LAFON DEL GRANDE 106 LOT LE BOSQUET 13127 VITROLLES', 'internal', 'import')],
};

/** Ce que rend la base d'adresses, en communes, le 29/10. */
const BAN = {
  13380: [commune('Plan-de-Cuques', '13380', '13075')],
  Marseile: [commune('Marseille', '13001', '13055')],
  'plan de cuques': [commune('Plan-de-Cuques', '13380', '13075')],
  'Saint-Étienne': [
    commune('Saint-Étienne', '42000', '42218'), commune('Saint-Gratien', '95210', '95555'),
  ],
  Vitrolles: [commune('Vitrolles', '13127', '13117'), commune('Vitrolles', '05110', '05184')],
};

const libelles = (/** @type {any[]} */ lieux) => lieux.map((lieu) => lieu.properties.label);

describe('VILLE-COMMUNES — en commune, la base d’adresses et rien d’autre', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation((
      /** @type {string} */ chemin,
      /** @type {{ params: { q: string, type?: string } }} */ config,
    ) => {
      const { q, type } = config.params;
      if (chemin === '/geo/search') return Promise.resolve({ data: { data: GEO[q] || [] } });
      // La base d'adresses : une rue n'est rendue que si on demande des rues.
      if (type === 'municipality') return Promise.resolve({ data: { features: BAN[q] || [] } });
      const rue = {
        geometry: { coordinates: [5.2, 43.4] },
        properties: { label: `Rue de ${q}`, type: 'street' },
      };
      return Promise.resolve({ data: { features: [rue] } });
    });
  });

  it.each([
    ['Vitrolles', ['Vitrolles', 'Vitrolles']],
    ['13380', ['Plan-de-Cuques']],
    ['plan de cuques', ['Plan-de-Cuques']],
    ['Saint-Étienne', ['Saint-Étienne', 'Saint-Gratien']],
    ['Marseile', ['Marseille']],
  ])('« %s » ⇒ seulement des communes, sans doublon', async (texte, attendu) => {
    expect(libelles(await searchPlaces(texte, 'municipality'))).toEqual(attendu);
  });

  it('en commune, notre recherche n’est pas interrogée (sièges de clubs, rues)', async () => {
    await searchPlaces('Vitrolles', 'municipality');
    expect(mockGet.mock.calls.map(([chemin]) => chemin)).not.toContain('/geo/search');
  });

  it('aucune commune : une liste vide, jamais de rue', async () => {
    expect(await searchPlaces('Zzzyx', 'municipality')).toEqual([]);
  });
});
