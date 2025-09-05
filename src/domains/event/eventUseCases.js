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
const getDateFromDateInput = (dateString) => {
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
 * Create the event payload for the API from the event form data
 * @param {FCEventForm} event
 * @returns {FCEventForm}
 */
export const createEventPayload = (event) => {
  // Safely handle location data
  const splittedLocation = event.location?.value?.split('|');
  const formattedData = {
    ...event,
    date: formatDateTimeToSend(event.date, event.time),
    location: splittedLocation?.length === 2 ? {
      lat: parseFloat(splittedLocation[1]) || 0,
      lng: parseFloat(splittedLocation[0]) || 0,
    } : event.location,
  };

  delete formattedData.time;
  delete formattedData.recurrenceDay;
  delete formattedData.recurrenceFrequency;
  delete formattedData.recurrenceStartDate;
  delete formattedData.recurrenceEndDate;
  delete formattedData.isRecurrent;

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

    const events = [];
    const currentDate = startDate;

    while (currentDate <= endDate) {
      const formattedEvent = {
        ...event,
        date: format(currentDate, 'dd/MM/yyyy'),
        location: event.location,
      };
      events.push(createEventPayload(formattedEvent));

      if (event.recurrenceFrequency === 'week') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (event.recurrenceFrequency === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
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
