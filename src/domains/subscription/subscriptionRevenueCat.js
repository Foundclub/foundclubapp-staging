import i18next from 'i18next';
import { Platform } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { createLogger } from '@/utils/logger/logger';

/**
 * Intégration RevenueCat côté app (SETUP_REVENUECAT — branchement du rail réel).
 *
 * Principes :
 * - Clés publiques SDK injectées au build : `REVENUECAT_APPLE_API_KEY` /
 *   `REVENUECAT_GOOGLE_API_KEY` (.env locaux + heredoc des workflows CI). Sans clé,
 *   tout le module est inerte (aucun require du SDK) : web, local et jest ne chargent
 *   jamais le natif.
 * - `appUserID` = documentId utilisateur : le webhook serveur résout le payeur par cet
 *   id (`payerUserDocumentId`), un achat anonyme serait orphelin.
 * - Les attributs `clubDocumentId`/`teamDocumentIds` sont posés AVANT l'achat : le
 *   webhook les lit pour rattacher club/équipes (subscription-revenuecat.ts serveur).
 * - Convention produits : Apple = planCode exact (`fc_team_1_monthly`) ; Google =
 *   `famille:basePlan` (`fc_team_1:monthly`). Offerings RevenueCat = famille du
 *   planCode (`fc_team_1`), packages $rc_monthly/$rc_annual.
 */

export const REVENUECAT_PURCHASE_ERROR_CODES = {
  CANCELLED: 'revenuecat-purchase-cancelled',
  PENDING: 'revenuecat-purchase-pending',
};

const logger = createLogger('subscription-price');

// Vitrines qui facturent en euros : codes pays Apple (3 lettres) et Google (2).
// ponytail: les 20 pays de la zone euro au 2025-01-01 ; une vitrine absente de
// la liste garde simplement la devise rendue par le store (regle INTL1).
const EURO_STOREFRONT_COUNTRY_CODES = new Set([
  'AT', 'AUT', 'BE', 'BEL', 'CY', 'CYP', 'DE', 'DEU', 'EE', 'ES',
  'ESP', 'EST', 'FI', 'FIN', 'FR', 'FRA', 'GR', 'GRC', 'HR', 'HRV',
  'IE', 'IRL', 'IT', 'ITA', 'LT', 'LTU', 'LU', 'LUX', 'LV', 'LVA',
  'MLT', 'MT', 'NL', 'NLD', 'PRT', 'PT', 'SI', 'SK', 'SVK', 'SVN',
]);

const REVENUECAT_APPLE_API_KEY = String(process.env.REVENUECAT_APPLE_API_KEY || '').trim();
const REVENUECAT_GOOGLE_API_KEY = String(process.env.REVENUECAT_GOOGLE_API_KEY || '').trim();

let cachedPurchasesExports = null;
let isConfigured = false;
let lastSyncedAppUserId = '';
let lastKnownUserDocumentId = '';
/** @type {string | null} */
let testApiKeyOverride = null;

/**
 * Jest uniquement : simule la présence d'une clé sans build natif.
 * @param {string | null} value
 */
export const setRevenueCatApiKeyForTests = (value) => {
  testApiKeyOverride = value == null ? null : String(value);
};

/** Jest uniquement : réinitialise l'état module entre deux tests. */
export const resetRevenueCatStateForTests = () => {
  cachedPurchasesExports = null;
  isConfigured = false;
  lastSyncedAppUserId = '';
  lastKnownUserDocumentId = '';
  testApiKeyOverride = null;
};

/**
 * @param {string | undefined | null} [platform]
 * @returns {string}
 */
export const getRevenueCatApiKey = (platform = Platform.OS) => {
  if (testApiKeyOverride != null) {
    return testApiKeyOverride;
  }
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  if (normalizedPlatform === 'ios') return REVENUECAT_APPLE_API_KEY;
  if (normalizedPlatform === 'android') return REVENUECAT_GOOGLE_API_KEY;
  return '';
};

/** @returns {boolean} */
export const isRevenueCatEnabled = () => Boolean(getRevenueCatApiKey());

const getPurchasesExports = () => {
  if (!cachedPurchasesExports) {
    // Require lazy : jamais chargé tant qu'aucune clé n'est configurée.
    // eslint-disable-next-line global-require
    cachedPurchasesExports = require('react-native-purchases');
  }
  return cachedPurchasesExports;
};

const getPurchases = () => {
  const moduleExports = getPurchasesExports();
  return moduleExports?.default || moduleExports;
};

/**
 * Configure le SDK une seule fois (gardé par la présence de la clé).
 * @returns {boolean} true si le SDK est prêt.
 */
