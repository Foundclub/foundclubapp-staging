// @ts-ignore
import { encode } from 'ngeohash';

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
  const precision = getGeohashPrecision(radius);
  return encode(latitude, longitude, precision);
};
