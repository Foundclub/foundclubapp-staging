const LEAGUE_TIMEZONE = 'Europe/Paris';

/**
 * @typedef {{ year: number; month: number; day: number; hour: number; minute: number; second: number }} ZonedDateParts
 */

/**
 * @param {Date} date
 * @param {string} [timeZone]
 * @returns {ZonedDateParts}
 */
const getZonedDateParts = (date, timeZone = LEAGUE_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = /** @type {Record<string, string>} */ ({});
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }

  return {
    day: Number.parseInt(values.day, 10),
    hour: Number.parseInt(values.hour, 10),
    minute: Number.parseInt(values.minute, 10),
    month: Number.parseInt(values.month, 10),
    second: Number.parseInt(values.second, 10),
    year: Number.parseInt(values.year, 10),
  };
};

/**
 * @param {ZonedDateParts} localDateTime
 * @param {string} [timeZone]
 * @returns {Date}
 */
const toUtcFromZonedLocal = (localDateTime, timeZone = LEAGUE_TIMEZONE) => {
  let utcMs = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second || 0,
    0
  );

  const desiredMinutes = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second || 0,
    0
  ) / 60000;

  for (let i = 0; i < 4; i += 1) {
    const actual = getZonedDateParts(new Date(utcMs), timeZone);
    const actualMinutes = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second || 0,
      0
    ) / 60000;

    const diffMinutes = desiredMinutes - actualMinutes;
    if (diffMinutes === 0) break;
    utcMs += diffMinutes * 60 * 1000;
  }

  return new Date(utcMs);
};

/**
 * @param {Date} localDate
 * @returns {Date | null}
 */
export const toParisUtcDateFromLocalSelection = (localDate) => {
  if (!(localDate instanceof Date) || Number.isNaN(localDate.getTime())) return null;
  return toUtcFromZonedLocal({
    year: localDate.getFullYear(),
    month: localDate.getMonth() + 1,
    day: localDate.getDate(),
    hour: localDate.getHours(),
    minute: localDate.getMinutes(),
    second: localDate.getSeconds(),
  }, LEAGUE_TIMEZONE);
};

/**
 * @param {Date} localDate
 * @returns {string | null}
 */
export const toParisIsoFromLocalSelection = (localDate) => {
  const utcDate = toParisUtcDateFromLocalSelection(localDate);
  return utcDate ? utcDate.toISOString() : null;
};

/**
 * @param {string | number | Date} instantLike
 * @returns {Date | null}
 */
export const toDeviceDateFromParisInstant = (instantLike) => {
  const instant = new Date(instantLike);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = getZonedDateParts(instant, LEAGUE_TIMEZONE);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
};

export const getParisNowAsDeviceDate = () => toDeviceDateFromParisInstant(new Date()) || new Date();

export { LEAGUE_TIMEZONE };