export const configureRevenueCatIfNeeded = () => {
  if (isConfigured) {
    return true;
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return false;
  }
  getPurchases().configure({ apiKey });
  isConfigured = true;
  return true;
};

/**
 * Aligne l'identité RevenueCat sur la session FoundClub (logIn/logOut).
 * Idempotent et silencieux : ne doit jamais casser le boot ni la déconnexion.
 * @param {string | undefined | null} userDocumentId
 * @returns {Promise<void>}
 */
export const syncRevenueCatIdentity = async (userDocumentId) => {
  const normalizedUserId = String(userDocumentId || '').trim();
  lastKnownUserDocumentId = normalizedUserId;

  if (!isRevenueCatEnabled() || !configureRevenueCatIfNeeded()) {
    return;
  }

  if (normalizedUserId) {
    if (lastSyncedAppUserId === normalizedUserId) {
      return;
    }
    await getPurchases().logIn(normalizedUserId);
    lastSyncedAppUserId = normalizedUserId;
    return;
  }

  if (lastSyncedAppUserId) {
    lastSyncedAppUserId = '';
    try {
      await getPurchases().logOut();
    } catch (error) {
      // logOut rejette si l'utilisateur est déjà anonyme : sans conséquence.
    }
  }
};

/**
 * Famille d'offering RevenueCat d'un planCode (`fc_team_1_monthly` → `fc_team_1`).
 * @param {string | undefined | null} planCode
 * @returns {string}
 */
export const getRevenueCatOfferingIdForPlanCode = (planCode) => (
  String(planCode || '').trim().replace(/_(monthly|yearly)$/, '')
);

/**
 * @param {string | undefined | null} identifier
 * @returns {string}
 */
const normalizeStoreProductIdentifier = (identifier) => (
  String(identifier || '').trim().split(':').join('_')
);

/**
 * Résout le package RevenueCat d'une entrée du catalogue serveur.
 * Passe par l'offering de la famille puis, en secours, par une recherche du
 * product identifier normalisé (`fc_team_1:monthly` ≡ `fc_team_1_monthly`).
 * @param {any} offerings - Résultat de Purchases.getOfferings().
 * @param {any} catalogEntry
 * @returns {any | null}
 */
export const resolveRevenueCatPackageForCatalogEntry = (offerings, catalogEntry) => {
  const planCode = String(catalogEntry?.planCode || '').trim();
  if (!planCode) {
    return null;
  }

  const offeringId = getRevenueCatOfferingIdForPlanCode(planCode);
  const billingPeriod = String(catalogEntry?.billingPeriod || '').trim().toLowerCase();
  const offering = offerings?.all?.[offeringId] || null;
  const preferredPackage = billingPeriod === 'yearly' ? offering?.annual : offering?.monthly;
  if (preferredPackage?.product?.identifier) {
    return preferredPackage;
  }

  const candidatePackages = [
    ...(Array.isArray(offering?.availablePackages) ? offering.availablePackages : []),
    ...Object.values(offerings?.all || {})
      .flatMap((entry) => (Array.isArray(entry?.availablePackages) ? entry.availablePackages : [])),
  ];
  return candidatePackages
    .find((candidate) => normalizeStoreProductIdentifier(candidate?.product?.identifier) === planCode)
    || null;
};

/**
 * Prix du store, en centimes DE SA DEVISE, pour les entrees du catalogue serveur.
 *
 * L39 — le prix lu est celui du package que `purchaseSubscriptionViaRevenueCat`
 * achetera, resolu par LA MEME fonction. Passer par une seconde table
 * d'identifiants rouvrirait exactement l'ecart qu'on cherche a fermer : le
 * prix affiche et le prix facture doivent venir du meme objet.
 *
 * INTL1 — la devise VOYAGE avec les prix : en Suisse ou aux Emirats le store
 * facture en CHF / AED, et l'ecran doit le dire. Un produit sans devise
 * declaree est lu en EUR.
 *
 * DEVISE — deux cas ou la devise du store ne peut pas etre crue, et ou TOUS ses
 * prix sont ecartes (l'appelant retombe sur le catalogue serveur en euros) :
 * - plusieurs devises dans le meme store : aucune ne decide pour les autres ;
 * - une vitrine de la zone euro avec des prix dans une autre devise. C'est ce
 *   que rend StoreKit en TestFlight / bac a sable (limite connue d'Apple) alors
 *   que la fenetre de paiement facture en euros : « 229,99 USD/an » sur l'ecran.
 *
 * Un palier absent du store est simplement absent du resultat : on ne l'invente
 * jamais, et l'appelant en fait ce qu'il veut.
 * @param {any} offerings - Resultat de Purchases.getOfferings().
 * @param {any[]} catalogEntries
 * @param {string | null} [storefrontCountryCode] - `Purchases.getStorefront()`.
 * @returns {{ currencyCode: string; pricesInCents: Record<string, number> }}
 */
