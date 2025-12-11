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

/**
 * Format a date string to send
 * @param {string | undefined} dateString - The date string to format
 * @param {string | undefined} timeString - The time string to format
 * @returns {string | undefined} The formatted date string or null if invalid
 */
export const formatDateTimeToSend = (dateString, timeString) => {
  if (!dateString || !timeString || typeof dateString !== 'string' || typeof timeString !== 'string') return undefined;
  const splittedDate = dateString.split('/');
  const splittedTime = timeString.split(':');
  const day = splittedDate[0];
  const month = splittedDate[1];
  const year = splittedDate[2];
  const hours = splittedTime[0];
  const minutes = splittedTime[1];
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}`);
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
  if (!timeString || typeof timeString !== 'string') return undefined;
  const pattern = /^(\d{2}):(\d{2})$/;
  const match = timeString.match(pattern);
  if (!match) return undefined;
  return `${timeString}:00.000`;
};

/**
 * Create the event payload for the API from the event form data
 * @param {FCEventForm} event
 * @returns {FCEventForm}
 */
export const createEventPayload = (event) => {
  // Safely handle location data
  const splittedLocation = event.location?.value?.split('|');
  const formattedData = {
    ...event,
    date: formatDateTimeToSend(event.date, event.startTime),
    location: splittedLocation?.length === 2 ? {
      lat: parseFloat(splittedLocation[1]) || 0,
      lng: parseFloat(splittedLocation[0]) || 0,
    } : (event.location?.label ? {
      lat: 0,
      lng: 0,
      label: event.location.label, // Use label if available, fallback to 0,0
    } : undefined),
    locationDetails: event.location?.label ? JSON.stringify({ address: event.location.label }) : null,
    // Format startTime and endTime for Strapi (HH:mm:ss.SSS)
    startTime: formatTimeForStrapi(event.startTime),
    endTime: formatTimeForStrapi(event.endTime),
    featuredRequestStatus: event.requestFeatured ? 'pending' : 'none',
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

  // Remove undefined or null numeric fields to let Strapi use defaults
  if (formattedData.capacity == null || formattedData.capacity === '') delete formattedData.capacity;
  if (formattedData.pricePerPerson == null || formattedData.pricePerPerson === '') delete formattedData.pricePerPerson;
  if (formattedData.totalPlayers == null || formattedData.totalPlayers === '') delete formattedData.totalPlayers;
  if (!formattedData.location) delete formattedData.location;
  if (!formattedData.locationDetails) delete formattedData.locationDetails;

  return formattedData;
};

/**
 * Create the event payload for the API from the event form data for reccurent events
 * @param {FCEventForm} event
 * @returns {FCEventForm[]}
 */
export const createReccurrentEventPayload = (event) => {
  if (event.isRecurrent && event.recurrenceStartDate && event.recurrenceEndDate) {
    const startDate = getDateFromDateInput(event.recurrenceStartDate) || new Date();
    const endDate = getDateFromDateInput(event.recurrenceEndDate) || new Date();

    // Generate a unique recurrence group ID
    const recurrenceGroupId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const events = [];
    const currentDate = new Date(startDate); // Start from the recurrence start date

    // Helper to get day index (0=Sunday, 1=Monday, etc.)
    const getDayIndex = (date) => date.getDay();

    // Helper to set day of week for a given date
    const setDayOfWeek = (date, dayIndex) => {
      const result = new Date(date);
      const currentDay = result.getDay();
      const distance = (dayIndex + 7 - currentDay) % 7;
      // If the target day is today or in the future within the same week, add distance
      // But we want to set the day relative to the START of the week block?
      // Actually, the requirement is: "Semaine 1 : Crée les events Lundi et Mercredi."
      // So we should align currentDate to the start of the week (e.g. Monday) and then add days.
      // Let's assume Monday is start of week for simplicity in calculation, or just use date-fns if available.
      // Since we don't have date-fns startOfWeek imported, let's do it manually or rely on the current date being the anchor.

      // Better approach: 
      // 1. Iterate by weeks (interval).
      // 2. For each week, iterate through recurrenceDays.
      // 3. Construct the date for that day in that week.

      // To do this correctly, we need to know the "Monday" of the current week block.
      const day = result.getDay();
      const diff = result.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const monday = new Date(result.setDate(diff));

      // Now add (dayIndex - 1) days to monday (since Monday is 1)
      // If dayIndex is 0 (Sunday), it's Monday + 6.
      const targetDayOffset = dayIndex === 0 ? 6 : dayIndex - 1;
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + targetDayOffset);
      return targetDate;
    };

    // Parse recurrence days (ensure they are numbers)
    const recurrenceDays = (event.recurrenceDays || []).map(Number);
    const interval = event.recurrenceInterval || 1;

    // If frequency is week and we have specific days
    if (event.recurrenceFrequency === 'week' && recurrenceDays.length > 0) {
      // Align currentDate to the start of the week (Monday) of the startDate
      // This ensures our week blocks are aligned with the calendar week
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      let weekStart = new Date(currentDate);
      weekStart.setDate(diff);

      // Loop until weekStart exceeds endDate
      while (weekStart <= endDate) {
        // For this week, create events for selected days
        recurrenceDays.forEach(dayIndex => {
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
