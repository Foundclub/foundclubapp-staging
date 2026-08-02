import { formatSubscriptionPlanLabel } from './subscriptionDecision';

const TEAM_SCOPE = 'TEAM';

// A/B palier preselectionne (handoff item 13) : OFF par defaut — tout le monde
// voit le palier 2. Passer a true pour activer le test (bucket B = palier 1).
export const SUBSCRIPTION_TIER_AB_TEST_ENABLED = false;

/**
 * Bucket A/B stable derive de l'identifiant utilisateur (pas de hasard runtime).
 * @param {string | null | undefined} userDocumentId
 * @returns {'A' | 'B'}
 */
export const getSubscriptionTierAbBucket = (userDocumentId) => {
  const raw = String(userDocumentId || '');
  if (!raw) return 'A';
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash * 31) + raw.charCodeAt(index)) % 997;
  }
  return hash % 2 === 0 ? 'A' : 'B';
};

/**
 * Palier preselectionne dans la sheet quota selon le bucket.
 * @param {'A' | 'B'} bucket
 * @returns {number}
 */
export const getSubscriptionPreselectedSlotCount = (bucket) => {
  if (!SUBSCRIPTION_TIER_AB_TEST_ENABLED) return 2;
  return bucket === 'B' ? 1 : 2;
};

/**
 * @param {string | undefined | null} runtimeEnv
 * @returns {boolean}
 */
export const isSubscriptionBillingTestModeEnabled = (runtimeEnv) => {
  const normalizedRuntimeEnv = String(runtimeEnv || '').trim().toLowerCase();
  return normalizedRuntimeEnv === 'local' || normalizedRuntimeEnv === 'staging';
};

/**
 * @param {string | undefined | null} platform
 * @returns {'apple' | 'google'}
 */
export const getSubscriptionTestProvider = (platform) => (
  String(platform || '').trim().toLowerCase() === 'ios' ? 'apple' : 'google'
);

/**
 * @param {any[]} entries
 * @returns {any[]}
 */
export const sortSubscriptionCatalogEntries = (entries) => {
  const safeEntries = Array.isArray(entries) ? [...entries] : [];
  return safeEntries.sort((left, right) => {
    const leftScope = String(left?.scopeType || '').trim().toUpperCase();
    const rightScope = String(right?.scopeType || '').trim().toUpperCase();
    if (leftScope !== rightScope) {
      return leftScope === TEAM_SCOPE ? -1 : 1;
    }

    if (leftScope === TEAM_SCOPE) {
      const leftSlotCount = Number(left?.slotCount || 0);
      const rightSlotCount = Number(right?.slotCount || 0);
      if (leftSlotCount !== rightSlotCount) {
        return leftSlotCount - rightSlotCount;
      }
    } else {
      const leftTier = Number(String(left?.planCode || '').match(/tier_(\d+)/)?.[1] || 0);
      const rightTier = Number(String(right?.planCode || '').match(/tier_(\d+)/)?.[1] || 0);
      if (leftTier !== rightTier) {
        return leftTier - rightTier;
      }
    }

    const leftBillingPeriod = String(left?.billingPeriod || '').trim().toLowerCase();
    const rightBillingPeriod = String(right?.billingPeriod || '').trim().toLowerCase();
    if (leftBillingPeriod !== rightBillingPeriod) {
      return leftBillingPeriod === 'monthly' ? -1 : 1;
    }

    return String(left?.planCode || '').localeCompare(String(right?.planCode || ''), 'fr');
  });
};

/**
 * @param {number | null | undefined} priceEurCents
 * @param {'monthly' | 'yearly' | string} billingPeriod
 * @returns {string}
 */
export const formatSubscriptionPriceLabel = (priceEurCents, billingPeriod) => {
  const cents = Number(priceEurCents);
  if (!Number.isFinite(cents) || cents < 0) {
    return '';
  }
  const amount = (cents / 100).toFixed(2).replace('.', ',');
  const normalizedPeriod = String(billingPeriod || '').trim().toLowerCase();
  let periodSuffix = '';
  if (normalizedPeriod === 'yearly') {
    periodSuffix = '/an';
  } else if (normalizedPeriod === 'monthly') {
    periodSuffix = '/mois';
  }
  return `${amount} €${periodSuffix}`;
};

/**
 * Equivalence mensuelle exacte d'un prix annuel (« soit 5,00 €/mois »).
 * Une seule ancre prix par surface : ce libelle accompagne toujours l'ancre annuelle,
 * jamais les segments de palier ni le sous-texte d'un CTA.
 * @param {number | null | undefined} yearlyPriceEurCents
 * @returns {string}
 */
