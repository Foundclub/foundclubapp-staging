// @ts-ignore
import { bboxes, encode } from 'ngeohash';

/**
 * Calculate appropriate geohash precision based on radius
 * @param {number} radius - Radius in km
 * @returns {number} Geohash precision
 *
 * Approximate square sizes for each precision:
 * 1 = 5000km×5000km
 * 2 = 1250km×625km
 * 3 = 156km×156km
 * 4 = 39.1km×19.5km
 * 5 = 4.89km×4.89km
 * 6 = 1.22km×0.61km
 * 7 = 153m×153m
 * 8 = 38.2m×19.1m
 */
const getGeohashPrecision = (radius) => {
  if (radius >= 2500) return 1;
  if (radius >= 625) return 2;
  if (radius >= 78) return 3;
  if (radius >= 20) return 4;
  if (radius >= 2.5) return 5;
  if (radius >= 0.6) return 6;
  if (radius >= 0.076) return 7;
  return 8;
};

/**
 * Get a geohash for a point with precision based on radius
 * @param {number} latitude - Latitude of the point
 * @param {number} longitude - Longitude of the point
 * @param {number} radius - Radius in km
 * @returns {string} Geohash covering the area
 */
export const getGeohashForPointAndRadius = (latitude, longitude, radius) => {
  // BH03 · P11-14 : NaN donnait « 00000 », un faux filtre de zone.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  const precision = getGeohashPrecision(radius);
  return encode(latitude, longitude, precision);
};

const KM_PAR_DEGRE = 111.32;
// Au-delà, on passe à des cases plus grandes. Mesure PHASE3C02 (Marseille) : 16 faisait garder des
// lieux jusqu'à 231 km pour un rayon de 50 km ; 32 : 101 km (4 à 30 cases de 1 à 50 km).
const CASES_MAX = 32;

/**
 * Un nombre, ou NaN pour une valeur absente (`Number(null)` vaudrait 0, un faux point).
 * @param {any} valeur
 * @returns {number}
 */
const nombre = (valeur) => (
  valeur === null || valeur === undefined || valeur === '' ? NaN : Number(valeur)
);

/**
 * PHASE3C02 · Q2-04 — le point et le rayon d'un filtre « ville · N km », ou rien.
 * @param {any} latitude
 * @param {any} longitude
 * @param {any} radius - En km.
 * @returns {{ lat: number, lon: number, radius: number } | null}
 */
export const pointEtRayon = (latitude, longitude, radius) => {
  const lat = nombre(latitude);
  const lon = nombre(longitude);
  const rayon = nombre(radius);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(rayon > 0)) return null;
  return { lat, lon, radius: rayon };
};

/**
 * PHASE3C02 · Q2-04 — le filtre Strapi qui garde TOUT le cercle : les cases de geohash qui couvrent
 * son carré englobant. La case seule (getGeohashForPointAndRadius) n'est pas centrée sur la
 * ville : Aix, à 26,7 km de Marseille, sortait d'un rayon de 30 km.
 * ponytail: les coins du carré et les bords des cases gardent aussi des lieux au-delà du rayon
 * (30 km : jusqu'à 67 km, comme la case seule avant). Sortie : la distance réelle côté serveur,
 * comme /events.
 * @param {any} latitude
 * @param {any} longitude
 * @param {any} radius - En km.
 * @returns {{ $or: { geohash: { $startsWith: string } }[] } | null} Rien sans point ni rayon.
 */
export const filtreGeohashDuCercle = (latitude, longitude, radius) => {
  const zone = pointEtRayon(latitude, longitude, radius);
  if (!zone) return null;
  const dLat = zone.radius / KM_PAR_DEGRE;
  const cosLat = Math.max(Math.cos((zone.lat * Math.PI) / 180), 0.01);
  const dLon = zone.radius / (KM_PAR_DEGRE * cosLat);
  const sud = Math.max(zone.lat - dLat, -90);
  const nord = Math.min(zone.lat + dLat, 90);
  const ouest = Math.max(zone.lon - dLon, -180);
  const est = Math.min(zone.lon + dLon, 180);
  let precision = getGeohashPrecision(zone.radius);
  /** @type {string[]} */
  let cases = bboxes(sud, ouest, nord, est, precision);
  while (cases.length > CASES_MAX && precision > 1) {
    precision -= 1;
    cases = bboxes(sud, ouest, nord, est, precision);
  }
  return { $or: cases.map((cellule) => ({ geohash: { $startsWith: cellule } })) };
};
