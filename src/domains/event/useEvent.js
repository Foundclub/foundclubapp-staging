import {
  canEventBeJoined,
  createEventPayload,
  createEventUpdatePayload,
  createReccurrentEventPayload,
  createStageEventPayload,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  getDateFromDateInput,
  getEventEditSupport,
  getReccurrenceDayOptions,
  haveIAlreadyAnsweredNo,
  haveIAlreadyJoined,
  RECURRENCE_FREQUENCY_OPTIONS,
  SESSIONS_STATUS_OPTIONS,
  VALIDATION_MODE_OPTIONS,
} from './eventUseCases';

/**
 * Hook for event-related functionality
 * @inheritdoc
 */
const useEvent = () => ({
  canEventBeJoined,
  createEventPayload,
  createEventUpdatePayload,
  createReccurrentEventPayload,
  createStageEventPayload,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  getDateFromDateInput,
  getEventEditSupport,
  getReccurrenceDayOptions,
  haveIAlreadyAnsweredNo,
  haveIAlreadyJoined,
  recurrenceFrequencyOptions: RECURRENCE_FREQUENCY_OPTIONS,
  sessionStatusOptions: SESSIONS_STATUS_OPTIONS,
  validationModeOptions: VALIDATION_MODE_OPTIONS,
});

export default useEvent;
