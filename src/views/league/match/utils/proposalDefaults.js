import { getMatchDurationMinutes } from '@/utils/leagueSportConfig';

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
const safeDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) {
    return null;
  }
  return parsed;
};

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export const toHourMinute = (value) => (value ? String(value).slice(0, 5) : null);

/**
 * @param {Date | string | null | undefined} baseDate
 * @param {string | null | undefined} hourValue
 * @returns {Date}
 */
const buildDateWithHour = (baseDate, hourValue) => {
  const parsedBase = safeDate(baseDate) || new Date();
  const [hRaw, mRaw] = String(hourValue || '').split(':');
  const hour = Number.parseInt(hRaw, 10);
  const minute = Number.parseInt(mRaw, 10);
  const date = new Date(parsedBase);
  date.setHours(Number.isNaN(hour) ? 20 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
  return date;
};

/**
 * @param {string} dayName
 * @param {string | null | undefined} startHour
 * @returns {Date}
 */
const getNextOccurrenceForDay = (dayName, startHour) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const normalized = String(dayName || '').toLowerCase();
  const target = days.indexOf(normalized);
  const now = new Date();

  if (target < 0) {
    return buildDateWithHour(now, startHour || '20:00');
  }

  const currentDay = now.getDay();
  let diff = target - currentDay;
  if (diff < 0) diff += 7;
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + diff);
  const candidate = buildDateWithHour(nextDate, startHour || '20:00');
  if (diff === 0 && candidate <= now) {
    nextDate.setDate(nextDate.getDate() + 7);
    return buildDateWithHour(nextDate, startHour || '20:00');
  }
  return candidate;
};

/**
 * @param {LeagueMatch | null} match
 * @returns {LeagueSlot | null}
 */
const findSelectedCommonSlot = (match) => {
  const allCommonSlots = Array.isArray(match?.common_slots) ? (match?.common_slots || []) : [];
  if (allCommonSlots.length === 0) return null;

  const recurringDay = String(match?.recurring_day || '').toLowerCase();
  const recurringStart = toHourMinute(match?.recurring_start_hour);

  const exact = allCommonSlots.find((/** @type {LeagueSlot} */ slot) => {
    const slotDay = String(slot?.day || '').toLowerCase();
    const slotStart = toHourMinute(slot?.startHour || slot?.start_hour);
    if (!slotDay || !slotStart) return false;
    return slotDay === recurringDay && slotStart === recurringStart;
  });

  return exact || allCommonSlots[0];
};

/**
 * @param {LeagueMatch | null} match
 * @returns {{ date: Date, start: Date, end: Date }}
 */
export const buildProposalDefaultsFromMatch = (match) => {
  const durationMinutes = getMatchDurationMinutes(match?.team_a?.sport || match?.team_b?.sport || match?.sport);
  if (!match) {
    const fallbackStart = buildDateWithHour(new Date(), '20:00');
    return {
      date: fallbackStart,
      end: new Date(fallbackStart.getTime() + (durationMinutes * 60 * 1000)),
      start: fallbackStart,
    };
  }

  const selectedSlot = findSelectedCommonSlot(match);
  const slotDay = String(match?.recurring_day || selectedSlot?.day || '').toLowerCase();
  const slotStart = toHourMinute(match?.recurring_start_hour)
    || toHourMinute(selectedSlot?.startHour || selectedSlot?.start_hour)
    || '20:00';
  const slotEnd = toHourMinute(match?.recurring_end_hour)
    || toHourMinute(selectedSlot?.endHour || selectedSlot?.end_hour)
    || null;

  let start = safeDate(match?.proposed_time) || safeDate(match?.date);
  if (!start) {
    start = getNextOccurrenceForDay(slotDay, slotStart);
  } else {
    start = buildDateWithHour(start, slotStart);
  }

  let end = safeDate(match?.location?.proposed_end_time);
  if (!end && slotEnd) {
    end = buildDateWithHour(start, slotEnd);
  }
  if (!end || end <= start) {
    end = new Date(start.getTime() + (durationMinutes * 60 * 1000));
  }

  return {
    date: start,
    end,
    start,
  };
};
