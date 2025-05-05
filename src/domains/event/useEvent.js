import {
  formatDateForDisplay,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeForDisplay,
  formatTimeInput,
  SESSIONS_STATUS_OPTIONS,
  VALIDATION_MODE_OPTIONS,
} from './eventUseCases';

/**
 * Hook for event-related functionality
 * @inheritdoc
 */
const useEvent = () => ({
  formatDateForDisplay,
  formatDateInput,
  formatDateTimeToSend,
  formatTimeForDisplay,
  formatTimeInput,
  sessionStatusOptions: SESSIONS_STATUS_OPTIONS,
  validationModeOptions: VALIDATION_MODE_OPTIONS,
});

export default useEvent;
