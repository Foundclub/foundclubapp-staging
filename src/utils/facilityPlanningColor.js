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

// TEXTES-COLLECTIVITES (01/10/2026) — le NOM de chaque couleur (clef sous `facilityForm.colors`) :
// un lecteur d ecran disait « Couleur de planning » dix fois de suite.
export const FACILITY_PLANNING_COLOR_NAMES = {
  '#01B3F4': 'skyBlue',
  '#27D6A3': 'emerald',
  '#4D79FF': 'royalBlue',
  '#4DB3FF': 'lightBlue',
  '#4DFFB3': 'mint',
  '#9D4DFF': 'purple',
  '#FF4D4D': 'red',
  '#FF4D94': 'pink',
  '#FFA115': 'orange',
  '#FFB34D': 'apricot',
};

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

/**
 * COLL1D (2026-09-29) — les couleurs des CLUBS dans le planning d'une installation
 * (SPEC Collectivites §2 C : « une couleur par club »). Les memes teintes que la
 * palette des installations (aucun hexa neuf), dans un autre ordre : les 4 premieres
 * restent lisibles sur fond BLANC (contraste >= 3:1) en plus du fond sombre de l'app
 * (toutes >= 4,49:1) — un planning a 2 ou 3 clubs, le cas courant, est lisible partout.
 * Mesure : src/utils/facilityPlanningColor.COLL1D.test.js.
 */
export const CLUB_PLANNING_PALETTE = [1, 4, 5, 6, 0, 2, 3, 7, 8, 9]
  .map((index) => FACILITY_PLANNING_PALETTE[index]);

/**
 * La cle du club d'un bloc : son identifiant, a defaut son nom.
 * @param {{ club?: { documentId?: string, name?: string } | null }} block - Un bloc du planning.
 * @returns {string} La cle, ou ''.
 */
const clubKeyOf = (block) => String(block?.club?.documentId || block?.club?.name || '').trim();

/**
 * Une couleur par club : chaque bloc recoit `displayColor`, la couleur de SON club.
 * Les clubs sont ranges par nom (puis identifiant) avant d'etre colores : un club
 * garde sa couleur quel que soit l'ordre des blocs de la semaine. Un bloc sans club
 * garde la couleur de son installation (pas de `displayColor`).
 * ponytail: au-dela de 10 clubs sur une meme installation, les couleurs se repetent
 * (la palette en compte 10) — voie de sortie : une legende par club.
 * @param {any[] | null | undefined} blocks - Les blocs du planning (deja normalises).
 * @returns {any[]} Les memes blocs, colores par club.
 */
export const assignClubPlanningColors = (blocks) => {
  if (!Array.isArray(blocks)) return [];
  const clubs = new Map();
  blocks.forEach((block) => {
    const key = clubKeyOf(block);
    if (key && !clubs.has(key)) clubs.set(key, String(block?.club?.name || ''));
  });
  const colorByClub = new Map(
    [...clubs.entries()]
      .sort(([keyA, nameA], [keyB, nameB]) => (
        nameA.localeCompare(nameB, 'fr') || keyA.localeCompare(keyB)
      ))
      .map(([key], index) => [key, CLUB_PLANNING_PALETTE[index % CLUB_PLANNING_PALETTE.length]]),
  );
  return blocks.map((block) => {
    const color = colorByClub.get(clubKeyOf(block));
    return color ? { ...block, displayColor: color } : block;
  });
};
