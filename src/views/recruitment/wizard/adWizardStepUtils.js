import { sportHasPositions } from '@/constants/positions';

export const isCoachAdWizard = (state = {}) => state?.audienceType === 'coach';

// C28 — sport de l'annonce (même dérivation que AdWizardPositions).
export const getAdWizardSportName = (state = {}) => (
  state?.team?.sport?.name || state?.team?.activities?.[0]?.name || ''
);

export const hasAdWizardAudienceStep = (state = {}) => !state?.event;

export const hasAdWizardValidationStep = (state = {}) => Boolean(state?.event) && !isCoachAdWizard(state);

export const getAdWizardStepCount = () => 7;

export const getAdWizardAudienceStepIndex = (state = {}) => (
  hasAdWizardAudienceStep(state) ? 1 : 0
);

export const getAdWizardTeamStepIndex = (state = {}) => (
  hasAdWizardAudienceStep(state) ? 2 : 1
);

export const getAdWizardNeedsStepIndex = (state = {}) => (
  hasAdWizardAudienceStep(state) ? 3 : 2
);

export const getAdWizardInfoStepIndex = (state = {}) => (
  hasAdWizardAudienceStep(state) ? 4 : 3
);

export const getAdWizardLocationStepIndex = (state = {}) => (
  hasAdWizardAudienceStep(state) ? 5 : 4
);

export const getAdWizardValidationStepIndex = (state = {}) => (
  hasAdWizardAudienceStep(state) ? 6 : 5
);

export const getAdWizardDescriptionStepIndex = () => 6;

export const getAdWizardRecapStepIndex = () => 7;

const hasValue = (value) => {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    return Boolean(
      String(value?.label || '').trim()
      || String(value?.address || '').trim()
      || String(value?.description || '').trim()
      || String(value?.city || '').trim(),
    );
  }
  return true;
};

export const isAdWizardCoachProfileComplete = (state = {}) => {
  if (!isCoachAdWizard(state)) return true;

  const hasRole = Boolean(String(state?.coachRole || '').trim());
  const hasOtherRole = state?.coachRole !== 'other' || Boolean(String(state?.coachRoleOther || '').trim());
  const hasExperience = Boolean(String(state?.coachExperienceLevel || '').trim());
  const hasEngagement = Boolean(String(state?.engagementType || '').trim());
  const hasQuantity = Number(state?.coachQuantity || 0) >= 1;

  return hasRole && hasOtherRole && hasExperience && hasEngagement && hasQuantity;
};

export const isAdWizardNeedsComplete = (state = {}) => {
  if (isCoachAdWizard(state)) return isAdWizardCoachProfileComplete(state);
  // C28 — un sport sans postes (hors foot/basket/hand/volley/rugby) ne peut pas
  // exiger de postes, sinon le bouton Suivant ne s'active jamais.
  const sportName = getAdWizardSportName(state);
  if (sportName && !sportHasPositions(sportName)) return true;
  return Array.isArray(state?.positions) && state.positions.length > 0;
};

export const isAdWizardSportProfileComplete = (state = {}) => Boolean(
  state?.section
  && state?.category
  && state?.minLevel,
);

export const isAdWizardLocationComplete = (state = {}) => hasValue(state?.address);
