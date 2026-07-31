export const colors = {
  error100: '#ffe1e7',
  error300: '#ff8fa3',
  error500: '#ff284f',
  error700: '#d02544',

  gold100: '#FFF8E1',
  gold200: '#FFE082',
  gold500: '#FFD700',
  gold700: '#C5A000',
  gold900: '#3D2E0F',
  neutral00: '#ffffff',
  neutral100: '#e5e6e6',
  neutral200: '#d3d4d4',
  neutral300: '#adb1b2',
  neutral400: '#92979a',
  neutral50: '#f1f2f2',

  neutral500: '#777c7e',
  neutral600: '#5f6366',
  neutral700: '#474b4c',
  neutral800: '#242526',
  neutral900: '#0c0c0d',

  primary100: '#e6f7fe',
  primary200: '#99e1fb',
  primary300: '#66d2f9',
  // Palier manquant de la rampe (interpole entre primary300 et primary500).
  // Deja consomme par ClubSelector avant d'exister : cf. THEME.md.
  primary400: '#33c3f7',
  primary500: '#01b3f4',
  primary600: '#0096d1',

  primary700: '#173844',
  primary800: '#0b2530',
  primary900: '#001218',
  success100: '#d4fcf0',
  success200: '#8ae9cd',
  success500: '#27d6a3',

  success700: '#399379',
  warning100: '#fff4e5',
  warning400: '#ffbc4d',
  warning500: '#ffa115',
  warning700: '#cc7a00',
  warning900: '#8a4f00',

  // @deprecated compatibility aliases (to remove after design-system migration)
  danger500: '#ff284f',
  error: '#ff284f',
  primary: '#01b3f4',
  secondary: '#ffa115',
  textSecondary: '#adb1b2',

  transparent: 'transparent',

  // Rose du chip TOURNOI (handoff « Cartes Rechercher », tour 3b).
  rose500: '#ff2e7e',

  // Verrou des fonctionnalites de l'offre Club (handoff design, decision 7).
  violet200: '#b7a5ff',
  violet500: '#8567ff',
};

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const RGB_FUNC = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i;

const clampAlpha = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
};

/**
 * Applique une opacite a une couleur du theme, sans ecrire de litteral rgba() a la main.
 *
 * C'est l'unique moyen legitime de teinter un jeton : `withAlpha(Colors.primary500, 0.14)`
 * remplace `rgba(1, 179, 244, 0.14)`, qui echappe au controle du contrat de theme parce
 * qu'il ne ressemble pas a un jeton (cf. scripts/verify-theme-contract.js, regle rgb/rgba).
 *
 * Accepte #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(). `transparent` reste `transparent`.
 * Une couleur non reconnue est renvoyee telle quelle (pas d'exception en rendu).
 * @param {string} color - Jeton de couleur du theme (ex. Colors.primary500).
 * @param {number} alpha - Opacite entre 0 et 1.
 * @returns {string} - La couleur en rgba(), ou la valeur d'origine si non parsable.
 */
export const withAlpha = (color, alpha) => {
  if (typeof color !== 'string') return color;
  const value = color.trim();
  if (value === '' || value.toLowerCase() === 'transparent') return 'transparent';

  const nextAlpha = clampAlpha(alpha);
  let r;
  let g;
  let b;
  let baseAlpha = 1;

  const shortHex = HEX_SHORT.exec(value);
  const longHex = HEX_LONG.exec(value);
  const rgbFunc = RGB_FUNC.exec(value);

  if (shortHex) {
    [r, g, b] = [shortHex[1], shortHex[2], shortHex[3]].map((part) => parseInt(part + part, 16));
  } else if (longHex) {
    [r, g, b] = [longHex[1], longHex[2], longHex[3]].map((part) => parseInt(part, 16));
    if (longHex[4] !== undefined) baseAlpha = parseInt(longHex[4], 16) / 255;
  } else if (rgbFunc) {
    [r, g, b] = [rgbFunc[1], rgbFunc[2], rgbFunc[3]].map((part) => Math.round(Number(part)));
    if (rgbFunc[4] !== undefined) baseAlpha = clampAlpha(rgbFunc[4]);
  } else {
    return color;
  }

  if ([r, g, b].some((part) => !Number.isFinite(part) || part < 0 || part > 255)) return color;

  // L'opacite demandee se compose avec celle deja portee par la couleur source.
  const finalAlpha = Math.round(nextAlpha * baseAlpha * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
};

/**
 * Get the colors for the current theme
 * @returns {import('./types').Colors} - The colors
 */
const getThemeColors = () => {
  /**
   * @type {import('./types').Colors}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.entries(colors).reduce((acc, [key, value]) => ({
    ...acc,
    [key]: value,
  }), initialAcc);
};

export default getThemeColors;
