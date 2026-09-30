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
  isAdWizardPlayerAdWithoutPositions,
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

  // RECRUTER-TUNNEL (audit V1, H2) — la regle que l'etape Postes ET le
  // recapitulatif lisent desormais tous les deux.
  test('lets a player ad for a sport without positions go out without one', () => {
    const artsMartiaux = {
      audienceType: 'player',
      positions: [],
      team: { activities: [{ name: 'Arts martiaux' }] },
    };
    const football = { ...artsMartiaux, team: { activities: [{ name: 'Football' }] } };

    expect(isAdWizardPlayerAdWithoutPositions(artsMartiaux)).toBe(true);
    expect(isAdWizardNeedsComplete(artsMartiaux)).toBe(true);
    expect(isAdWizardPlayerAdWithoutPositions(football)).toBe(false);
    expect(isAdWizardNeedsComplete(football)).toBe(false);
    // Un sport inconnu n'ouvre pas la porte : les postes restent exiges.
    expect(isAdWizardPlayerAdWithoutPositions({ audienceType: 'player', positions: [] })).toBe(false);
    // Une annonce entraineur n'a jamais de poste : elle suit sa propre regle.
    expect(isAdWizardPlayerAdWithoutPositions({ ...artsMartiaux, audienceType: 'coach' })).toBe(false);
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
