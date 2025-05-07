import {
  createEventPayload,
  createReccurrentEventPayload,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  getReccurrenceDayOptions,
  RECURRENCE_FREQUENCY_OPTIONS,
  SESSIONS_STATUS_OPTIONS,
  VALIDATION_MODE_OPTIONS,
} from './eventUseCases';

/**
 * Hook for event-related functionality
 * @inheritdoc
 */
const useEvent = () => ({
  createEventPayload,
  createReccurrentEventPayload,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  getReccurrenceDayOptions,
  recurrenceFrequencyOptions: RECURRENCE_FREQUENCY_OPTIONS,
  sessionStatusOptions: SESSIONS_STATUS_OPTIONS,
  validationModeOptions: VALIDATION_MODE_OPTIONS,
});

export default useEvent;
