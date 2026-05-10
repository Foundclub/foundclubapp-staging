import {
  getAdWizardDescriptionStepIndex,
  getAdWizardInfoStepIndex,
  getAdWizardLocationStepIndex,
  getAdWizardNeedsStepIndex,
  getAdWizardRecapStepIndex,
  getAdWizardStepCount,
  getAdWizardTeamStepIndex,
  getAdWizardValidationStepIndex,
  hasAdWizardAudienceStep,
  hasAdWizardValidationStep,
  isAdWizardCoachProfileComplete,
  isAdWizardLocationComplete,
  isAdWizardNeedsComplete,
  isAdWizardSportProfileComplete,
} from './adWizardStepUtils';

describe('adWizardStepUtils', () => {
  test('keeps a stable seven-step tunnel across flows', () => {
    expect(getAdWizardStepCount()).toBe(7);
  });

  test('shifts step indexes when the audience step is skipped for detection ads', () => {
    const detectionState = { audienceType: 'player', event: { documentId: 'evt_1' } };

    expect(hasAdWizardAudienceStep(detectionState)).toBe(false);
    expect(getAdWizardTeamStepIndex(detectionState)).toBe(1);
    expect(getAdWizardNeedsStepIndex(detectionState)).toBe(2);
    expect(getAdWizardInfoStepIndex(detectionState)).toBe(3);
    expect(getAdWizardLocationStepIndex(detectionState)).toBe(4);
    expect(getAdWizardValidationStepIndex(detectionState)).toBe(5);
    expect(getAdWizardDescriptionStepIndex()).toBe(6);
    expect(getAdWizardRecapStepIndex()).toBe(7);
  });

  test('keeps validation only for player detection flows', () => {
    expect(hasAdWizardValidationStep({ audienceType: 'player' })).toBe(false);
    expect(hasAdWizardValidationStep({ audienceType: 'coach' })).toBe(false);
    expect(hasAdWizardValidationStep({ audienceType: 'coach', event: { documentId: 'evt_1' } })).toBe(false);
    expect(hasAdWizardValidationStep({ audienceType: 'player', event: { documentId: 'evt_1' } })).toBe(true);
  });

  test('requires all mandatory coach profile fields', () => {
    expect(isAdWizardCoachProfileComplete({
      audienceType: 'coach',
      coachEngagementType: 'benevole',
    })).toBe(false);

    expect(isAdWizardCoachProfileComplete({
      audienceType: 'coach',
      coachExperienceLevel: 'confirme',
      coachQuantity: 1,
      coachRole: 'entraineur_principal',
      engagementType: 'benevole',
    })).toBe(true);

    expect(isAdWizardCoachProfileComplete({
      audienceType: 'coach',
      coachExperienceLevel: 'confirme',
      coachQuantity: 1,
      coachRole: 'other',
      coachRoleOther: '',
      engagementType: 'benevole',
    })).toBe(false);
  });

  test('requires positions for player needs', () => {
    expect(isAdWizardNeedsComplete({ audienceType: 'player', positions: [] })).toBe(false);
    expect(isAdWizardNeedsComplete({ audienceType: 'player', positions: [{ name: 'Gardien', quantity: 1 }] })).toBe(true);
  });

  test('requires section, category and level in the sport profile step', () => {
    expect(isAdWizardSportProfileComplete({ category: null, minLevel: null, section: null })).toBe(false);
    expect(isAdWizardSportProfileComplete({
      category: { documentId: 'cat_1' },
      minLevel: { documentId: 'lvl_1' },
      section: { documentId: 'sec_1' },
    })).toBe(true);
  });

  test('accepts both manual addresses and facility-backed locations', () => {
    expect(isAdWizardLocationComplete({ address: null })).toBe(false);
    expect(isAdWizardLocationComplete({ address: { label: 'Stade du Parc' } })).toBe(true);
    expect(isAdWizardLocationComplete({ address: { address: '12 rue du Stade' } })).toBe(true);
  });
});
