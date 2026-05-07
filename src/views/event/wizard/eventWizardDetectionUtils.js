import { sportHasPositions } from '@/constants/positions';

export const normalizeTypeLabel = (/** @type {any} */ value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export const isDetectionEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('detection');
export const isStageEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('stage');
export const isTournamentEventType = (typeName = '') => normalizeTypeLabel(typeName).includes('tournoi');

const hasNonEmptyValue = (/** @type {any} */ value) => {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    return Boolean(
      value.documentId
      || value.id
      || value.value
      || value.label
      || value.description
      || value.name
      || value.address
      || Number.isFinite(value.lat)
      || Number.isFinite(value.lng)
      || Number.isFinite(value.latitude)
      || Number.isFinite(value.longitude),
    );
  }
  return true;
};

export const getActiveStageScheduleDays = (/** @type {any} */ state = {}) => (
  Array.isArray(state?.stageSchedule)
    ? state.stageSchedule.filter((/** @type {any} */ day) => day?.isActive !== false)
    : []
);

export const hasValidStageDayLocation = (/** @type {any} */ day = {}) => hasNonEmptyValue(
  day?.facilityId || day?.facility?.documentId || day?.facility || day?.location,
);

export const hasCompletePerDayLocations = (/** @type {any} */ state = {}) => {
  const activeDays = getActiveStageScheduleDays(state);
  return activeDays.length > 0 && activeDays.every(hasValidStageDayLocation);
};

export const shouldSkipEventWizardLocationStep = (/** @type {any} */ state = {}) => (
  isTournamentEventType(state?.type?.name)
  && state?.isMultiDayTournament === true
  && hasCompletePerDayLocations(state)
);

export const getEventWizardSportName = (/** @type {any} */ state = {}) => (
  state?.team?.sport?.name
  || state?.team?.activities?.[0]?.name
  || state?.tournamentActivity?.name
  || ''
);

export const shouldShowDetectionSlotsStep = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return false;
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const shouldExplainDetectionSlotsDisabled = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return false;
  if (!isDetectionEventType(state?.type?.name)) return false;
  if (!state?.isRecurrent) return false;
  return sportHasPositions(getEventWizardSportName(state));
};

export const getEventWizardStepCount = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 9;
  if (isTournamentEventType(state?.type?.name)) {
    return 10;
  }
  return shouldShowDetectionSlotsStep(state) ? 11 : 10;
};

export const getEventWizardLogisticsStepIndex = (/** @type {any} */ state = {}) => {
  if (isTournamentEventType(state?.type?.name)) return 3;
  return 4;
};

export const getEventWizardLocationStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 4;
  if (isTournamentEventType(state?.type?.name)) return 4;
  return 5;
};

export const getEventWizardTournamentSettingsStepIndex = (/** @type {any} */ state = {}) => {
  if (isTournamentEventType(state?.type?.name)) return 5;
  return 0;
};

export const getEventWizardTournamentStructureStepIndex = (/** @type {any} */ state = {}) => {
  if (isTournamentEventType(state?.type?.name)) return 6;
  return 0;
};

export const getEventWizardVisibilityStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 5;
  if (isTournamentEventType(state?.type?.name)) return 7;
  return 6;
};

export const getEventWizardParticipantsStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 6;
  if (isTournamentEventType(state?.type?.name)) return 8;
  return 7;
};

export const getEventWizardStageProgramStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 3;
  return 0;
};

export const getEventWizardValidationStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 7;
  if (isTournamentEventType(state?.type?.name)) return 0;
  if (shouldShowDetectionSlotsStep(state)) return 9;
  return 8;
};

export const getEventWizardDescriptionStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 8;
  if (isTournamentEventType(state?.type?.name)) return 9;
  if (shouldShowDetectionSlotsStep(state)) return 10;
  return 9;
};

export const getEventWizardRecapStepIndex = (/** @type {any} */ state = {}) => {
  if (isStageEventType(state?.type?.name)) return 9;
  if (isTournamentEventType(state?.type?.name)) return 10;
  if (shouldShowDetectionSlotsStep(state)) return 11;
  return 10;
};
