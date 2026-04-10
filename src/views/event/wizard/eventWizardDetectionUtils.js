import { sportHasPositions } from '@/constants/positions';

export const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export const isDetectionEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('detection');
export const isStageEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('stage');
export const isTournamentEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('tournoi');

export const getEventWizardSportName = (state = {}) => (
  state?.team?.sport?.name
  || state?.team?.activities?.[0]?.name
  || ''
);

export const shouldShowDetectionSlotsStep = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return false;
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const shouldExplainDetectionSlotsDisabled = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return false;
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (!state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const getEventWizardStepCount = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 9;
  if (isTournamentEventType(state?.type?.name)) return 10;
  return shouldShowDetectionSlotsStep(state) ? 11 : 10;
};

export const getEventWizardLogisticsStepIndex = (state = {}) => {
  if (isTournamentEventType(state?.type?.name)) return 3;
  return 4;
};

export const getEventWizardLocationStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 4;
  if (isTournamentEventType(state?.type?.name)) return 4;
  return 5;
};

export const getEventWizardTournamentSettingsStepIndex = (state = {}) => {
  if (isTournamentEventType(state?.type?.name)) return 5;
  return 0;
};

export const getEventWizardTournamentStructureStepIndex = (state = {}) => {
  if (isTournamentEventType(state?.type?.name)) return 6;
  return 0;
};

export const getEventWizardVisibilityStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 5;
  if (isTournamentEventType(state?.type?.name)) return 7;
  return 6;
};

export const getEventWizardParticipantsStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 6;
  if (isTournamentEventType(state?.type?.name)) return 8;
  return 7;
};

export const getEventWizardStageProgramStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 3;
  return 0;
};

export const getEventWizardValidationStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 7;
  if (isTournamentEventType(state?.type?.name)) return 0;
  if (shouldShowDetectionSlotsStep(state)) return 9;
  return 8;
};

export const getEventWizardDescriptionStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 8;
  if (isTournamentEventType(state?.type?.name)) return 9;
  if (shouldShowDetectionSlotsStep(state)) return 10;
  return 9;
};

export const getEventWizardRecapStepIndex = (state = {}) => {
  if (isStageEventType(state?.type?.name)) return 9;
  if (isTournamentEventType(state?.type?.name)) return 10;
  if (shouldShowDetectionSlotsStep(state)) return 11;
  return 10;
};