export const formatSubscriptionMonthlyEquivalentLabel = (yearlyPriceEurCents) => {
  const cents = Number(yearlyPriceEurCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    return '';
  }
  return `soit ${(cents / 12 / 100).toFixed(2).replace('.', ',')} €/mois`;
};

/**
 * @param {any} entry
 * @returns {{ description: string; label: string; priceLabel: string; secondaryLabel: string }}
 */
export const getSubscriptionCatalogEntryMeta = (entry) => {
  const scopeType = String(entry?.scopeType || '').trim().toUpperCase();
  const billingPeriod = String(entry?.billingPeriod || '').trim().toLowerCase();
  const slotCount = Number(entry?.slotCount || 0);
  const periodLabel = billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel';
  const displayName = String(entry?.displayName || '').trim();
  const priceLabel = formatSubscriptionPriceLabel(entry?.referencePriceEurCents, billingPeriod);

  if (scopeType === TEAM_SCOPE) {
    const slotsLabel = `${slotCount} équipe${slotCount > 1 ? 's' : ''} couverte${slotCount > 1 ? 's' : ''}`;
    return {
      description: 'Publie et gère les équipes couvertes par tes slots Team.',
      label: displayName || formatSubscriptionPlanLabel(entry?.planCode),
      priceLabel,
      secondaryLabel: [slotsLabel, periodLabel, priceLabel].filter(Boolean).join(' - '),
    };
  }

  return {
    // R10 — l'argumentaire posait une condition qui n'existe plus depuis la
    // decision produit du 2026-07-17 : l'offre ouvre les droits immediatement,
    // club certifie ou pas. On supprime l'affirmation au lieu de la reformuler.
    description: 'Débloque les droits club sur tout ton club.',
    label: displayName || formatSubscriptionPlanLabel(entry?.planCode),
    priceLabel,
    secondaryLabel: ['Droits Club', periodLabel, priceLabel].filter(Boolean).join(' - '),
  };
};

/**
 * @param {any[]} teams
 * @returns {any[]}
 */
export const getSubscriptionSelectableTeams = (teams) => {
  const uniqueTeams = new Map();
  (Array.isArray(teams) ? teams : []).forEach((team) => {
    const teamDocumentId = String(team?.documentId || '').trim();
    if (!teamDocumentId || uniqueTeams.has(teamDocumentId)) {
      return;
    }
    uniqueTeams.set(teamDocumentId, team);
  });

  return Array.from(uniqueTeams.values()).sort((left, right) => (
    String(left?.name || '').localeCompare(String(right?.name || ''), 'fr', { sensitivity: 'base' })
  ));
};

/**
 * @param {object} params
 * @param {any[]} params.availableTeams
 * @param {string[]} [params.coveredTeamDocumentIds]
 * @param {number} params.slotCount
 * @returns {string[]}
 */
export const getInitialTeamSelection = ({
  availableTeams,
  coveredTeamDocumentIds,
  slotCount,
}) => {
  const normalizedSlotCount = Math.max(0, Number(slotCount || 0));
  const teamOptions = getSubscriptionSelectableTeams(availableTeams);
  const availableTeamIds = new Set(teamOptions.map((team) => String(team?.documentId || '').trim()).filter(Boolean));
  const normalizedCoveredTeamIds = Array.isArray(coveredTeamDocumentIds)
    ? coveredTeamDocumentIds
      .map((teamDocumentId) => String(teamDocumentId || '').trim())
      .filter((teamDocumentId) => availableTeamIds.has(teamDocumentId))
    : [];

  if (normalizedCoveredTeamIds.length > 0) {
    return normalizedCoveredTeamIds.slice(0, normalizedSlotCount);
  }

  return teamOptions
    .map((team) => String(team?.documentId || '').trim())
    .filter(Boolean)
    .slice(0, normalizedSlotCount);
};

/**
 * @param {'monthly' | 'yearly' | string | null | undefined} billingPeriod
 * @param {Date} [now]
 * @returns {{ currentPeriodEnd: string; currentPeriodStart: string }}
 */
