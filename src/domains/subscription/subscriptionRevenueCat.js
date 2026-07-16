import { Platform } from 'react-native';

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
 * @param {any} error - Erreur brute du SDK RevenueCat.
 * @returns {Error & { code?: string, revenueCatError?: any }}
 */
const mapRevenueCatPurchaseError = (error) => {
  const { PURCHASES_ERROR_CODE } = getPurchasesExports();
  const errorCode = String(error?.code || '');

  if (error?.userCancelled === true
    || errorCode === String(PURCHASES_ERROR_CODE?.PURCHASE_CANCELLED_ERROR)) {
    const cancelled = /** @type {Error & { code?: string, revenueCatError?: any }} */ (
      new Error('Achat annulé. Ton brouillon est toujours là.')
    );
    cancelled.code = REVENUECAT_PURCHASE_ERROR_CODES.CANCELLED;
    cancelled.revenueCatError = error;
    return cancelled;
  }

  if (errorCode === String(PURCHASES_ERROR_CODE?.PAYMENT_PENDING_ERROR)) {
    const pending = /** @type {Error & { code?: string, revenueCatError?: any }} */ (
      new Error('Achat en attente de validation (contrôle parental ou moyen de paiement). Tes accès s\'activeront automatiquement à la confirmation.')
    );
    pending.code = REVENUECAT_PURCHASE_ERROR_CODES.PENDING;
    pending.revenueCatError = error;
    return pending;
  }

  return error;
};

const ensureRevenueCatReadyForPurchase = async (payerUserDocumentId) => {
  if (!isRevenueCatEnabled() || !configureRevenueCatIfNeeded()) {
    throw new Error('Checkout indisponible : la clé RevenueCat est absente de ce build.');
  }

  const targetUserId = String(payerUserDocumentId || lastKnownUserDocumentId || '').trim();
  if (!targetUserId) {
    throw new Error('Utilisateur non identifié : reconnecte-toi avant de finaliser l\'achat.');
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
      `Cette offre (${String(catalogEntry?.planCode || 'inconnue')}) n'est pas encore disponible sur le store. Réessaie dans quelques minutes.`,
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
