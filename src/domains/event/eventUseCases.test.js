import {
  canEventBeJoined,
  createEventPayload,
  createReccurrentEventPayload,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  getReccurrenceDayOptions,
  haveIAlreadyJoined,
  isValidDate,
  isValidTime,
  RECURRENCE_FREQUENCY_OPTIONS,
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

  describe('RECURRENCE_FREQUENCY_OPTIONS', () => {
    test('should have correct options', () => {
      expect(RECURRENCE_FREQUENCY_OPTIONS).toEqual([
        { label: 'eventEdit.fields.recurrenceFrequency.options.week', value: 'week' },
        { label: 'eventEdit.fields.recurrenceFrequency.options.month', value: 'month' },
      ]);
    });
  });

  describe('formatDateTimeToSend', () => {
    test('should format valid date and time correctly', () => {
      const dateString = '15/05/2025';
      const timeString = '14:30';
      const result = formatDateTimeToSend(dateString, timeString);
      // Check that the ISO string contains our expected date and time components
      expect(result).toMatch(/^2025-05-15T.*:30:00/);

      // Parse the result back to a Date to verify the components
      const resultDate = new Date(result);
      expect(resultDate.getUTCDate()).toBe(15);
      expect(resultDate.getUTCMonth()).toBe(4); // May is 4 (zero-based)
      expect(resultDate.getUTCFullYear()).toBe(2025);
      expect(resultDate.getUTCMinutes()).toBe(30);
    });

    test('should return undefined for invalid inputs', () => {
      expect(formatDateTimeToSend(undefined, '14:30')).toBeUndefined();
      expect(formatDateTimeToSend('15/05/2025', undefined)).toBeUndefined();
      expect(formatDateTimeToSend('invalid', '14:30')).toBeUndefined();
    });

    test('should handle empty strings', () => {
      expect(formatDateTimeToSend('', '14:30')).toBeUndefined();
      expect(formatDateTimeToSend('15/05/2025', '')).toBeUndefined();
      expect(formatDateTimeToSend('', '')).toBeUndefined();
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

    test('should handle malformed inputs', () => {
      expect(formatTimeInput('')).toBe('');
      expect(formatTimeInput('abc')).toBe('');
      expect(formatTimeInput('12::')).toBe('12');
      expect(formatTimeInput('25:70')).toBe('25:70');
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

    test('should handle invalid inputs', () => {
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate('abc')).toBe(false);
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

    test('should handle invalid inputs', () => {
      expect(isValidTime('')).toBe(false);
      expect(isValidTime(undefined)).toBe(false);
      expect(isValidTime(null)).toBe(false);
      expect(isValidTime('abc')).toBe(false);
    });
  });

  describe('createEventPayload', () => {
    test('should format canonical startTime/endTime fields correctly', () => {
      const mockEvent = {
        capacity: 10,
        date: '15/05/2025',
        description: 'Test event',
        endTime: '15:45',
        location: { label: 'Paris', value: '2.3522|48.8566' },
        requestFeatured: true,
        sessionStatus: 'open',
        startTime: '14:30',
        team: 'team-123',
        type: 'type-123',
        validationMode: 'auto',
      };

      const result = createEventPayload(mockEvent);

      expect(result).toEqual(expect.objectContaining({
        capacity: 10,
        date: expect.stringMatching(/^2025-05-15T.*:30:00/),
        description: 'Test event',
        endTime: '15:45:00.000',
        featuredRequestStatus: 'pending',
        location: {
          lat: 48.8566,
          lng: 2.3522,
        },
        locationDetails: '{"address":"Paris"}',
        sessionStatus: 'open',
        startTime: '14:30:00.000',
        team: 'team-123',
        type: 'type-123',
        validationMode: 'auto',
      }));
      expect(result.time).toBeUndefined();
    });

    test('should fallback to legacy time when startTime is missing', () => {
      const mockEvent = {
        date: '15/05/2025',
        location: { label: 'Paris', value: '2.3522|48.8566' },
        sessionStatus: 'open',
        time: '16:15',
        type: 'type-123',
        validationMode: 'auto',
      };

      const result = createEventPayload(mockEvent);

      expect(result.date).toMatch(/^2025-05-15T.*:15:00/);
      expect(result.startTime).toBe('16:15:00.000');
      expect(result.time).toBeUndefined();
    });

    test('should handle missing location data', () => {
      const mockEvent = {
        capacity: 10,
        date: '15/05/2025',
        sessionStatus: 'open',
        startTime: '14:30',
        team: 'team-123',
        type: 'type-123',
        validationMode: 'auto',
      };

      const result = createEventPayload(mockEvent);
      expect(result.location).toBeUndefined();
    });
  });

  describe('createReccurrentEventPayload', () => {
    test('should create single event when not recurrent', () => {
      const mockEvent = {
        capacity: 10,
        date: '15/05/2025',
        isRecurrent: false,
        sessionStatus: 'open',
        time: '14:30',
      };

      const result = createReccurrentEventPayload(mockEvent);
      expect(result).toHaveLength(1);
      expect(result[0].date).toMatch(/^2025-05-15T.*:30:00/);
    });

    test('should create weekly recurring events', () => {
      const mockEvent = {
        capacity: 10,
        date: '15/05/2025',
        isRecurrent: true,
        recurrenceEndDate: '29/05/2025',
        recurrenceFrequency: 'week',
        recurrenceStartDate: '15/05/2025',
        sessionStatus: 'open',
        time: '14:30',
      };

      const result = createReccurrentEventPayload(mockEvent);
      expect(result).toHaveLength(3); // 3 weeks
      expect(result[0].date).toMatch(/^2025-05-15/);
      expect(result[1].date).toMatch(/^2025-05-22/);
      expect(result[2].date).toMatch(/^2025-05-29/);
    });

    test('should create monthly recurring events', () => {
      const mockEvent = {
        capacity: 10,
        date: '15/05/2025',
        isRecurrent: true,
        recurrenceEndDate: '15/07/2025',
        recurrenceFrequency: 'month',
        recurrenceStartDate: '15/05/2025',
        sessionStatus: 'open',
        time: '14:30',
      };

      const result = createReccurrentEventPayload(mockEvent);
      expect(result).toHaveLength(3); // 3 months
      expect(result[0].date).toMatch(/^2025-05-15/);
      expect(result[1].date).toMatch(/^2025-06-15/);
      expect(result[2].date).toMatch(/^2025-07-15/);
    });
  });

  describe('getReccurrenceDayOptions', () => {
    test('should return weekday options for weekly frequency', () => {
      const result = getReccurrenceDayOptions('week');
      expect(result).toHaveLength(7);
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('value');
    });

    test('should return day of month options for monthly frequency', () => {
      const result = getReccurrenceDayOptions('month');
      expect(result).toHaveLength(31);
      expect(result[0]).toEqual({ label: '1', value: '1' });
      expect(result[30]).toEqual({ label: '31', value: '31' });
    });

    test('should handle invalid frequency', () => {
      const result = getReccurrenceDayOptions('invalid');
      expect(result).toHaveLength(31); // defaults to monthly
    });
  });

  describe('canEventBeJoined', () => {
    test('should allow player to join when capacity not reached', () => {
      const result = canEventBeJoined({
        capacity: 10,
        participations: [{ documentId: 'user1' }, { documentId: 'user2' }],
        userId: 'user3',
        userRole: { name: 'Joueur' },
      });
      expect(result).toBe(true);
    });

    test('should not allow joining when capacity reached', () => {
      const result = canEventBeJoined({
        capacity: 2,
        participations: [{ documentId: 'user1' }, { documentId: 'user2' }],
        userId: 'user3',
        userRole: { name: 'Joueur' },
      });
      expect(result).toBe(false);
    });

    test('should not allow non-players to join', () => {
      const result = canEventBeJoined({
        capacity: 10,
        participations: [],
        userId: 'user1',
        userRole: { name: 'Entraineur' },
      });
      expect(result).toBe(false);
    });

    test('should not allow user to join if already participating', () => {
      const result = canEventBeJoined({
        capacity: 10,
        participations: [{ documentId: 'user1' }],
        userId: 'user1',
        userRole: { name: 'Joueur' },
      });
      expect(result).toBe(false);
    });
  });

  describe('haveIAlreadyJoined', () => {
    test('should return true when user has joined', () => {
      const result = haveIAlreadyJoined({
        participations: [{ documentId: 'user1' }, { documentId: 'user2' }],
        userId: 'user1',
      });
      expect(result).toBe(true);
    });

    test('should return false when user has not joined', () => {
      const result = haveIAlreadyJoined({
        participations: [{ documentId: 'user1' }, { documentId: 'user2' }],
        userId: 'user3',
      });
      expect(result).toBe(false);
    });

    test('should handle empty participations array', () => {
      const result = haveIAlreadyJoined({
        participations: [],
        userId: 'user1',
      });
      expect(result).toBe(false);
    });

    test('should handle undefined userId', () => {
      const result = haveIAlreadyJoined({
        participations: [{ documentId: 'user1' }],
        userId: undefined,
      });
      expect(result).toBe(false);
    });
  });
});
