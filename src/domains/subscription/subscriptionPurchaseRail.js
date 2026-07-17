import { Platform } from 'react-native';

import {
  buildSubscriptionBillingWindow,
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
} from '@/domains/subscription/subscriptionBilling';
import {
  isRevenueCatEnabled,
  purchaseSubscriptionViaRevenueCat,
  restoreRevenueCatPurchases,
} from '@/domains/subscription/subscriptionRevenueCat';

import {
  changeSubscriptionPlan,
  createStripeWebCheckoutSession,
  restoreSubscriptionPurchases,
  validateSubscriptionPurchase,
} from '@/services/subscription/subscriptionService';

import { APP_RUNTIME_ENV } from '@/constants/runtimeFlags';

/**
 * Rail d'achat (handoff item 14). Un seul point d'entrée pour tous les achats
 * d'abonnement de l'app :
 * - `trusted-test` : validation backend en mode test (local/staging) ;
 * - `revenuecat`  : Purchases.purchasePackage — la vérité serveur arrive par le
 *   webhook RevenueCat, avec une confirmation client immédiate quand la
 *   transaction store est connue (les deux chemins sont idempotents par
 *   transaction, cf. processValidatedPurchase serveur).
 * `FC_FORCE_REVENUECAT_RAIL=1` force le rail réel sur un build local/staging
 * (recette sandbox stores). Aucune vue ne doit appeler
 * validateSubscriptionPurchase/changeSubscriptionPlan directement pour un achat.
 */

export const SUBSCRIPTION_PURCHASE_RAILS = {
  REVENUECAT: 'revenuecat',
  STRIPE_WEB: 'stripe-web',
  TRUSTED_TEST: 'trusted-test',
};

const isRevenueCatRailForced = () => ['1', 'on', 'true', 'yes'].includes(
  String(process.env.FC_FORCE_REVENUECAT_RAIL || '').trim().toLowerCase(),
);

/**
 * @param {string | undefined | null} [runtimeEnv]
 * @returns {string}
 */
export const getActiveSubscriptionPurchaseRail = (runtimeEnv = APP_RUNTIME_ENV) => {
  // Sur le web, pas de SDK store : le rail Stripe redirige vers Stripe Checkout
  // (le serveur transmet ensuite l'achat a RevenueCat). Le mode test backend
  // garde la priorite pour les recettes locales/staging sans Stripe.
  if (Platform.OS === 'web') {
    if (!isRevenueCatRailForced() && isSubscriptionBillingTestModeEnabled(runtimeEnv)) {
      return SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST;
    }
    return SUBSCRIPTION_PURCHASE_RAILS.STRIPE_WEB;
  }
  if (isRevenueCatRailForced()) {
    return SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT;
  }
  return isSubscriptionBillingTestModeEnabled(runtimeEnv)
    ? SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST
    : SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT;
};

/**
 * @returns {boolean}
 */
export const isSubscriptionPurchaseAvailable = () => {
  const rail = getActiveSubscriptionPurchaseRail();
  if (rail === SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST) {
    return true;
  }
  if (rail === SUBSCRIPTION_PURCHASE_RAILS.STRIPE_WEB) {
    // La disponibilite reelle (STRIPE_SECRET_KEY) est cote serveur : l'endpoint
    // repond avec une erreur claire si le checkout web n'est pas configure.
    return true;
  }
  return isRevenueCatEnabled();
};

/** @returns {'apple' | 'google'} */
const getStoreProvider = () => (Platform.OS === 'ios' ? 'apple' : 'google');

/**
 * Confirmation client post-achat RevenueCat : fenêtre approximative (le webhook
 * posera les dates exactes du store via l'upsert par providerTransactionId).
 * @param {{
 *   catalogEntry: any;
 *   clubDocumentId?: string | null;
 *   purchaseResult: { productIdentifier: string; transactionIdentifier: string };
 *   teamDocumentIds: string[];
 * }} input
 * @returns {Record<string, any>}
 */
const buildRevenueCatValidationPayload = ({
  catalogEntry,
  clubDocumentId,
  purchaseResult,
  teamDocumentIds,
}) => ({
  ...buildSubscriptionBillingWindow(catalogEntry?.billingPeriod),
  autoRenew: true,
  billingPeriod: String(catalogEntry?.billingPeriod || '').trim().toLowerCase(),
  clubDocumentId: String(clubDocumentId || '').trim() || undefined,
  planCode: String(catalogEntry?.planCode || '').trim(),
  provider: getStoreProvider(),
  providerEventId: `rc-client-${purchaseResult.transactionIdentifier}`,
  providerProductId: purchaseResult.productIdentifier
    || String(catalogEntry?.providerProductId || '').trim(),
  providerTransactionId: purchaseResult.transactionIdentifier,
  status: 'active',
  teamDocumentIds,
});

/**
 * Achat d'abonnement via le rail actif.
 * @param {{
 *   catalogEntry: any;
 *   clubDocumentId?: string | null;
 *   payerUserDocumentId?: string | null;
 *   teamDocumentIds?: string[];
 * }} input
 * @returns {Promise<any>}
 */
