import {
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  isValidDate,
  isValidTime,
  SESSIONS_STATUS_OPTIONS,
  VALIDATION_MODE_OPTIONS,
} from './eventUseCases';

jest.mock('@/theme/strings', () => ({
  t: (key) => key,
}));

describe('Event Use Cases', () => {
  describe('Constants', () => {
    test('SESSIONS_STATUS_OPTIONS should have correct options', () => {
      expect(SESSIONS_STATUS_OPTIONS).toEqual([
        { label: 'eventEdit.fields.sessionStatus.options.open', value: 'open' },
        { label: 'eventEdit.fields.sessionStatus.options.closed', value: 'closed' },
      ]);
    });

    test('VALIDATION_MODE_OPTIONS should have correct options', () => {
      expect(VALIDATION_MODE_OPTIONS).toEqual([
        { label: 'eventEdit.fields.validationMode.options.auto', value: 'auto' },
        { label: 'eventEdit.fields.validationMode.options.manual', value: 'manual' },
      ]);
    });
  });

  describe('formatDateTimeToSend', () => {
    test('should format valid date and time correctly', () => {
      const dateString = '15/05/2025';
      const timeString = '14:30';
      const result = formatDateTimeToSend(dateString, timeString);
      expect(result).toMatch(/2025-05-15T12:30:00/);
    });

    test('should return undefined for invalid inputs', () => {
      expect(formatDateTimeToSend(undefined, '14:30')).toBeUndefined();
      expect(formatDateTimeToSend('15/05/2025', undefined)).toBeUndefined();
      expect(formatDateTimeToSend('invalid', '14:30')).toBeUndefined();
    });
  });

  describe('formatDateInput', () => {
    test('should format date input correctly', () => {
      expect(formatDateInput('15')).toBe('15');
      expect(formatDateInput('1505')).toBe('15/05');
      expect(formatDateInput('15052025')).toBe('15/05/2025');
    });

    test('should remove non-digits', () => {
      expect(formatDateInput('15/05/2025')).toBe('15/05/2025');
      expect(formatDateInput('15-05-2025')).toBe('15/05/2025');
    });
  });

  describe('formatTimeInput', () => {
    test('should format time input correctly', () => {
      expect(formatTimeInput('14')).toBe('14');
      expect(formatTimeInput('1430')).toBe('14:30');
    });

    test('should remove non-digits', () => {
      expect(formatTimeInput('14:30')).toBe('14:30');
      expect(formatTimeInput('14-30')).toBe('14:30');
    });
  });

  describe('isValidDate', () => {
    test('should validate correct date formats', () => {
      expect(isValidDate('15/05/2025')).toBe(true);
      expect(isValidDate('31/12/2025')).toBe(true);
      expect(isValidDate('06/05/2025')).toBe(true); // Current date
      expect(isValidDate('01/01/2026')).toBe(true); // Future date
    });

    test('should invalidate incorrect date formats', () => {
      expect(isValidDate('32/05/2025')).toBe(false);
      expect(isValidDate('15/13/2025')).toBe(false);
      expect(isValidDate('15-05-2025')).toBe(false);
      expect(isValidDate('2025/05/15')).toBe(false);
      expect(isValidDate('00/05/2025')).toBe(false); // Invalid day
      expect(isValidDate('15/00/2025')).toBe(false); // Invalid month
    });

    test('should validate month-specific day limits', () => {
      expect(isValidDate('31/01/2025')).toBe(true); // January
      expect(isValidDate('31/04/2025')).toBe(false); // April
      expect(isValidDate('29/02/2024')).toBe(true); // Leap year
      expect(isValidDate('29/02/2025')).toBe(false); // Non-leap year
      expect(isValidDate('30/04/2025')).toBe(true); // April 30 days
      expect(isValidDate('31/07/2025')).toBe(true); // July 31 days
    });
  });

  describe('isValidTime', () => {
    test('should validate correct time formats', () => {
      expect(isValidTime('14:30')).toBe(true);
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
    });

    test('should invalidate incorrect time formats', () => {
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('14:60')).toBe(false);
      expect(isValidTime('14-30')).toBe(false);
      expect(isValidTime('1430')).toBe(false);
    });
  });
});
