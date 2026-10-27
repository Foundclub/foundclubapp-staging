// PHASE3C02 (27/10/2026) — Q2-04 : « ville · N km » envoyait UNE case de geohash, qui n'existe
// qu'en quelques tailles et n'est pas centrée sur la ville : Aix (26,7 km de Marseille) sortait
// d'un rayon de 30 km, Aubagne (16,3 km) d'un rayon de 19 km. Preuve de la chasse :
// .local/bancs/BUGHUNT-P2-20261025/Q2/prover-15/test.js (vrai ngeohash).
import { encode } from 'ngeohash';

const mockGet = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getUploadEndpoint: jest.fn(() => 'http://localhost:1337/api/upload'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

const { getGeohashForPointAndRadius } = require('@/domains/places/placesUseCases');

const { getClubs, getMultisportClubs } = require('./clubService');

const PAGE_VIDE = {
  data: {
    data: [],
    meta: {
      pagination: {
        page: 1, pageCount: 0, pageSize: 20, total: 0,
      },
    },
  },
};

const MARSEILLE = { lat: 43.2965, lon: 5.3698 };
const VILLES = {
  aix: { lat: 43.5297, lon: 5.4474 },
  aubagne: { lat: 43.2927, lon: 5.5708 },
  avignon: { lat: 43.9493, lon: 4.8055 },
  lyon: { lat: 45.764, lon: 4.8357 },
};

/**
 * Le serveur garde-t-il un lieu de ce geohash avec ce filtre ? Ne lit que `geohash`, `$and`, `$or`.
 * @param {any} filtre - Le filtre Strapi envoyé.
 * @param {string} geohash - Le geohash du lieu (6 caractères, comme le serveur l'écrit).
 * @returns {boolean} Vrai si le lieu passe.
 */
const garde = (filtre, geohash) => Object.entries(filtre || {}).every(([clef, valeur]) => {
  if (clef === '$and') return valeur.every((/** @type {any} */ f) => garde(f, geohash));
  if (clef === '$or') return valeur.some((/** @type {any} */ f) => garde(f, geohash));
  if (clef !== 'geohash') return true;
  if (valeur.$contains !== undefined) return geohash.includes(valeur.$contains);
  if (valeur.$startsWith !== undefined) return geohash.startsWith(valeur.$startsWith);
  throw new Error(`opérateur inattendu : ${JSON.stringify(valeur)}`);
});

/**
 * Les filtres envoyés à une route pour un « ville · N km » de la feuille.
 * @param {(params: any) => Promise<any>} service - getClubs ou getMultisportClubs.
 * @param {string} route - '/clubs' ou '/multisport-clubs'.
 * @param {number} radius - Le rayon en km.
 * @returns {Promise<any>} Les `filters` envoyés.
 */
const filtresEnvoyes = async (service, route, radius) => {
  mockGet.mockReset();
  mockGet.mockResolvedValue(PAGE_VIDE);
  await service({
    // Ce que filtresAvecLieu range pour la liste : la case ET le point et le rayon.
    geohash: getGeohashForPointAndRadius(MARSEILLE.lat, MARSEILLE.lon, radius),
    includeMultisport: false,
    lat: MARSEILLE.lat,
    lon: MARSEILLE.lon,
    radius,
  });
  const appel = mockGet.mock.calls.find(([url]) => url === route);
  if (!appel) throw new Error(`${route} n'a pas été appelé`);
  return appel[1].params.filters;
};

/**
 * Le point à `distance` km du centre, dans la direction `cap` (degrés).
 * @param {{ lat: number, lon: number }} centre - Le centre.
 * @param {number} distance - En km.
 * @param {number} cap - En degrés.
 * @returns {{ lat: number, lon: number }} Le point.
 */
const pointA = (centre, distance, cap) => {
  const r = 6371;
  const t = (/** @type {number} */ x) => (x * Math.PI) / 180;
  const d = distance / r;
  const la1 = t(centre.lat);
  const lo1 = t(centre.lon);
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(t(cap)),
  );
  const lo2 = lo1 + Math.atan2(
    Math.sin(t(cap)) * Math.sin(d) * Math.cos(la1),
    Math.cos(d) - Math.sin(la1) * Math.sin(la2),
  );
  return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
};

describe.each([
  ['clubs', getClubs, '/clubs'],
  ['clubs multisports', getMultisportClubs, '/multisport-clubs'],
])('Q2-04 — %s : « Marseille · N km » garde les lieux du rayon', (_nom, service, route) => {
  it('30 km : Aix (26,7 km) est gardé, Avignon et Lyon non', async () => {
    const filtres = await filtresEnvoyes(service, route, 30);
    expect(garde(filtres, encode(VILLES.aix.lat, VILLES.aix.lon, 6))).toBe(true);
    expect(garde(filtres, encode(VILLES.avignon.lat, VILLES.avignon.lon, 6))).toBe(false);
    expect(garde(filtres, encode(VILLES.lyon.lat, VILLES.lyon.lon, 6))).toBe(false);
  });

  it('19 km : Aubagne (16,3 km) est gardé, Avignon non', async () => {
    const filtres = await filtresEnvoyes(service, route, 19);
    expect(garde(filtres, encode(VILLES.aubagne.lat, VILLES.aubagne.lon, 6))).toBe(true);
    expect(garde(filtres, encode(VILLES.avignon.lat, VILLES.avignon.lon, 6))).toBe(false);
  });

  it.each([1, 5, 10, 19, 20, 30, 50, 100])(
    '%s km : aucun point du cercle (36 caps, 99 % du rayon) n\'est exclu',
    async (radius) => {
      const filtres = await filtresEnvoyes(service, route, radius);
      const exclus = Array.from({ length: 36 }, (_, i) => pointA(MARSEILLE, radius * 0.99, i * 10))
        .filter((p) => !garde(filtres, encode(p.lat, p.lon, 6)));
      expect(exclus).toEqual([]);
    },
  );
});

describe('Q2-04 — coût de la requête', () => {
  it.each([1, 5, 10, 19, 20, 30, 50, 100])(
    '%s km : au plus 32 cases dans le filtre',
    async (radius) => {
      const filtres = await filtresEnvoyes(getClubs, '/clubs', radius);
      expect(JSON.stringify(filtres).split('$startsWith').length - 1).toBeLessThanOrEqual(32);
    },
  );

  it('une seule requête /clubs par page, comme avant', async () => {
    await filtresEnvoyes(getClubs, '/clubs', 30);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('sans point (autres écrans : la case seule), le filtre reste la case', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue(PAGE_VIDE);
    await getClubs({ geohash: 'spey', includeMultisport: false });
    expect(mockGet.mock.calls[0][1].params.filters.geohash).toEqual({ $contains: 'spey' });
  });
});
