import { Platform } from 'react-native';

import {
  buildSubscriptionPurchasePayload,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
} from '@/domains/subscription/subscriptionBilling';

import { validateSubscriptionPurchase } from '@/services/subscription/subscriptionService';

import { APP_RUNTIME_ENV } from '@/constants/runtimeFlags';

/**
 * Rail d'achat (handoff item 14). Un seul point d'entrée pour tous les achats
 * d'abonnement de l'app :
 * - `trusted-test` : validation backend en mode test (local/staging) — rail actuel ;
 * - `revenuecat`  : Purchases.purchase(package) — se branche ici quand les
 *   comptes stores + la clé RevenueCat existent (voir docs/SETUP_REVENUECAT_2026_07_10.md).
 * Aucune vue ne doit appeler validateSubscriptionPurchase directement pour un achat.
 */

export const SUBSCRIPTION_PURCHASE_RAILS = {
  REVENUECAT: 'revenuecat',
  TRUSTED_TEST: 'trusted-test',
};

/**
 * @param {string | undefined | null} [runtimeEnv]
 * @returns {string}
 */
export const getActiveSubscriptionPurchaseRail = (runtimeEnv = APP_RUNTIME_ENV) => (
  isSubscriptionBillingTestModeEnabled(runtimeEnv)
    ? SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST
    : SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT
);

/**
 * @returns {boolean}
 */
export const isSubscriptionPurchaseAvailable = () => (
  getActiveSubscriptionPurchaseRail() === SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST
);

/**
 * Achat d'abonnement via le rail actif.
 * @param {{
 *   catalogEntry: any;
 *   clubDocumentId?: string | null;
 *   teamDocumentIds?: string[];
 * }} input
 * @returns {Promise<any>}
 */
export const performSubscriptionPurchase = async ({
  catalogEntry,
  clubDocumentId,
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

  // Point de branchement RevenueCat (item 14 hors-local) :
  // const { customerInfo } = await Purchases.purchasePackage(rcPackage);
  // puis validation serveur via le webhook RevenueCat déjà en place.
  throw new Error(
    'Le checkout store réel sera branché dans une prochaine vague. Utilise le mode test local ou staging pour la recette complète.',
  );
};
