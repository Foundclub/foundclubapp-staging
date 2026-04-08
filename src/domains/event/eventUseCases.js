import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

import i18n from '@/theme/strings';

import { USER_ROLES } from '../auth/authUseCases';

export const SESSIONS_STATUS_OPTIONS = [
  {
    label: i18n.t('eventEdit.fields.sessionStatus.options.open'),
    value: 'open',
  },
  {
    label: i18n.t('eventEdit.fields.sessionStatus.options.closed'),
    value: 'closed',
  },
];

export const RECURRENCE_FREQUENCY_OPTIONS = [

  {
    label: i18n.t('eventEdit.fields.recurrenceFrequency.options.week'),
    value: 'week',
  },
  {
    label: i18n.t('eventEdit.fields.recurrenceFrequency.options.month'),
    value: 'month',
  },
];

export const VALIDATION_MODE_OPTIONS = [
  {
    label: i18n.t('eventEdit.fields.validationMode.options.auto'),
    value: 'auto',
  },
  {
    label: i18n.t('eventEdit.fields.validationMode.options.manual'),
    value: 'manual',
  },
];

export const normalizeEventTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export const isStageEventType = (typeName = '') => normalizeEventTypeLabel(typeName).includes('stage');

/**
 * Format a date string to send
 * @param {string | undefined} dateString - The date string to format
 * @param {string | undefined} timeString - The time string to format
 * @returns {string | undefined} The formatted date string or null if invalid
 */
const padTimePart = (value, size = 2) => String(value).padStart(size, '0');

const getTimeParts = (value) => {
  if (!value) return undefined;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return {
      hours: value.getHours(),
      milliseconds: value.getMilliseconds(),
      minutes: value.getMinutes(),
      seconds: value.getSeconds(),
    };
  }

  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;

  const fullMatch = normalized.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (fullMatch) {
    return {
      hours: Number.parseInt(fullMatch[1], 10),
      milliseconds: Number.parseInt(String(fullMatch[4] || '0').padEnd(3, '0'), 10),
      minutes: Number.parseInt(fullMatch[2], 10),
      seconds: Number.parseInt(fullMatch[3], 10),
    };
  }

  const shortMatch = normalized.match(/^(\d{2}):(\d{2})$/);
  if (shortMatch) {
    return {
      hours: Number.parseInt(shortMatch[1], 10),
      milliseconds: 0,
      minutes: Number.parseInt(shortMatch[2], 10),
      seconds: 0,
    };
  }

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) return undefined;

  return {
    hours: parsedDate.getHours(),
    milliseconds: parsedDate.getMilliseconds(),
    minutes: parsedDate.getMinutes(),
    seconds: parsedDate.getSeconds(),
  };
};

export const formatDateTimeToSend = (dateString, timeString) => {
  if (!dateString || !timeString) return undefined;

  const timeParts = getTimeParts(timeString);
  if (!timeParts) return undefined;

  let date;
  if (typeof dateString === 'string' && dateString.includes('/')) {
    const splittedDate = dateString.split('/');
    const day = splittedDate[0];
    const month = splittedDate[1];
    const year = splittedDate[2];
    date = new Date(`${year}-${month}-${day}T${padTimePart(timeParts.hours)}:${padTimePart(timeParts.minutes)}:${padTimePart(timeParts.seconds)}.${padTimePart(timeParts.milliseconds, 3)}`);
  } else {
    const parsedDate = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) return undefined;
    date = new Date(parsedDate);
    date.setHours(timeParts.hours, timeParts.minutes, timeParts.seconds, timeParts.milliseconds);
  }

  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

/**
 * Format the date value to add a '/' to respect the format jj/mm/aaaa.
 * @param {string} date - The date value.
 * @returns {string} The formatted date.
 */