export const performSubscriptionPurchase = async ({
  catalogEntry,
  clubDocumentId,
  payerUserDocumentId,
  teamDocumentIds = [],
}) => {
  const rail = getActiveSubscriptionPurchaseRail();

  if (rail === SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST) {
    const payload = buildSubscriptionPurchasePayload({
      catalogEntry,
      clubDocumentId: clubDocumentId || undefined,
      provider: getSubscriptionTestProvider(Platform.OS),
      teamDocumentIds,
      trustedValidation: true,
    });
    return validateSubscriptionPurchase(payload);
  }

  if (rail === SUBSCRIPTION_PURCHASE_RAILS.STRIPE_WEB) {
    const session = await createStripeWebCheckoutSession({
      clubDocumentId: String(clubDocumentId || '').trim() || undefined,
      planCode: String(catalogEntry?.planCode || '').trim(),
      teamDocumentIds,
    });
    if (!session?.url) {
      throw new Error('Paiement web indisponible pour le moment.');
    }
    // Redirection pleine page vers Stripe Checkout : la suite se joue au retour
    // sur /subscription/web-success (finalisation + webhook RevenueCat).
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(session.url);
    }
    return { checkoutRedirect: true, sessionId: session?.id };
  }

  const purchaseResult = await purchaseSubscriptionViaRevenueCat({
    catalogEntry,
    clubDocumentId,
    payerUserDocumentId,
    teamDocumentIds,
  });

  if (!purchaseResult.transactionIdentifier) {
    // Transaction store inconnue côté client : la vérité arrive par le webhook.
    return { pendingWebhook: true, purchase: purchaseResult };
  }

  try {
    return await validateSubscriptionPurchase(buildRevenueCatValidationPayload({
      catalogEntry,
      clubDocumentId,
      purchaseResult,
      teamDocumentIds,
    }));
  } catch (error) {
    // L'achat store a réussi : ne jamais le présenter comme un échec. Le webhook
    // + le cron de réconciliation activeront les droits.
    return { pendingWebhook: true, purchase: purchaseResult, validationError: true };
  }
};

/**
 * Changement de plan via le rail actif.
 * En rail RevenueCat : achat du nouveau package (proratisation Android via
 * currentPlanCode, Apple gère seul dans le groupe) — le serveur synchronise via
 * le webhook PRODUCT_CHANGE.
 * @param {{
 *   catalogEntry: any;
 *   clubDocumentId?: string | null;
 *   currentPlanCode?: string | null;
 *   payerUserDocumentId?: string | null;
 *   subscriptionDocumentId?: string | null;
 *   teamDocumentIds?: string[];
 * }} input
 * @returns {Promise<any>}
 */
export const performSubscriptionPlanChange = async ({
  catalogEntry,
  clubDocumentId,
  currentPlanCode,
  payerUserDocumentId,
  subscriptionDocumentId,
  teamDocumentIds = [],
}) => {
  const rail = getActiveSubscriptionPurchaseRail();

  // V1 web : le changement d'offre d'un abonnement Stripe (proratisation) n'est
  // pas encore cable — l'abonne gere son offre depuis l'app mobile.
  if (rail === SUBSCRIPTION_PURCHASE_RAILS.STRIPE_WEB) {
    throw new Error('Le changement d offre se fait depuis l app mobile pour le moment.');
  }

  if (rail === SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST) {
    const payload = buildSubscriptionChangePlanPayload({
      catalogEntry,
      clubDocumentId: clubDocumentId || undefined,
      provider: getSubscriptionTestProvider(Platform.OS),
      subscriptionDocumentId,
      teamDocumentIds,
      trustedValidation: true,
    });
    return changeSubscriptionPlan(payload);
  }

  const targetPlanCode = String(catalogEntry?.planCode || '').trim();
  const targetProviderProductId = String(catalogEntry?.providerProductId || '').trim() || targetPlanCode;

  // Même plan = réassignation d'équipes (slots), pas un changement de facturation :
  // aucun passage store. Le backend revalide l'abonnement actif via l'API RevenueCat
  // et préserve la fenêtre de facturation réelle (payload sans dates).
  if (targetPlanCode && targetPlanCode === String(currentPlanCode || '').trim()) {
    return changeSubscriptionPlan({
      autoRenew: true,
      billingPeriod: String(catalogEntry?.billingPeriod || '').trim().toLowerCase(),
      clubDocumentId: String(clubDocumentId || '').trim() || undefined,
      nextPlanCode: targetPlanCode,
      nextProviderProductId: targetProviderProductId,
      planCode: targetPlanCode,
      provider: getStoreProvider(),
      providerProductId: targetProviderProductId,
      status: 'active',
      subscriptionDocumentId,
      teamDocumentIds,
    });
  }

  const purchaseResult = await purchaseSubscriptionViaRevenueCat({
    catalogEntry,
    clubDocumentId,
    currentPlanCode,
    payerUserDocumentId,
    teamDocumentIds,
  });

  return { pendingWebhook: true, purchase: purchaseResult };
};

/**
 * Restauration des achats : SDK store d'abord (rail RevenueCat), puis le
 * restore backend existant — la DB FoundClub reste la source de vérité.
 * @returns {Promise<any>}
 */
export const restoreAllSubscriptionPurchases = async () => {
  if (getActiveSubscriptionPurchaseRail() === SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT) {
    try {
      await restoreRevenueCatPurchases();
    } catch (error) {
      // Le restore backend reste pertinent même si le SDK échoue (hors ligne, etc.).
    }
  }
  return restoreSubscriptionPurchases({});
};