export const buildSubscriptionBillingWindow = (billingPeriod, now = new Date()) => {
  const startDate = new Date(now);
  const endDate = new Date(now);
  if (String(billingPeriod || '').trim().toLowerCase() === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return {
    currentPeriodEnd: endDate.toISOString(),
    currentPeriodStart: startDate.toISOString(),
  };
};

/**
 * @param {object} params
 * @param {any} params.catalogEntry
 * @param {string | null | undefined} [params.clubDocumentId]
 * @param {string[]} [params.teamDocumentIds]
 * @param {'apple' | 'google' | 'web'} params.provider
 * @param {boolean} [params.trustedValidation]
 * @param {Date} [params.now]
 * @returns {Record<string, any>}
 */
export const buildSubscriptionPurchasePayload = ({
  catalogEntry,
  clubDocumentId,
  now = new Date(),
  provider,
  teamDocumentIds,
  trustedValidation = false,
}) => {
  const planCode = String(catalogEntry?.planCode || '').trim();
  const providerProductId = String(catalogEntry?.providerProductId || '').trim() || planCode;
  const eventSeed = now.getTime();
  const windowPayload = buildSubscriptionBillingWindow(catalogEntry?.billingPeriod, now);

  return {
    ...windowPayload,
    autoRenew: true,
    billingPeriod: String(catalogEntry?.billingPeriod || '').trim().toLowerCase(),
    clubDocumentId: String(clubDocumentId || '').trim() || undefined,
    planCode,
    provider,
    providerEventId: `fc-test-purchase-${planCode}-${eventSeed}`,
    providerProductId,
    providerTransactionId: `fc-test-transaction-${planCode}-${eventSeed}`,
    status: 'active',
    teamDocumentIds: Array.isArray(teamDocumentIds) ? teamDocumentIds : [],
    trustedValidation,
  };
};

/**
 * @param {object} params
 * @param {any} params.catalogEntry
 * @param {string | null | undefined} params.subscriptionDocumentId
 * @param {string | null | undefined} [params.clubDocumentId]
 * @param {string[]} [params.teamDocumentIds]
 * @param {'apple' | 'google' | 'web'} params.provider
 * @param {boolean} [params.trustedValidation]
 * @param {Date} [params.now]
 * @returns {Record<string, any>}
 */
export const buildSubscriptionChangePlanPayload = ({
  catalogEntry,
  clubDocumentId,
  now = new Date(),
  provider,
  subscriptionDocumentId,
  teamDocumentIds,
  trustedValidation = false,
}) => {
  const planCode = String(catalogEntry?.planCode || '').trim();
  const providerProductId = String(catalogEntry?.providerProductId || '').trim() || planCode;
  const eventSeed = now.getTime();
  const windowPayload = buildSubscriptionBillingWindow(catalogEntry?.billingPeriod, now);

  return {
    ...windowPayload,
    autoRenew: true,
    billingPeriod: String(catalogEntry?.billingPeriod || '').trim().toLowerCase(),
    clubDocumentId: String(clubDocumentId || '').trim() || undefined,
    nextPlanCode: planCode,
    nextProviderProductId: providerProductId,
    provider,
    providerEventId: `fc-test-change-${planCode}-${eventSeed}`,
    status: 'active',
    subscriptionDocumentId: String(subscriptionDocumentId || '').trim(),
    teamDocumentIds: Array.isArray(teamDocumentIds) ? teamDocumentIds : [],
    trustedValidation,
  };
};

/**
 * @param {any} error
 * @returns {string}
 */
export const getSubscriptionBillingErrorMessage = (error) => {
  const message = String(
    error?.message
      || error?.error?.message
      || error?.response?.data?.error?.message
      || error?.response?.data?.message
      || '',
  ).trim();

  if (message === 'TEAM_SLOT_DUPLICATE_TEAM') {
    return 'Une même équipe ne peut pas être attribuée deux fois à la même offre Team.';
  }

  if (message === 'TEAM_SLOT_COUNT_EXCEEDED') {
    return 'Cette offre n a pas assez de slots pour couvrir autant d équipes. Ajuste la sélection avant de continuer.';
  }

  if (message === 'CLUB_ALREADY_COVERED') {
    return 'Ce club est déjà couvert par une offre Club active (souscrite par un autre membre). Inutile de payer deux fois : les droits sont partages.';
  }

  if (message === 'TEAM_ALREADY_COVERED') {
    return 'Cette équipe est déjà couverte par une autre offre active. Choisis une équipe non couverte ou libere son slot actuel.';
  }

  if (message === 'clubDocumentId obligatoire pour une offre CLUB.' || message === 'Club introuvable pour entitlement CLUB.') {
    return 'Rattache d abord le bon club avant de prendre une offre Club.';
  }

  if (message === 'Le checkout web public n est pas disponible en production tant qu un provider web n a pas été choisi.') {
    return 'Le changement d offre web public n est pas encore ouvert sur cet environnement.';
  }

  if (message) {
    return message;
  }

  return 'Impossible de mettre à jour ton abonnement pour le moment.';
};
