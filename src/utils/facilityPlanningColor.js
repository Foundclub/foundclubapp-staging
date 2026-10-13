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
 * Les cles des clubs de la Ville, dans l'ordre de sa liste, sans doublon.
 * @param {Array<{ documentId?: string, name?: string }> | null | undefined} clubsDeLaVille - La
 *   liste des clubs rattaches, telle que le serveur la rend (par nom).
 * @returns {string[]} Les cles.
 */
const clesDesClubsDeLaVille = (clubsDeLaVille) => [...new Set(
  (Array.isArray(clubsDeLaVille) ? clubsDeLaVille : [])
    .map((club) => String(club?.documentId || club?.name || '').trim())
    .filter(Boolean),
)];

/**
 * Une couleur par club : chaque bloc recoit `displayColor`, la couleur de SON club.
 * COLL-R-A6 (13/10/2026, COL-019, decision d'Adel D13 = A) — avec `clubsDeLaVille`, la couleur
 * d'un club est son RANG DANS LA LISTE DES CLUBS DE LA VILLE : la meme dans « Creneaux », dans
 * « Planning » et dans la legende, une semaine ou il est seul comme une semaine ou il en suit un
 * autre. Avant, elle suivait son rang parmi les clubs PRESENTS dans la vue, ranges par nom : elle
 * changeait d'une semaine et d'une installation a l'autre. Un club absent de la liste (pas rattache
 * a cette Ville) prend les couleurs suivantes. Sans la liste (lecteur qui n'est pas la Ville), les
 * clubs presents sont ranges par nom, comme avant. Un bloc sans club garde la couleur de son
 * installation (pas de `displayColor`).
 * ponytail: au-dela de 10 clubs, les couleurs se repetent (la palette en compte 10), et un club qui
 * rejoint la Ville decale ceux qui le suivent — voie de sortie : la couleur choisie a la main par
 * la Ville (lot « couleur a la main », un champ serveur).
 * @param {any[] | null | undefined} blocks - Les blocs du planning (deja normalises).
 * @param {Array<{ documentId?: string, name?: string }> | null} [clubsDeLaVille] - Les clubs
 *   rattaches a la Ville, dans l'ordre de sa liste.
 * @returns {any[]} Les memes blocs, colores par club.
 */
export const assignClubPlanningColors = (blocks, clubsDeLaVille = null) => {
  if (!Array.isArray(blocks)) return [];
  const clubs = new Map();
  blocks.forEach((block) => {
    const key = clubKeyOf(block);
    if (key && !clubs.has(key)) clubs.set(key, String(block?.club?.name || ''));
  });
  const ordreDeLaVille = clesDesClubsDeLaVille(clubsDeLaVille);
  const horsDeLaListe = [...clubs.entries()]
    .filter(([key]) => !ordreDeLaVille.includes(key))
    .sort(([keyA, nameA], [keyB, nameB]) => (
      nameA.localeCompare(nameB, 'fr') || keyA.localeCompare(keyB)
    ))
    .map(([key]) => key);
  const colorByClub = new Map(
    [...ordreDeLaVille, ...horsDeLaListe]
      .map((key, index) => [key, CLUB_PLANNING_PALETTE[index % CLUB_PLANNING_PALETTE.length]]),
  );
  return blocks.map((block) => {
    const color = colorByClub.get(clubKeyOf(block));
    return color ? { ...block, displayColor: color } : block;
  });
};

/**
 * COLL-R-A6 (COL-019, planche P7v4-couleur) — la legende « couleur -> club » des blocs DEJA
 * colores : un club par couleur, ranges par nom ; les blocs sans club n'y sont pas.
 * @param {any[] | null | undefined} blocks - Les blocs colores (`assignClubPlanningColors`).
 * @returns {Array<{ couleur: string, nom: string }>} La legende.
 */
export const legendeDesClubs = (blocks) => {
  const vus = new Map();
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const key = clubKeyOf(block);
    if (key && block?.displayColor && !vus.has(key)) {
      vus.set(key, { couleur: block.displayColor, nom: String(block?.club?.name || '') });
    }
  });
  return [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
};
