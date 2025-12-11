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
