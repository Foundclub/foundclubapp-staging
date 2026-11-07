import { decisionDuRefusDeCampagne } from '../refusDeCampagne';

// RETOURS-TESTEUR-2 (06/11/2026, défaut 3 de CR-TRAIN5) — une campagne de cotisation sur un club
// sans offre Club : 6 étapes remplies, puis « Campagne impossible — Forbidden ». La recette a
// reçu `403 ForbiddenError "Forbidden"` sans décision d'abonnement (reseau.log de CR-TRAIN5).
// Un refus 403 ouvre désormais l'écran de l'offre (cotisations), jamais le mot anglais.
describe('decisionDuRefusDeCampagne', () => {
  it('une décision du serveur passe telle quelle', () => {
    const decision = {
      allowed: false, paywall: 'DUES_CAMPAIGN_CREATE_REQUIRED', requiredPlan: ['CLUB'],
    };
    expect(decisionDuRefusDeCampagne({ details: { decision }, status: 403 })).toBe(decision);
  });

  it('403 « Forbidden » sans décision (vu sur la recette) : l offre des cotisations', () => {
    expect(decisionDuRefusDeCampagne({
      details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403,
    })).toEqual({
      allowed: false,
      paywall: 'DUES_CAMPAIGN_CREATE_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['CLUB'],
    });
  });

  it('une autre panne (400, réseau) : pas d écran d offre', () => {
    expect(decisionDuRefusDeCampagne({ message: 'seasonLabel is required', status: 400 })).toBeNull();
    expect(decisionDuRefusDeCampagne('Network Error')).toBeNull();
    expect(decisionDuRefusDeCampagne(null)).toBeNull();
  });
});
