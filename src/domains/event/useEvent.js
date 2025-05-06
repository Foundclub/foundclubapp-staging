import {
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  SESSIONS_STATUS_OPTIONS,
  VALIDATION_MODE_OPTIONS,
} from './eventUseCases';

/**
 * Hook for event-related functionality
 * @inheritdoc
 */
const useEvent = () => ({
  formatDateInput,
  formatDateTimeToSend,
  formatTimeInput,
  sessionStatusOptions: SESSIONS_STATUS_OPTIONS,
  validationModeOptions: VALIDATION_MODE_OPTIONS,
});

export default useEvent;
