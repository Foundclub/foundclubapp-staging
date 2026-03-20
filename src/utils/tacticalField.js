/* eslint-disable global-require */

const FIELD_ASPECT_RATIOS = {
  basketball: 1.7,
  football: 1.5,
  generic: 1.5,
  handball: 1.5,
  rugby: 1.4,
  volleyball: 1.8,
};

const FIELD_IMAGES = {
  basketball: require('@/assets/fields/field_basket.png'),
  football: require('@/assets/fields/field_football.png'),
  generic: require('@/assets/fields/field_generic.png'),
  handball: require('@/assets/fields/field_handball.png'),
  rugby: require('@/assets/fields/field_rugby.png'),
  volleyball: require('@/assets/fields/field_volley.png'),
};

const normalizeSportInput = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ');

/**
 * Normalizes a sport label to a tactical field key.
 * @param {string | null | undefined} sport
 * @returns {'basketball' | 'football' | 'generic' | 'handball' | 'rugby' | 'volleyball'}
 */
export const getTacticalSportKey = (sport) => {
  const normalized = normalizeSportInput(sport);

  if (!normalized) return 'generic';
  if (normalized.includes('basket')) return 'basketball';
  if (normalized.includes('foot') || normalized.includes('soccer') || normalized.includes('futsal')) return 'football';
  if (normalized.includes('hand')) return 'handball';
  if (normalized.includes('rugby')) return 'rugby';
  if (normalized.includes('volley')) return 'volleyball';

  return 'generic';
};

/**
 * Returns the tactical field image for a sport.
 * @param {string | null | undefined} sport
 * @returns {any}
 */
export const getTacticalFieldImage = (sport) => FIELD_IMAGES[getTacticalSportKey(sport)] || FIELD_IMAGES.generic;

/**
 * Returns the tactical field aspect ratio for a sport.
 * @param {string | null | undefined} sport
 * @returns {number}
 */
export const getTacticalFieldAspectRatio = (sport) => FIELD_ASPECT_RATIOS[getTacticalSportKey(sport)] || FIELD_ASPECT_RATIOS.generic;
