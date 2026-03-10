/**
 * Central color palette for club facilities in planning views.
 * Fixed palette by product decision (no free HEX input).
 */
export const FACILITY_PLANNING_PALETTE = [
  '#01B3F4',
  '#4D79FF',
  '#27D6A3',
  '#FFA115',
  '#FF4D4D',
  '#9D4DFF',
  '#FF4D94',
  '#4DB3FF',
  '#4DFFB3',
  '#FFB34D',
];

/**
 * @param {string | undefined | null} color
 * @returns {string}
 */
const normalizeHexColor = (color) => String(color || '').trim().toUpperCase();

/**
 * @param {string | undefined | null} color
 * @returns {boolean}
 */
export const isValidFacilityPlanningColor = (color) => (
  FACILITY_PLANNING_PALETTE.includes(normalizeHexColor(color))
);

/**
 * @param {{ documentId?: string | number; id?: string | number; name?: string } | undefined | null} facility
 * @returns {number}
 */
const hashFacilitySeed = (facility) => {
  const seed = String(
    facility?.documentId
      || facility?.id
      || facility?.name
      || '',
  );

  if (!seed) return 0;

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Resolve facility planning color with deterministic fallback for legacy facilities.
 * Returns null only when facility context is missing.
 *
 * @param {{ planningColor?: string; color?: string; documentId?: string | number; id?: string | number; name?: string } | undefined | null} facility
 * @returns {string | null}
 */
export const resolveFacilityPlanningColor = (facility) => {
  if (!facility) return null;

  const explicitColor = normalizeHexColor(facility?.planningColor || facility?.color);
  if (isValidFacilityPlanningColor(explicitColor)) {
    return explicitColor;
  }

  const paletteIndex = hashFacilitySeed(facility) % FACILITY_PLANNING_PALETTE.length;
  return FACILITY_PLANNING_PALETTE[paletteIndex];
};

