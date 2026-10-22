import { searchPlaces } from '../placesService';

// RESA-FIN-APP-2 (22/10/2026) — E-P01, tournée 2 : la feuille « Ta ville » de la recherche de
// terrains (`type: 'municipality'`) proposait « Stade du Moulin, chemin du Moulin, Montrivage » —
// un LIEU — là où on attend une ville. Notre recherche (`/geo/search`) mêle aux communes les
// installations et les imports. Demandée, une COMMUNE ne garde que les communes de la base
// d'adresses (`source: 'autocomplete'`) ; sinon, la base d'adresses interrogée en communes.

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

const STADE = {
  address_line: 'chemin du Moulin',
  city: 'Montrivage',
  label: 'Stade du Moulin, chemin du Moulin, Montrivage',
  lat: 45.1,
  lng: 4.2,
  provider: 'internal',
  provider_id: 'fac-1',
  source: 'facility',
};
const MONTRIVAGE_GEO = {
  address_line: '',
  city: 'Montrivage',
  label: 'Montrivage',
  lat: 45.2,
  lng: 4.3,
  postcode: '38000',
  provider: 'ban',
  provider_id: '38999',
  source: 'autocomplete',
};
const MONTRIVAGE_BAN = {
  geometry: { coordinates: [4.3, 45.2] },
  properties: {
    city: 'Montrivage', label: 'Montrivage', postcode: '38000', type: 'municipality',
  },
};

/**
 * Notre recherche rend `geo` ; la base d'adresses rend `ban`.
 * @param {any[]} geo - Les propositions de `/geo/search`.
 * @param {any[]} ban - Les communes de la base d'adresses.
 */
const rend = (geo, ban) => {
  mockGet.mockImplementation((/** @type {string} */ chemin) => Promise.resolve(
    chemin === '/geo/search' ? { data: { data: geo } } : { data: { features: ban } },
  ));
};

const libelles = (/** @type {any[]} */ lieux) => lieux.map((lieu) => lieu.properties.label);

describe('RESA-FIN-APP-2 E-P01 — « Ta ville » ne propose que des villes', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('une commune demandée : le stade est écarté, la commune reste', async () => {
    rend([STADE, MONTRIVAGE_GEO], []);
    expect(libelles(await searchPlaces('Montrivage', 'municipality'))).toEqual(['Montrivage']);
  });

  it('notre recherche ne rend qu’un lieu : la base d’adresses, en communes', async () => {
    rend([STADE], [MONTRIVAGE_BAN]);
    expect(libelles(await searchPlaces('Montrivage', 'municipality'))).toEqual(['Montrivage']);
    expect(mockGet.mock.calls[1][1].params).toEqual(expect.objectContaining({
      q: 'Montrivage', type: 'municipality',
    }));
  });

  it('une adresse (sans type) garde le stade : rien ne change ailleurs', async () => {
    rend([STADE, MONTRIVAGE_GEO], []);
    expect(libelles(await searchPlaces('Montrivage'))).toEqual([
      'Stade du Moulin, chemin du Moulin, Montrivage', 'Montrivage',
    ]);
  });
});
