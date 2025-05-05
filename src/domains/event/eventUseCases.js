import i18n from '@/theme/strings';

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
 * Format a datetime string for display date
 * @param {string | undefined} dateString - The date string to format
 * @returns {string | undefined} The formatted date string
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return undefined;
  return new Date(dateString).toISOString().slice(0, 16);
};

/**
 * Format a datetime string for display time
 * @param {string | undefined} dateString - The date string to format
 * @returns {string | undefined} The formatted date string
 */
export const formatTimeForDisplay = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return undefined;
  return new Date(dateString).toISOString().slice(0, 16);
};

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
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00Z`);
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
 * Format the time value to add a ':' to respect the format hh:mm.
 * @param {string} time - The time value.
 * @returns {string} The formatted time.
 */
export const formatTimeInput = (time) => {
  // Remove any non-digits
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
