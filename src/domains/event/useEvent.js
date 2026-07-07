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
  isTrainingEventType,
  RECURRENCE_FREQUENCY_OPTIONS,
  resolveTrainingOpenConfig,
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
  isTrainingEventType,
  recurrenceFrequencyOptions: RECURRENCE_FREQUENCY_OPTIONS,
  resolveTrainingOpenConfig,
  sessionStatusOptions: SESSIONS_STATUS_OPTIONS,
  validationModeOptions: VALIDATION_MODE_OPTIONS,
});

export default useEvent;
