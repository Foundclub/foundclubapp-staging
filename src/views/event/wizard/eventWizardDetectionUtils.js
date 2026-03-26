import { sportHasPositions } from '@/constants/positions';

export const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export const isDetectionEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('detection');

export const getEventWizardSportName = (state = {}) => (
  state?.team?.sport?.name
  || state?.team?.activities?.[0]?.name
  || ''
);

export const shouldShowDetectionSlotsStep = (state = {}) => {
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const shouldExplainDetectionSlotsDisabled = (state = {}) => {
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (!state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const getEventWizardStepCount = (state = {}) => (
  shouldShowDetectionSlotsStep(state) ? 11 : 10
);

export const getEventWizardValidationStepIndex = (state = {}) => (
  shouldShowDetectionSlotsStep(state) ? 9 : 8
);

export const getEventWizardDescriptionStepIndex = (state = {}) => (
  shouldShowDetectionSlotsStep(state) ? 10 : 9
);

export const getEventWizardRecapStepIndex = (state = {}) => (
  shouldShowDetectionSlotsStep(state) ? 11 : 10
);
