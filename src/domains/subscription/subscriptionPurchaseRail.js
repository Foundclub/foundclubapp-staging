import { Linking, Platform } from 'react-native';

import {
  buildSubscriptionBillingWindow,
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  clampSubscriptionLicenseeCount,
  getSubscriptionBillingErrorMessage,
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

import { createLogger } from '@/utils/logger/logger';

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

/**
 * ABOFIX / A2 — CE MODULE ETAIT ENTIEREMENT MUET, ET CA A COUTE UNE JOURNEE.
 *
 * Le 2026-09-04, Adel achete un abonnement en bac a sable : l app dit « c est
 * bon » et rien ne change. Le serveur, lui, avait bien repondu 400
 * (« Subscription source introuvable pour changement d offre », 09:59 et 10:06).
 * Ce message n existait QUE dans les journaux du VPS : le rail avalait l erreur,
 * `grep -c createLogger` rendait 0, et ni `pendingWebhook` ni `validationError`
 * n avaient le moindre lecteur dans tout `app/src`.
 *
 * ⚠️ CES JOURNAUX NE CHANGENT AUCUN COMPORTEMENT. Les deux `return` concernes
 * rendent exactement ce qu ils rendaient : un achat store reussi ne doit jamais
 * etre presente comme un echec a l utilisateur.
 */
const subscriptionPurchaseRailLogger = createLogger('subscription-purchase-rail');

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
 * Normalise une date du SDK store en ISO.
 * @param {any} value - Une date rendue par le SDK store.
 * @returns {string | null} La meme date en ISO, ou null si elle est inexploitable.
 */
const toIsoDateOrNull = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/**
 * Traduit le magasin RevenueCat en provider serveur.
 * @param {any} store - Le champ `store` d un entitlement RevenueCat.
 * @returns {'apple' | 'google'} Le provider attendu par le serveur.
 */
const mapRevenueCatStoreToProvider = (store) => {
  const normalized = String(store || '').trim().toUpperCase();
  if (normalized === 'APP_STORE' || normalized === 'MAC_APP_STORE') return 'apple';
  if (normalized === 'PLAY_STORE') return 'google';
  return getStoreProvider();
};

/**
 * ABOFIX / A4 — CE QUE LE STORE SAIT, TRADUIT EN CE QUE LE SERVEUR ATTEND.
 *
 * `restoreRevenueCatPurchases()` rend un `customerInfo` : la liste des droits que
 * le store reconnait a ce compte. C est la seule source de verite disponible
 * quand le webhook n est jamais arrive — et le rail la jetait pour poster `{}`.
 *
 * ⚠️ LIMITE CONNUE, ET ELLE EST DANS LE SDK, PAS ICI : un `customerInfo` ne
 * porte AUCUN identifiant de transaction store (seul un achat en direct en rend
 * un, via `result.transaction`). On fabrique donc un identifiant DETERMINISTE a
 * partir de ce que le store garantit stable — produit + date d achat d origine —
 * pour que deux restaurations de suite visent la meme ligne en base au lieu d en
 * creer une par appui. `providerEventId` embarque en plus la date d echeance :
 * une nouvelle periode de facturation redevient donc un evenement neuf, sans
 * changer la ligne visee.
 * ponytail: identifiant synthetique, plafond assume — un abonnement deja connu
 * du serveur sous son vrai identifiant store pourrait etre vu comme un second
 * abonnement. Voie de sortie : lire `store_transaction_id` dans la reponse
 * `/subscribers` que le serveur interroge deja (`verifyPurchaseWithApi`).
 * @param {any} customerInfo - Ce que rend le SDK RevenueCat.
 * @returns {Record<string, any>[]} Les achats a transmettre, ou une liste vide.
 */
const buildRestoredPurchasesPayload = (customerInfo) => {
  const activeEntitlements = customerInfo?.entitlements?.active;
  if (!activeEntitlements || typeof activeEntitlements !== 'object') return [];

  return Object.values(activeEntitlements)
    .map((/** @type {any} */ entitlement) => {
      const providerProductId = String(entitlement?.productIdentifier || '').trim();
      const currentPeriodStart = toIsoDateOrNull(entitlement?.latestPurchaseDate);
      // Sans produit ni date de debut, le serveur refuserait la charge utile :
      // on ne poste pas une ligne qu on sait invalide.
      if (!providerProductId || !currentPeriodStart) return null;

      const provider = mapRevenueCatStoreToProvider(entitlement?.store);
      const currentPeriodEnd = toIsoDateOrNull(entitlement?.expirationDate);
      const ancrage = toIsoDateOrNull(entitlement?.originalPurchaseDate) || currentPeriodStart;
      const providerTransactionId = `rc-restore-${provider}-${providerProductId}-${ancrage}`;

      return {
        autoRenew: entitlement?.willRenew === true,
        currentPeriodEnd,
        currentPeriodStart,
        provider,
        providerEventId: `${providerTransactionId}-${currentPeriodEnd || currentPeriodStart}`,
        providerProductId,
        providerTransactionId,
        status: 'active',
      };
    })
    .filter(Boolean);
};

/**
 * VITRINE / W1 — LE SERVEUR A-T-IL REPONDU NON, OU N A-T-IL RIEN DIT ?
 *
 * ⚠️ CE N EST PAS LA MEME CHOSE, ET LES CONFONDRE COUTE DES DEUX COTES :
 * celebrer un refus fait croire a des droits qui n existent pas ; annoncer un
 * refus sur une coupure reseau accuse quelqu un qui vient de payer.
 *
 * L intercepteur HTTP rejette la charge Strapi DEBALLEE — `{ status, name,
 * message }` — quand le serveur a REPONDU, et sinon la chaine nue d axios
 * (« Network Error », aucun status) ou l objet d abandon a 15 s (`status: 0`,
 * client.native.js / client.web.js). Le status est donc le seul juge honnete.
 *
 * Un 5xx reste un SILENCE : le serveur s est casse, il n a rien tranche — et le
 * webhook du store peut encore ouvrir les droits.
 * @param {any} error - L erreur telle que rejetee par le client HTTP.
 * @returns {boolean} Vrai seulement si le serveur a explicitement dit non.
 */
const isExplicitServerRefusal = (error) => {
  const status = Number(error?.status ?? error?.response?.status ?? NaN);
  return Number.isFinite(status) && status >= 400 && status < 500;
};

/**
 * Le verdict qu un ecran doit savoir lire quand la validation n a pas abouti.
 *
 * `serverRefused` est le SEUL champ qui autorise un ecran a barrer la route :
 * `validationError` seul ne distingue pas un « non » d un « je n ai pas pu
 * demander ». Et `validationErrorMessage` n est rempli QUE sur un vrai refus,
 * pour qu il soit impossible d afficher une accusation sur un silence.
 * @param {any} error - L erreur rejetee par le service.
 * @param {any} purchaseResult - Ce que le SDK store a rendu (l achat, lui, a eu lieu).
 * @returns {Record<string, any>} Le contrat rendu a l ecran.
 */
const buildValidationRefusal = (error, purchaseResult) => {
  const serverRefused = isExplicitServerRefusal(error);
  return {
    pendingWebhook: true,
    purchase: purchaseResult,
    serverRefused,
    validationError: true,
    validationErrorMessage: serverRefused ? getSubscriptionBillingErrorMessage(error) : '',
  };
};

/**
 * VITRINE / W3 — CE QU ON A ENCORE QUAND LE SDK NE REND PAS DE TRANSACTION.
 *
 * `purchasePackage` peut resoudre sans `result.transaction` (le SDK ne le
 * garantit pas), et le rail sortait alors EN SILENCE : aucun POST, serveur
 * totalement aveugle sur un achat pourtant encaisse (mesure du 2026-09-04,
 * « Club Illimite » a 14:22:44, zero requete de l app).
 *
 * Mais le meme resultat porte un `customerInfo` — la liste des droits que le
 * store reconnait a ce compte. On en derive EXACTEMENT l identifiant
 * deterministe deja utilise par « Restaurer mes achats » (ABOFIX/A4), pour que
 * deux envois de suite visent la meme ligne en base au lieu d en creer deux.
 * @param {any} purchaseResult - Ce que rend `purchaseSubscriptionViaRevenueCat`.
 * @returns {{ providerEventId: string, providerTransactionId: string } | null}
 */
const buildFallbackTransactionIdentity = (purchaseResult) => {
  const restoredPurchases = buildRestoredPurchasesPayload(purchaseResult?.customerInfo);
  const productIdentifier = String(purchaseResult?.productIdentifier || '').trim();
  const match = restoredPurchases.find(
    (/** @type {any} */ entry) => entry.providerProductId === productIdentifier,
  ) || restoredPurchases[0];
  if (!match?.providerTransactionId) {
    return null;
  }
  return {
    providerEventId: String(match.providerEventId || ''),
    providerTransactionId: String(match.providerTransactionId || ''),
  };
};

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

  // VITRINE / W3 — LA SORTIE MUETTE N 1 EST FERMEE : ON POSTE CE QU ON A.
  // Sans identifiant de transaction, le rail ne postait RIEN et tout reposait
  // sur le webhook du store ; s il n arrivait pas, le compte restait sans droits
  // et personne ne le savait. Desormais on pose la question au serveur avec ce
  // que le SDK garantit encore (son `customerInfo`), et c est LUI qui tranche.
  const fallbackTransactionIdentity = purchaseResult.transactionIdentifier
    ? null
    : buildFallbackTransactionIdentity(purchaseResult);

  if (!purchaseResult.transactionIdentifier) {
    subscriptionPurchaseRailLogger.error(
      '[VITRINE] achat store sans identifiant de transaction : on poste quand meme,'
      + ' au serveur de trancher',
      {
        fallbackTransactionId: String(fallbackTransactionIdentity?.providerTransactionId || ''),
        planCode: String(catalogEntry?.planCode || ''),
        productIdentifier: String(purchaseResult?.productIdentifier || ''),
      },
    );
  }

  try {
    return await validateSubscriptionPurchase({
      ...buildRevenueCatValidationPayload({
        catalogEntry,
        clubDocumentId,
        purchaseResult,
        teamDocumentIds,
      }),
      ...(fallbackTransactionIdentity || {}),
    });
  } catch (error) {
    // ABOFIX / A2 — SORTIE MUETTE N 2 : c est ICI que le 400 du 2026-09-04 a
    // disparu. Le message du serveur est la seule chose qui dise POURQUOI, et il
    // etait jete.
    // VITRINE / W1 — il ne l est plus : le verdict REMONTE jusqu a l ecran.
    // L achat store a bien eu lieu, donc le contrat garde `pendingWebhook` et
    // `purchase` ; ce qui s ajoute, c est de quoi ne plus feliciter un refus.
    subscriptionPurchaseRailLogger.error(
      '[ABOFIX] le serveur a refuse la validation de l achat store',
      {
        message: String(error?.message || error || ''),
        productIdentifier: String(purchaseResult?.productIdentifier || ''),
        transactionIdentifier: String(purchaseResult?.transactionIdentifier || ''),
      },
    );
    return buildValidationRefusal(error, purchaseResult);
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

  // La MEME charge utile pour les deux branches ci-dessous : reassignation de
  // creneaux et changement de palier posent au serveur exactement la meme
  // question — « change CET abonnement-la ». Deux copies finiraient par diverger.
  const changePlanPayload = {
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
  };

  // Même plan = réassignation d'équipes (slots), pas un changement de facturation :
  // aucun passage store. Le backend revalide l'abonnement actif via l'API RevenueCat
  // et préserve la fenêtre de facturation réelle (payload sans dates).
  if (targetPlanCode && targetPlanCode === String(currentPlanCode || '').trim()) {
    return changeSubscriptionPlan(changePlanPayload);
  }

  const purchaseResult = await purchaseSubscriptionViaRevenueCat({
    catalogEntry,
    clubDocumentId,
    currentPlanCode,
    payerUserDocumentId,
    teamDocumentIds,
  });

  // VITRINE / W2 — LA SECONDE SORTIE MUETTE : ON REPARLE AU SERVEUR.
  // Le rail achetait le nouveau palier au store puis rendait un objet, SANS
  // jamais appeler la route de changement d offre — alors qu il tient
  // `subscriptionDocumentId` en main depuis le premier parametre de cette
  // fonction. Cote FoundClub il ne restait donc que le webhook du store, refuse
  // le 2026-09-04 faute de savoir quel abonnement remplacer.
  // ⚠️ On passe l identifiant TEL QUEL : depuis ABOFIX3, la route exige que le
  // compte soit proprietaire de l abonnement source. Fabriquer un identifiant de
  // repli ferait echouer cette preuve au lieu de l apporter.
  try {
    return await changeSubscriptionPlan(changePlanPayload);
  } catch (error) {
    // `catch` rend `{}` sous ce jsconfig : le cast garde `?.message` lisible sans
    // ajouter une alerte de type (meme motif que subscriptionRevenueCat.js).
    const refusalError = /** @type {any} */ (error);
    subscriptionPurchaseRailLogger.error(
      '[VITRINE] le serveur a refuse le changement d offre',
      {
        message: String(refusalError?.message || refusalError || ''),
        nextPlanCode: targetPlanCode,
        subscriptionDocumentId: String(subscriptionDocumentId || ''),
      },
    );
    return buildValidationRefusal(error, purchaseResult);
  }
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
  let purchases = [];

  if (getActiveSubscriptionPurchaseRail() === SUBSCRIPTION_PURCHASE_RAILS.REVENUECAT) {
    try {
      // ABOFIX / A4 — CE QUE LE SDK REND EST LA VERITE DU STORE, ET ON LA JETAIT.
      purchases = buildRestoredPurchasesPayload(await restoreRevenueCatPurchases());
    } catch (error) {
      // Le restore backend reste pertinent même si le SDK échoue (hors ligne, etc.).
    }
  }

  // Liste vide = on garde le comportement d avant (le serveur relit sa propre
  // base). C est le bon repli quand le store ne connait aucun droit actif.
  return restoreSubscriptionPurchases(purchases.length > 0 ? { purchases } : {});
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