export const formatDateInput = (date) => {
  // Remove any non-digits
  const digits = date.replace(/\D/g, '');

  // Apply mask as user types
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

/**
 * Convert a date string in the format 'dd/mm/yyyy' to a Date object.
 * @param {string} dateString
 * @returns {Date | undefined}
 */
/**
 * Convert a date string in the format 'dd/mm/yyyy' to a Date object.
 * @param {string} dateString
 * @returns {Date | undefined}
 */
export const getDateFromDateInput = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return undefined;
  const splittedDate = dateString.split('/');
  const day = splittedDate[0];
  const month = splittedDate[1];
  const year = splittedDate[2];
  const date = new Date(`${year}-${month}-${day}`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

/**
 * Format the time value to add a ':' to respect the format hh:mm.
 * @param {string} time - The time value.
 * @returns {string} The formatted time.
 */
export const formatTimeInput = (time) => {
  // Remove any non-digits
  if (!time || typeof time !== 'string') return '';
  const digits = time.replace(/\D/g, '');

  // Apply mask as user types
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

/**
 * Validate the date format and value.
 * @param {string} dateString - The date string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
export const isValidDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return false;

  // Check format DD/MM/YYYY
  const pattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateString.match(pattern);
  if (!match) return false;

  const [, day, month, year] = match;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  // Check ranges
  if (monthNum < 1 || monthNum > 12) return false;
  if (dayNum < 1 || dayNum > 31) return false;

  // Check days in month
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  if (dayNum > daysInMonth) return false;

  return true;
};

/**
 * Validate the time format and value.
 * @param {string} timeString - The time string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
export const isValidTime = (timeString) => {
  if (!timeString || typeof timeString !== 'string') return false;

  // Check format HH:mm
  const pattern = /^(\d{2}):(\d{2})$/;
  const match = timeString.match(pattern);
  if (!match) return false;

  const [, hours, minutes] = match;
  const hoursNum = parseInt(hours, 10);
  const minutesNum = parseInt(minutes, 10);

  // Check ranges
  if (hoursNum < 0 || hoursNum > 23) return false;
  if (minutesNum < 0 || minutesNum > 59) return false;

  return true;
};

/**
 * Format time string from HH:mm to HH:mm:ss.SSS format for Strapi
 * @param {string | undefined} timeString - The time string in HH:mm format
 * @returns {string | undefined} The formatted time string in HH:mm:ss.SSS format
 */
const formatTimeForStrapi = (timeString) => {
  const timeParts = getTimeParts(timeString);
  if (!timeParts) return undefined;

  const {
    hours,
    milliseconds,
    minutes,
    seconds,
  } = timeParts;

  if (
    hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
    || seconds < 0
    || seconds > 59
    || milliseconds < 0
    || milliseconds > 999
  ) {
    return undefined;
  }

  return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}.${padTimePart(milliseconds, 3)}`;
};

const buildLocationPayload = (location) => {
  const parsedLat = Number.isFinite(location?.lat)
    ? Number(location.lat)
    : Number.parseFloat(String(location?.value?.split?.('|')?.[1] || ''));
  const parsedLng = Number.isFinite(location?.lng)
    ? Number(location.lng)
    : Number.parseFloat(String(location?.value?.split?.('|')?.[0] || ''));
  const hasResolvedCoordinates = Number.isFinite(parsedLat)
    && Number.isFinite(parsedLng)
    && (Math.abs(parsedLat) > 0.000001 || Math.abs(parsedLng) > 0.000001);

  return {
    location: hasResolvedCoordinates ? {
      lat: parsedLat,
      lng: parsedLng,
    } : undefined,
    locationDetails: location?.label ? JSON.stringify({ address: location.label }) : null,
  };
};

const formatStageDate = (value) => {
  if (!value) return '';
  return format(new Date(value), 'yyyy-MM-dd');
};

/**
 * Create the event payload for the API from the event form data
 * @param {FCEventForm} event
 * @returns {FCEventForm}
 */
export const createEventPayload = (event) => {
  const effectiveStartTime = event.startTime || event.time;
  const locationPayload = buildLocationPayload(event.location);
  const formattedData = {
    ...event,
    date: formatDateTimeToSend(event.date, effectiveStartTime),
    location: locationPayload.location,
    locationDetails: locationPayload.locationDetails,
    // Format startTime and endTime for Strapi (HH:mm:ss.SSS)
    endTime: formatTimeForStrapi(event.endTime),
    startTime: formatTimeForStrapi(effectiveStartTime),
  };

  delete formattedData.time;
  delete formattedData.recurrenceDay;
  delete formattedData.recurrenceFrequency;
  delete formattedData.recurrenceStartDate;
  delete formattedData.recurrenceEndDate;
  delete formattedData.recurrenceInterval;
  delete formattedData.recurrenceDays;
  delete formattedData.isRecurrent;
  delete formattedData.requestFeatured; // Ne pas envoyer à Strapi
  delete formattedData.stageDefaultEndTime;
  delete formattedData.stageDefaultStartTime;
  delete formattedData.stageEndDate;
  delete formattedData.stageSchedule;
  delete formattedData.stageStartDate;

  // Remove undefined or null numeric fields to let Strapi use defaults
  if (formattedData.capacity == null || formattedData.capacity === '') delete formattedData.capacity;
  if (formattedData.pricePerPerson == null || formattedData.pricePerPerson === '') delete formattedData.pricePerPerson;
  if (formattedData.totalPlayers == null || formattedData.totalPlayers === '') delete formattedData.totalPlayers;
  if (!formattedData.location) delete formattedData.location;
  if (!formattedData.locationDetails) delete formattedData.locationDetails;
  if (!formattedData.endTime) delete formattedData.endTime;
  if (!formattedData.startTime) delete formattedData.startTime;

  return formattedData;
};

export const createStageEventPayload = (event) => {
  const stageSchedule = Array.isArray(event?.stageSchedule) ? event.stageSchedule : [];
  const activeDays = stageSchedule.filter((entry) => entry?.isActive !== false);

  if (!activeDays.length) {
    return createEventPayload(event);
  }

  const sortedDays = [...activeDays].sort((left, right) => (
    String(left?.date || '').localeCompare(String(right?.date || ''))
  ));
  const firstDay = sortedDays[0];
  const lastDay = sortedDays[sortedDays.length - 1];
  const firstDate = format(new Date(firstDay.date), 'dd/MM/yyyy');
  const lastEndDateIso = formatDateTimeToSend(format(new Date(lastDay.date), 'dd/MM/yyyy'), lastDay.endTime);
  const basePayload = createEventPayload({
    ...event,
    date: firstDate,
    endTime: event.stageDefaultEndTime || firstDay.endTime,
    isRecurrent: false,
    startTime: event.stageDefaultStartTime || firstDay.startTime,
  });

  return {
    ...basePayload,
    endDate: lastEndDateIso,
    eventFormat: 'stage_parent',
    stageDefaultEndTime: formatTimeForStrapi(event.stageDefaultEndTime || firstDay.endTime),
    stageDefaultStartTime: formatTimeForStrapi(event.stageDefaultStartTime || firstDay.startTime),
    stageEndDate: formatStageDate(event.stageEndDate || lastDay.date),
    stageSchedule: stageSchedule.map((entry) => {
      const dayLocationPayload = buildLocationPayload(entry?.location);
      return {
        date: formatStageDate(entry?.date),
        endTime: formatTimeForStrapi(entry?.endTime),
        facility: entry?.facilityId || entry?.facility?.documentId || entry?.facility || null,
        isActive: entry?.isActive !== false,
        location: dayLocationPayload.location,
        locationDetails: dayLocationPayload.locationDetails,
        startTime: formatTimeForStrapi(entry?.startTime),
      };
    }),
    stageStartDate: formatStageDate(event.stageStartDate || firstDay.date),
  };
};

/**
 * Create the event payload for the API from the event form data for reccurent events
 * @param {FCEventForm} event
 * @returns {FCEventForm[]}
 */
export const createReccurrentEventPayload = (event) => {
  if (isStageEventType(event?.type?.name || event?.typeName || '')) {
    return [createStageEventPayload(event)];
  }

  if (event.isRecurrent && event.recurrenceStartDate && event.recurrenceEndDate) {
    const startDate = getDateFromDateInput(event.recurrenceStartDate) || new Date();
    const endDate = getDateFromDateInput(event.recurrenceEndDate) || new Date();

    // Generate a unique recurrence group ID
    const recurrenceGroupId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const events = [];
    const currentDate = new Date(startDate); // Start from the recurrence start date
    // Parse recurrence days (ensure they are numbers)
    const recurrenceDays = (event.recurrenceDays || []).map(Number);
    const interval = event.recurrenceInterval || 1;

    // If frequency is week and we have specific days
    if (event.recurrenceFrequency === 'week' && recurrenceDays.length > 0) {
      // Align currentDate to the start of the week (Monday) of the startDate
      // This ensures our week blocks are aligned with the calendar week
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const weekStart = new Date(currentDate);
      weekStart.setDate(diff);

      // Loop until weekStart exceeds endDate
      while (weekStart <= endDate) {
        // For this week, create events for selected days
        recurrenceDays.forEach((dayIndex) => {
          // Calculate date for this day in the current week
          // Monday is base.
          // dayIndex: 0 (Sun) -> +6 days
          // dayIndex: 1 (Mon) -> +0 days
          // ...
          const offset = dayIndex === 0 ? 6 : dayIndex - 1;
          const eventDate = new Date(weekStart);
          eventDate.setDate(weekStart.getDate() + offset);

          // Check if eventDate is within range [startDate, endDate]
          // We must check startDate because we aligned to Monday, which might be before startDate
          if (eventDate >= startDate && eventDate <= endDate) {
            const formattedEvent = {
              ...event,
              date: format(eventDate, 'dd/MM/yyyy'),
              location: event.location,
              recurrenceGroupId, // Add the group ID
            };
            events.push(createEventPayload(formattedEvent));
          }
        });

        // Move to next week block
        weekStart.setDate(weekStart.getDate() + (7 * interval));
      }
    } else {
      // Fallback for Month or Week without specific days (legacy/simple mode)
      // Or if user didn't select days for week (should be validated, but safe fallback)
      while (currentDate <= endDate) {
        const formattedEvent = {
          ...event,
          date: format(currentDate, 'dd/MM/yyyy'),
          location: event.location,
          recurrenceGroupId,
        };
        events.push(createEventPayload(formattedEvent));

        if (event.recurrenceFrequency === 'week') {
          currentDate.setDate(currentDate.getDate() + (7 * interval));
        } else if (event.recurrenceFrequency === 'month') {
          currentDate.setMonth(currentDate.getMonth() + interval);
        }
      }
    }

    return events;
  }
  return [createEventPayload(event)];
};

/**
 * Get the options for the recurrence day based on the frequency
 * @param {string} recurrenceFrequency - The frequency of recurrence ('week' or 'month')
 * @returns {Array<{ label: string, value: string }>} - The options for the recurrence day
 */
export const getReccurrenceDayOptions = (recurrenceFrequency) => {
  if (recurrenceFrequency === 'week') {
    return Array.from({ length: 7 }, (_, i) => {
      // Create date for each day of the week (0 = Sunday, 1 = Monday, etc.)
      const date = new Date(2021, 0, 3 + i); // Jan 3, 2021 was a Sunday
      const dayIndex = date.getDay();
      return {
        label: format(date, 'EEEE', { locale: fr }),
        value: dayIndex.toString(),
      };
    });
  }

  return Array.from({ length: 31 }, (_, i) => ({
    label: `${i + 1}`,
    value: `${i + 1}`,
  }));
};

/**
 * Check if the event can be joined
 * @param {object} params - The parameters to check
 * @param {number} params.capacity - The maximum capacity of the event
 * @param {User[]} params.participations - The list of participants
 * @param {string} [params.userId] - The ID of the user to check
 * @param {Role} [params.userRole] - The role of the user
 * @returns {boolean} - True if the event can be joined, false otherwise
 */
export const canEventBeJoined = (
  {
    capacity, participations, userId, userRole,
  },
) => {
  if (!capacity) return true;
  return userRole?.name === USER_ROLES.player && participations.length < capacity
    && !participations.some((/** @type {User} */ p) => p.documentId === userId);
};

/**
 * Check if the user has already joined the event
 * @param {object} params - The parameters to check
 * @param {User[]} params.participations - The list of participants
 * @param {string} [params.userId] - The ID of the user to check
 * @returns {boolean} - True if the user has already joined, false otherwise
 */
export const haveIAlreadyJoined = ({ participations, userId }) => {
  if (participations?.length === 0) return false;
  return participations?.some(
    (p) => p.documentId === userId,
  );
};

/**
 * Check if user has already answer no to event
 * @param {object} params
 * @param {User[]} params.missings - The list of participants
 * @param {string} [params.userId] - The ID of the user to check
 * @returns {boolean} - True if the user has already answered no, false otherwise
 */
export const haveIAlreadyAnsweredNo = ({ missings, userId }) => {
  if (missings?.length === 0) return false;
  return missings?.some(
    (p) => p.documentId === userId,
  );
};
