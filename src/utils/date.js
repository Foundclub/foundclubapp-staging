/**
 * French weekday prefixes
 */
const WEEKDAY_PREFIX_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/**
 * Format a date with a French day prefix (e.g., "lun 21/11/2025")
 * @param {string | Date | null | undefined} value - The date to format
 * @param {object} [options] - Options
 * @param {string} [options.fallback] - Fallback string if date is invalid
 * @returns {string} - The formatted date string
 */
export const formatDateWithDayPrefix = (value, options) => {
  if (!value) return options?.fallback ?? '';

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return options?.fallback ?? '';
  }

  const weekday = WEEKDAY_PREFIX_FR[date.getDay()];

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const formatted = `${day}/${month}/${year}`;
  return `${weekday} ${formatted}`;
};

/**
 * Format a date WITH its time, French day prefix included
 * (e.g., "mer 20/08/2026 a 18h32").
 *
 * AC07 : la relance doit dire QUAND la precedente est partie. Un jour seul ne
 * suffit pas — l anti-spam se compte en heures, et « deja relance mercredi »
 * laisse croire qu on peut reessayer le jeudi matin.
 * @param {string | Date | null | undefined} value - The date to format
 * @param {object} [options] - Options
 * @param {string} [options.fallback] - Fallback string if date is invalid
 * @returns {string} - The formatted date and time string
 */
export const formatDateTimeWithDayPrefix = (value, options) => {
  const day = formatDateWithDayPrefix(value, options);
  if (!day || !value) return day;

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return day;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} a ${hours}h${minutes}`;
};
