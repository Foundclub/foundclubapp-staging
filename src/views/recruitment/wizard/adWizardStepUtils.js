export const isCoachAdWizard = (state = {}) => state?.audienceType === 'coach';

export const getAdWizardStepCount = (state = {}) => {
  if (isCoachAdWizard(state)) return 6;
  return state?.event ? 7 : 6;
};

export const getAdWizardDescriptionStepIndex = (state = {}) => (
  state?.event ? 6 : 5
);

export const getAdWizardRecapStepIndex = (state = {}) => (
  state?.event ? 7 : 6
);

export const getAdWizardInfoStepIndex = () => 4;
export const getAdWizardTeamStepIndex = () => 2;
export const getAdWizardValidationStepIndex = () => 5;