export const mapRevenueCatStorePricesInCents = (
  offerings,
  catalogEntries,
  storefrontCountryCode,
) => {
  /** @type {Record<string, number>} */
  const pricesInCents = {};
  /** @type {Set<string>} */
  const currencyCodes = new Set();

  (Array.isArray(catalogEntries) ? catalogEntries : []).forEach((catalogEntry) => {
    const planCode = String(catalogEntry?.planCode || '').trim();
    if (!planCode) {
      return;
    }

    const storeProduct = resolveRevenueCatPackageForCatalogEntry(offerings, catalogEntry)?.product;
    const price = Number(storeProduct?.price);
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }

    currencyCodes.add(String(storeProduct?.currencyCode || '').trim().toUpperCase() || 'EUR');
    pricesInCents[planCode] = Math.round(price * 100);
  });

  const [currencyCode = 'EUR', ...otherCurrencyCodes] = [...currencyCodes];
  if (otherCurrencyCodes.length > 0) {
    logger.warn('store prices ignored: several currencies in the same store', {
      currencyCodes: [...currencyCodes],
    });
    return { currencyCode: 'EUR', pricesInCents: {} };
  }

  const storefront = String(storefrontCountryCode || '').trim().toUpperCase();
  if (currencyCode !== 'EUR' && EURO_STOREFRONT_COUNTRY_CODES.has(storefront)) {
    logger.warn('store prices ignored: currency does not match the euro storefront', {
      currencyCode,
      storefrontCountryCode: storefront,
    });
    return { currencyCode: 'EUR', pricesInCents: {} };
  }

  return { currencyCode, pricesInCents };
};

/**
 * Vitrine du compte store, ou null. Ne bloque jamais la lecture des prix.
 * @param {any} purchases
 * @returns {Promise<string | null>}
 */
const readStorefrontCountryCode = async (purchases) => {
  try {
    const storefront = await purchases?.getStorefront?.();
    return storefront?.countryCode || null;
  } catch {
    return null;
  }
};

/**
 * Lit les prix du store pour le catalogue serveur.
 *
 * Rend `null` des que le store ne peut pas repondre — web (pas de SDK store,
 * la vente y passe par Stripe), build sans cle, panne reseau. L'appelant
 * retombe alors sur les prix du serveur : **un ecran de vente doit toujours
 * porter un prix**.
 * @param {any[]} catalogEntries
 * @returns {Promise<{ currencyCode: string; pricesInCents: Record<string, number> } | null>}
 */
export const readRevenueCatStorePricesInCents = async (catalogEntries) => {
  // Web et builds sans cle : etat NORMAL de la plateforme, pas un incident.
  // Aucun journal ici, sinon l'alarme sonnerait a chaque ouverture du site.
  if (!isRevenueCatEnabled() || !configureRevenueCatIfNeeded()) {
    return null;
  }

  try {
    const purchases = getPurchases();
    const [offerings, storefrontCountryCode] = await Promise.all([
      purchases.getOfferings(),
      readStorefrontCountryCode(purchases),
    ]);
    return mapRevenueCatStorePricesInCents(offerings, catalogEntries, storefrontCountryCode);
  } catch (error) {
    const storeError = /** @type {any} */ (error);
    logger.warn('store injoignable : les prix affiches restent ceux du serveur', {
      message: storeError?.message || String(error),
    });
    return null;
  }
};

/**
 * @param {any} error - Erreur brute du SDK RevenueCat.
 * @returns {Error & { code?: string, revenueCatError?: any }}
 */
const mapRevenueCatPurchaseError = (error) => {
  const { PURCHASES_ERROR_CODE } = getPurchasesExports();
  const errorCode = String(error?.code || '');

  if (error?.userCancelled === true
    || errorCode === String(PURCHASES_ERROR_CODE?.PURCHASE_CANCELLED_ERROR)) {
    const cancelled = /** @type {Error & { code?: string, revenueCatError?: any }} */ (
      new Error(i18next.t(
        'subscriptionRevenueCat.errors.purchaseCancelled',
        'Achat annulé. Ton brouillon est toujours là.',
      ))
    );
    cancelled.code = REVENUECAT_PURCHASE_ERROR_CODES.CANCELLED;
    cancelled.revenueCatError = error;
    return cancelled;
  }

  if (errorCode === String(PURCHASES_ERROR_CODE?.PAYMENT_PENDING_ERROR)) {
    const pending = /** @type {Error & { code?: string, revenueCatError?: any }} */ (
      new Error(i18next.t(
        'subscriptionRevenueCat.errors.purchasePending',
        'Achat en attente de validation (contrôle parental ou moyen de paiement). Tes accès '
          + "s'activeront automatiquement à la confirmation.",
      ))
    );
    pending.code = REVENUECAT_PURCHASE_ERROR_CODES.PENDING;
    pending.revenueCatError = error;
    return pending;
  }

  return error;
};

