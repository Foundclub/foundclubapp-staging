import { Linking, Platform } from 'react-native';

import {
  buildSubscriptionBillingWindow,
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  clampSubscriptionLicenseeCount,
  getSubscriptionTestProvider,
  isPerLicenseeSubscriptionEntry,
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
  increaseSubscriptionLicenseeCount,
  openSubscriptionBillingPortal,
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
 * LA CAISSE WEB, ET LE SEUL ENDROIT QUI SACHE L'OUVRIR.
 *
 * Elle avait UN appelant (le rail web) ; elle en a deux depuis S12-B, parce que
 * l'offre AU LICENCIE y passe meme depuis un telephone (decision D4) : les
 * stores Apple/Google ne vendent que des paliers fixes, ils ne savent pas
 * facturer « N x 2,50 EUR ». Seul Stripe le sait.
 *
 * ⚠️ Ouvrir l'URL ne se fait PAS de la meme facon des deux cotes :
 *  - web      : on REMPLACE la page (le retour se joue sur /subscription/web-success) ;
 *  - telephone: on sort vers le NAVIGATEUR — `window.location` n'existe pas, et
 *               un `assign` silencieux laissait l'utilisateur devant un bouton
 *               qui ne fait rien.
 * @param {{
 *   catalogEntry: any;
 *   clubDocumentId?: string | null;
 *   licenseeCount?: number | null;
 *   teamDocumentIds?: string[];
 * }} input
 * @returns {Promise<{ checkoutRedirect: boolean; sessionId?: string }>}
 */
const openSubscriptionWebCheckout = async ({
  catalogEntry,
  clubDocumentId,
  licenseeCount,
  teamDocumentIds = [],
}) => {
  // Le serveur REFUSE l'offre au licencie sans ce nombre
  // (subscription-stripe.ts:140-144). Mais il ne voyage QUE pour ce modele de
  // prix : sur un forfait, `licenseeCount` ne veut rien dire, et la regle vit
  // ici plutot que chez les deux appelants — deux copies finissent par diverger.
  const normalizedLicenseeCount = isPerLicenseeSubscriptionEntry(catalogEntry)
    ? clampSubscriptionLicenseeCount(licenseeCount)
    : null;
  const session = await createStripeWebCheckoutSession({
    clubDocumentId: String(clubDocumentId || '').trim() || undefined,
    ...(normalizedLicenseeCount === null ? {} : { licenseeCount: normalizedLicenseeCount }),
    planCode: String(catalogEntry?.planCode || '').trim(),
    teamDocumentIds,
  });
  const checkoutUrl = String(session?.url || '').trim();
  if (!checkoutUrl) {
    throw new Error('Paiement web indisponible pour le moment.');
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(checkoutUrl);
    }
  } else {
    await Linking.openURL(checkoutUrl);
  }

  return { checkoutRedirect: true, sessionId: session?.id };
};

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
 *   licenseeCount?: number | null;
 *   payerUserDocumentId?: string | null;
 *   teamDocumentIds?: string[];
 * }} input
 * @returns {Promise<any>}
 */
export const performSubscriptionPurchase = async ({
  catalogEntry,
  clubDocumentId,
  licenseeCount,
  payerUserDocumentId,
  teamDocumentIds = [],
}) => {
  const rail = getActiveSubscriptionPurchaseRail();

  // S12-B/D4 — UNE OFFRE AU LICENCIE S'ACHETE PAR LE WEB, DEPUIS N'IMPORTE OU.
  //
  // Ce n'est pas une preference : les stores Apple/Google ne savent vendre que
  // des paliers fixes, jamais « N x 2,50 EUR » a l'unite (contrainte mesuree a
  // la reconnaissance du 25/08). Le rail actif est donc ignore ICI, et
  // seulement pour ce modele de prix — le mode test compris, parce qu'une
  // validation « de confiance » n'aurait aucun montant a valider.
  // ⚠️ RISQUE STORES consigne au compte rendu : renvoyer vers le web depuis
  // l'app peut etre conteste a la soumission. Cette decision appartient a Adel.
  if (isPerLicenseeSubscriptionEntry(catalogEntry)) {
    return openSubscriptionWebCheckout({
      catalogEntry,
      clubDocumentId,
      licenseeCount,
      teamDocumentIds,
    });
  }

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
    // Redirection pleine page vers Stripe Checkout : la suite se joue au retour
    // sur /subscription/web-success (finalisation + webhook RevenueCat).
    return openSubscriptionWebCheckout({
      catalogEntry,
      clubDocumentId,
      licenseeCount,
      teamDocumentIds,
    });
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
 * S12-B/D5 — AUGMENTER LE NOMBRE DE LICENCIES COUVERTS.
 *
 * Elle passe par le RAIL et pas par le service, pour la meme raison que les
 * achats : c'est un geste d'argent (le serveur facture la difference au prorata
 * immediatement), et le rail est le point d'entree unique que les ecrans
 * connaissent deja — ils le doublent tous en test.
 *
 * ⚠️ Aucun store n'intervient : ce nombre vit dans la QUANTITE Stripe. Le rail
 * actif n'est donc pas consulte, et c'est volontaire.
 * @param {{ licenseeCount: number; subscriptionDocumentId: string }} input
 * @returns {Promise<any>} Reponse SUPERSET du contrat : la lire en `toMatchObject`.
 */
export const performSubscriptionLicenseeIncrease = async ({
  licenseeCount,
  subscriptionDocumentId,
}) => {
  // On ne poste JAMAIS un nombre que le serveur refusera : il rendrait une
  // erreur technique la ou l'ecran doit dire quoi taper. Et c'est de l'argent —
  // un `null` qui passe ici serait une facture au hasard.
  const normalizedLicenseeCount = clampSubscriptionLicenseeCount(licenseeCount);
  if (normalizedLicenseeCount === null) {
    throw new Error('Nombre de licenciés invalide (entier, minimum 1).');
  }

  return increaseSubscriptionLicenseeCount({
    licenseeCount: normalizedLicenseeCount,
    subscriptionDocumentId: String(subscriptionDocumentId || '').trim(),
  });
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

/**
 * ABO-FIX / R3 — OUVRIR LE PORTAIL DE RESILIATION D UN ABONNEMENT WEB.
 *
 * ELLE VIT ICI, ET PAS DANS L'ECRAN, pour deux raisons. La premiere est le
 * contrat de ce module : un seul point d'entree pour tout ce qui touche a
 * l'argent d'un abonnement — resilier en fait partie. La seconde est
 * mecanique : un import de `subscriptionService` de plus dans un ecran tire
 * AsyncStorage et fait tomber la SUITE ENTIERE de ses temoins voisins. Ce
 * module, lui, importe deja le service ET `Linking`.
 *
 * ⚠️ LE SERVEUR REPOND 200 MEME QUAND LE PORTAIL EST INDISPONIBLE : il n'y a
 * AUCUNE cle Stripe en production aujourd hui. On lit donc `available`, on ne
 * suppose pas, et on rend un verdict que l ecran sait raconter.
 * @returns {Promise<{opened: boolean, reason: string}>} Ce qui s est passe.
 */
export const openSubscriptionManagementPortal = async () => {
  const portal = await openSubscriptionBillingPortal();
  const url = String(portal?.url || '').trim();
  if (!portal?.available || !url) {
    return { opened: false, reason: String(portal?.reason || 'unavailable') };
  }
  await Linking.openURL(url);
  return { opened: true, reason: 'ok' };
};
