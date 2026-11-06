import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';

/**
 * RETOURS-TESTEUR-2 (06/11/2026, défaut 3 de CR-TRAIN5) — le refus d'enregistrer une campagne de
 * cotisation, lu comme une décision d'abonnement. La recette a renvoyé `403 ForbiddenError
 * "Forbidden"` SANS la décision que `license.ts` (assertDuesCampaignSubscription) attache, et
 * l'écran affichait « Campagne impossible — Forbidden ». Quiconque arrive au bout de l'assistant
 * gère les cotisations du club (sinon la liste ne s'ouvre pas, 403) : un 403 ici est l'offre qui
 * manque, l'écran de l'offre des cotisations le dit en français.
 * ponytail: la perte de la décision côté serveur n'est pas expliquée (NON VÉRIFIÉ : il faudrait
 * rejouer le POST sur la recette) ; si elle revient, c'est elle qui s'affiche.
 * @param {any} erreur - L'erreur rejetée par le client HTTP (`response.data.error`).
 * @returns {any | null} La décision à montrer, ou rien (une autre panne garde son alerte).
 */
export const decisionDuRefusDeCampagne = (erreur) => {
  const duServeur = extractSubscriptionDecisionFromError(erreur);
  if (duServeur) return duServeur;
  if (erreur?.status !== 403 && erreur?.name !== 'ForbiddenError') return null;
  return {
    allowed: false,
    paywall: 'DUES_CAMPAIGN_CREATE_REQUIRED',
    reason: 'SUBSCRIPTION_REQUIRED',
    requiredPlan: ['CLUB'],
  };
};

export default decisionDuRefusDeCampagne;