const ensureRevenueCatReadyForPurchase = async (payerUserDocumentId) => {
  if (!isRevenueCatEnabled() || !configureRevenueCatIfNeeded()) {
    throw new Error(i18next.t(
      'subscriptionRevenueCat.errors.missingRevenueCatKey',
      'Checkout indisponible : la clé RevenueCat est absente de ce build.',
    ));
  }

  const targetUserId = String(payerUserDocumentId || lastKnownUserDocumentId || '').trim();
  if (!targetUserId) {
    throw new Error(i18next.t(
      'subscriptionRevenueCat.errors.userNotIdentified',
      "Utilisateur non identifié : reconnecte-toi avant de finaliser l'achat.",
    ));
  }

  if (lastSyncedAppUserId !== targetUserId) {
    await getPurchases().logIn(targetUserId);
    lastSyncedAppUserId = targetUserId;
  }
};

/**
 * Achat (ou changement de plan) via RevenueCat.
 * @param {{
 *   catalogEntry: any;
 *   clubDocumentId?: string | null;
 *   currentPlanCode?: string | null;
 *   payerUserDocumentId?: string | null;
 *   platform?: string;
 *   teamDocumentIds?: string[];
 * }} input - `currentPlanCode` (plan actif) déclenche la proratisation Android
 *   (`googleProductChangeInfo`) ; Apple gère seul via le groupe d'abonnements.
 * @returns {Promise<{ customerInfo: any; productIdentifier: string; transactionIdentifier: string }>}
 */
export const purchaseSubscriptionViaRevenueCat = async ({
  catalogEntry,
  clubDocumentId,
  currentPlanCode,
  payerUserDocumentId,
  platform = Platform.OS,
  teamDocumentIds = [],
}) => {
  await ensureRevenueCatReadyForPurchase(payerUserDocumentId);
  const Purchases = getPurchases();

  const normalizedTeamDocumentIds = (Array.isArray(teamDocumentIds) ? teamDocumentIds : [])
    .map((teamDocumentId) => String(teamDocumentId || '').trim())
    .filter(Boolean);
  await Purchases.setAttributes({
    clubDocumentId: String(clubDocumentId || '').trim() || null,
    teamDocumentIds: normalizedTeamDocumentIds.length > 0
      ? JSON.stringify(normalizedTeamDocumentIds)
      : null,
  });

  const offerings = await Purchases.getOfferings();
  const rcPackage = resolveRevenueCatPackageForCatalogEntry(offerings, catalogEntry);
  if (!rcPackage) {
    throw new Error(
      i18next.t(
        'subscriptionRevenueCat.errors.offerNotOnStore',
        "Cette offre ({{planCode}}) n'est pas encore disponible sur le store. Réessaie dans "
          + 'quelques minutes.',
        { planCode: String(catalogEntry?.planCode || 'inconnue'), ...SANS_ECHAPPEMENT },
      ),
    );
  }

  const oldProductFamily = getRevenueCatOfferingIdForPlanCode(currentPlanCode);
  const isAndroidPlatform = String(platform || '').trim().toLowerCase() === 'android';
  const googleProductChangeInfo = isAndroidPlatform && oldProductFamily
    ? { oldProductIdentifier: oldProductFamily }
    : null;

  try {
    const result = await Purchases.purchasePackage(rcPackage, null, googleProductChangeInfo);
    return {
      customerInfo: result?.customerInfo || null,
      productIdentifier: String(result?.productIdentifier || rcPackage?.product?.identifier || ''),
      transactionIdentifier: String(result?.transaction?.transactionIdentifier || ''),
    };
  } catch (error) {
    throw mapRevenueCatPurchaseError(error);
  }
};

/**
 * Restauration store (avant le restore backend, qui reste la source de vérité).
 * No-op hors rail RevenueCat.
 * @returns {Promise<any | null>}
 */
export const restoreRevenueCatPurchases = async () => {
  if (!isRevenueCatEnabled() || !configureRevenueCatIfNeeded()) {
    return null;
  }

  if (lastKnownUserDocumentId && lastSyncedAppUserId !== lastKnownUserDocumentId) {
    await getPurchases().logIn(lastKnownUserDocumentId);
    lastSyncedAppUserId = lastKnownUserDocumentId;
  }

  return getPurchases().restorePurchases();
};
