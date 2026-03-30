export const getAdWizardStepCount = (state = {}) => (
  state?.event ? 6 : 5
);

export const getAdWizardDescriptionStepIndex = (state = {}) => (
  state?.event ? 5 : 4
);

export const getAdWizardRecapStepIndex = (state = {}) => (
  state?.event ? 6 : 5
);
