/**
 * @param {any} value
 * @returns {any[]}
 */
const normalizeDecisionArray = (value) => (
  Array.isArray(value) ? value.filter(Boolean) : []
);

export const SUBSCRIPTION_PERMISSION_DENIED_CODE = 'SUBSCRIPTION_PERMISSION_DENIED';

/**
 * @param {{
 *   entitlementsSummary?: any[];
 *   subscriptionSummary?: any;
 * }=} params
 * @returns {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'}
 */
export const getSubscriptionAccessLevel = ({
  entitlementsSummary,
  subscriptionSummary,
} = {}) => {
  const hasTeamEntitlement = normalizeDecisionArray(entitlementsSummary)
    .some((entry) => entry?.scopeType === 'TEAM');

  if (subscriptionSummary?.hasVerifiedClubPlan === true) {
    return 'CLUB';
  }

  if (subscriptionSummary?.requiresClubVerification === true) {
    return 'CLUB_UNVERIFIED';
  }

  if (subscriptionSummary?.hasTeamPlan === true || hasTeamEntitlement) {
    return 'TEAM';
  }

  return 'FREE';
};

/** @type {Record<string, string>} */
const DEFAULT_REASON_LABELS = {
  AUTH_REQUIRED: 'Connexion requise',
  CLUB_TIER_LIMIT_REACHED: 'Limite d equipes de votre offre Club atteinte',
  CLUB_VERIFICATION_REQUIRED: 'Verification du club requise',
  FREE_INCLUDED: 'Inclus dans le plan gratuit',
  FREE_QUOTA_AVAILABLE: 'Quota gratuit disponible',
  FREE_QUOTA_EXHAUSTED: 'Quota gratuit epuise',
  SUBSCRIPTION_REQUIRED: 'Abonnement requis',
};

/** @type {Record<string, string>} */
// Le serveur derive la cle de paywall de l'action refusee, en majuscules et
// suffixee `_REQUIRED` (ex. `facility.manage` -> `FACILITY_MANAGE_REQUIRED`).
// Toute cle absente de cette table retombe sur le paywall generique.
const DEFAULT_PAYWALL_KEYS = {
  CLUB_ROLES_MANAGE_REQUIRED: 'club-roles-manage-required',
  CLUB_TIER_TEAM_LIMIT: 'club-tier-team-limit',
  CLUB_UPDATE_REQUIRED: 'club-update-required',
  CLUB_VERIFICATION_REQUIRED: 'club-verification-required',
  COMPOSITION_MANAGE_REQUIRED: 'composition-required',
  DUES_CAMPAIGN_CREATE_REQUIRED: 'dues-limit',
  DUES_LIMIT: 'dues-limit',
  EVENT_LIMIT: 'event-limit',
  FACILITY_MANAGE_REQUIRED: 'facility-manage-required',
  MATCH_LIMIT: 'match-limit',
  PROFILE_CONTACT_LIMIT: 'profile-contact-limit',
  RECRUITMENT_AD_LIMIT: 'recruitment-ad-limit',
  SPONSOR_MANAGE_REQUIRED: 'sponsor-manage-required',
  TEAM_LIMIT: 'team-limit',
  TEAM_OFFER_UNLOCK: 'team-offer-unlock',
};

/** @type {string[]} */
const CLUB_PAYWALL_BENEFITS = [
  'Toutes les equipes du club couvertes',
  'Droits club et gestion centralisee',
  'Cotisations et recrutement illimites',
];

/** @type {Record<string, string[]>} */
const PAYWALL_BENEFITS_BY_KEY = {
  'club-tier-team-limit': CLUB_PAYWALL_BENEFITS,
  'club-verification-required': CLUB_PAYWALL_BENEFITS,
  'composition-required': [
    'Composition et convocations en 2 taps',
    'Evenements et matchs illimites',
    'Toute l equipe en profite',
  ],
  'dues-limit': [
    'Campagnes de cotisation illimitees',
    'Suivi des paiements simplifie',
    'Relances des membres en un clic',
  ],
  'event-limit': [
    'Evenements et matchs illimites',
    'Composition et convocations',
    'Toute l equipe en profite',
  ],
  'match-limit': [
    'Matchs et evenements illimites',
    'Composition et convocations',
    'Suivi des presences simplifie',
  ],
  'recruitment-ad-limit': [
    'Annonces de recrutement illimitees',
    'Visibilite aupres des joueurs',
    'Contacts sans limite',
  ],
  'team-limit': [
    'Ajoute autant d equipes que besoin',
    'Evenements et matchs illimites',
    'Gestion complete de chaque equipe',
  ],
};

/** @type {Record<string, string>} */
const RECOMMENDED_PLAN_CODES = {
  CLUB: 'fc_club_tier_1_yearly',
  TEAM: 'fc_team_1_yearly',
};

/** @type {Record<string, string>} */
const REQUIRED_PLAN_LABELS = {
  CLUB: 'Club',
  TEAM: 'Team',
};

/** @type {Record<string, string>} */
const PLAN_PERIOD_LABELS = {
  monthly: 'mois',
  yearly: 'an',
};

const QUOTA_ORDER = [
  'EVENT_PUBLISH',
  'MATCH_PUBLISH',
  'RECRUITMENT_AD_PUBLISH',
  'FREE_TEAM',
];

/** @type {Record<string, string>} */
const QUOTA_LABELS = {
  EVENT_PUBLISH: 'Evenements',
  FREE_TEAM: 'Equipes',
  MATCH_PUBLISH: 'Matchs',
  RECRUITMENT_AD_PUBLISH: 'Recrutement',
};

// Quota retire de la matrice (decision #6 du 2026-07-09 : chat/contact 100 % libre).
// Le serveur ne le renvoie plus, mais d'anciennes lignes DB ne doivent jamais s'afficher.
const RETIRED_QUOTA_TYPES = new Set(['PROFILE_CONTACT']);

/** @type {Record<string, { description: string; label: string }>} */
const SUBSCRIPTION_STATUS_META = {
  CLUB: {
    description: 'Les droits Club sont actifs pour votre club verifie.',
    label: 'Club',
  },
  CLUB_UNVERIFIED: {
    description: 'Votre offre Club est active, mais les droits club restent bloques tant que la verification n est pas terminee.',
    label: 'Club a verifier',
  },
  FREE: {
    description: 'Vous utilisez actuellement les quotas gratuits FoundClub.',
    label: 'Gratuit',
  },
  TEAM: {
    description: 'Les droits Team sont ouverts sur les equipes couvertes.',
    label: 'Team',
  },
};

/**
 * @param {any} decision
 * @returns {{
 *   allowed: boolean;
 *   message: string;
 *   paywall: string;
 *   paywallKey: string;
 *   reason: string;
 *   remainingFreeUses: number | null;
 *   requiredPlan: string[];
 * }}
 */
export const mapSubscriptionDecisionToPaywall = (decision) => {
  const safeDecision = decision && typeof decision === 'object' ? decision : {};
  const paywall = String(safeDecision?.paywall || '').trim();
  const reason = String(safeDecision?.reason || '').trim();

  return {
    allowed: safeDecision?.allowed === true,
    message: DEFAULT_REASON_LABELS[reason] || 'Acces refuse',
    paywall,
    paywallKey: DEFAULT_PAYWALL_KEYS[paywall] || 'subscription-required',
    reason,
    remainingFreeUses: Number.isFinite(Number(safeDecision?.remainingFreeUses))
      ? Number(safeDecision.remainingFreeUses)
      : null,
    requiredPlan: normalizeDecisionArray(safeDecision?.requiredPlan),
  };
};

/**
 * @param {any} value
 * @returns {boolean}
 */
const looksLikeSubscriptionDecision = (value) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (typeof value?.paywall === 'string' && value.paywall.trim()) {
    return true;
  }

  if (Array.isArray(value?.requiredPlan) && value.requiredPlan.length > 0) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'remainingFreeUses')) {
    return true;
  }

  const reason = String(value?.reason || '').trim();
  return Boolean(DEFAULT_REASON_LABELS[reason] || DEFAULT_PAYWALL_KEYS[reason]);
};

/**
 * @param {string[] | undefined | null} requiredPlan
 * @returns {string[]}
 */
export const getSubscriptionRequiredPlanLabels = (requiredPlan) => Array.from(new Set(
  normalizeDecisionArray(requiredPlan)
    .map((planCode) => String(planCode || '').trim().toUpperCase())
    .filter(Boolean)
    .map((planCode) => REQUIRED_PLAN_LABELS[planCode] || planCode),
));

/**
 * @param {string[] | undefined | null} requiredPlan
 * @returns {string}
 */
export const formatSubscriptionRequiredPlanText = (requiredPlan) => {
  const labels = getSubscriptionRequiredPlanLabels(requiredPlan);
  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} ou ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')} ou ${labels[labels.length - 1]}`;
};

/**
 * @param {any} error
 * @returns {any | null}
 */
export const extractSubscriptionDecisionFromError = (error) => {
  const decisionCandidates = [
    error?.details?.decision,
    error?.decision,
    error?.error?.details?.decision,
    error?.response?.data?.error?.details?.decision,
    error?.response?.data?.details?.decision,
    error?.response?.data?.decision,
  ];

  const extractedDecision = decisionCandidates.find((candidate) => looksLikeSubscriptionDecision(candidate));
  if (extractedDecision) {
    return extractedDecision;
  }

  if (
    String(error?.details?.code || error?.code || '').trim() === SUBSCRIPTION_PERMISSION_DENIED_CODE
    && looksLikeSubscriptionDecision(error?.details?.decision || error?.decision)
  ) {
    return error?.details?.decision || error?.decision;
  }

  return looksLikeSubscriptionDecision(error) ? error : null;
};

/**
 * @param {any} decision
 * @returns {{ ctaLabel: string; description: string; title: string }}
 */
export const getSubscriptionPaywallContent = (decision) => {
  const paywall = mapSubscriptionDecisionToPaywall(decision);
  const requiredPlanText = formatSubscriptionRequiredPlanText(paywall.requiredPlan);
  const requiredPlanSuffix = requiredPlanText
    ? ` Offre conseillee: ${requiredPlanText}.`
    : '';
  const withRequiredPlan = (sentence) => `${sentence}${requiredPlanSuffix}`.trim();

  switch (paywall.paywallKey) {
    case 'club-roles-manage-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La gestion des roles et des droits du club est reservee a l offre Club.',
        ),
        title: 'Roles club reserves',
      };
    case 'club-tier-team-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: 'Votre offre Club a atteint son nombre maximum d equipes. Passez au palier superieur pour ajouter de nouvelles equipes.',
        title: 'Limite d equipes atteinte',
      };
    case 'club-update-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La modification de la fiche du club est reservee a l offre Club.',
        ),
        title: 'Fiche club reservee',
      };
    case 'club-verification-required':
      return {
        ctaLabel: 'Voir mon club',
        description: 'Votre offre Club est active, mais les droits club restent bloques tant que la verification du dirigeant n est pas terminee.',
        title: 'Verification du club requise',
      };
    case 'composition-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `La composition d equipe est reservee a l offre Equipe.${requiredPlanSuffix}`.trim(),
        title: 'Composition reservee',
      };
    case 'dues-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `La creation de campagnes de cotisation demande une offre active.${requiredPlanSuffix}`.trim(),
        title: 'Cotisations reservees',
      };
    case 'event-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Tu as atteint la limite gratuite de publication d evenements.${requiredPlanSuffix}`.trim(),
        title: 'Publication d evenement limitee',
      };
    case 'facility-manage-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La gestion des installations du club est reservee a l offre Club.',
        ),
        title: 'Installations reservees',
      };
    case 'match-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Tu as atteint la limite gratuite de publication de match.${requiredPlanSuffix}`.trim(),
        title: 'Publication de match limitee',
      };
    case 'profile-contact-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Tu as atteint la limite gratuite de nouveaux contacts.${requiredPlanSuffix}`.trim(),
        title: 'Nouveau contact limite',
      };
    case 'recruitment-ad-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Cette publication de recrutement demande une offre active.${requiredPlanSuffix}`.trim(),
        title: 'Publication recrutement limitee',
      };
    case 'sponsor-manage-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La gestion des sponsors du club est reservee a l offre Club.',
        ),
        title: 'Sponsors reserves',
      };
    case 'team-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `La creation d equipe demande une offre active.${requiredPlanSuffix}`.trim(),
        title: 'Creation d equipe limitee',
      };
    default:
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Cette action demande une offre FoundClub active.${requiredPlanSuffix}`.trim(),
        title: 'Abonnement FoundClub requis',
      };
  }
};

/**
 * Contenu de la sheet de quota v2 (handoff, decision 1) : rappelle CE QUE
 * l'utilisateur essayait de faire, sans paragraphe. Retourne null pour les
 * paywalls non-quota (verification club, palier club, cotisations…) qui
 * gardent la presentation legacy.
 * @type {Record<string, {
 *   kicker: string;
 *   preselectedSlotCount: number;
 *   successCtaLabel: string;
 *   benefits: string[];
 *   title: string;
 * }>}
 */
const QUOTA_SHEET_CONTENT_BY_KEY = {
  // Paywall plan-only (pas un quota) : la compo/convocation est reservee aux offres.
  'composition-required': {
    benefits: [
      'Composition et convocations en 2 taps',
      'Événements et matchs illimités',
      "Toute l'équipe en profite",
    ],
    kicker: 'Offre Équipe',
    preselectedSlotCount: 1,
    successCtaLabel: 'Préparer ma compo',
    title: "La composition d'équipe est réservée à l'offre Équipe",
  },
  'event-limit': {
    benefits: [
      'Événements et matchs illimités',
      'Présences en temps réel, relances auto',
      'Convocations envoyées en 2 taps',
    ],
    kicker: 'Offre Équipe',
    preselectedSlotCount: 1,
    successCtaLabel: 'Publier mon événement',
    title: 'Tu veux publier un 2ᵉ événement ?',
  },
  'match-limit': {
    benefits: [
      'Matchs et événements illimités',
      'Présences en temps réel, relances auto',
      'Convocations envoyées en 2 taps',
    ],
    kicker: 'Offre Équipe',
    preselectedSlotCount: 1,
    successCtaLabel: 'Publier mon match',
    title: 'Tu veux publier un 2ᵉ match ?',
  },
  'recruitment-ad-limit': {
    benefits: [
      'Annonces de recrutement illimitées',
      'Visible par tous les joueurs de ta zone',
      'Candidatures directement dans tes messages',
    ],
    kicker: 'Offre Équipe',
    preselectedSlotCount: 1,
    successCtaLabel: 'Publier mon annonce',
    title: 'Tu veux publier une 2ᵉ annonce ?',
  },
  'team-limit': {
    benefits: [
      'Toutes tes équipes, événements illimités',
      'Convoque toute ton équipe en 2 taps',
      'Encaisse la cotisation de chaque équipe',
    ],
    kicker: 'Offre Équipe',
    preselectedSlotCount: 2,
    successCtaLabel: 'Créer ma 2ᵉ équipe',
    title: 'Tu veux créer une 2ᵉ équipe ?',
  },
  // Deblocage direct de l'offre Équipe depuis la sheet Actions d'équipe (decision 7).
  'team-offer-unlock': {
    benefits: [
      'Composition type et convocations en 2 taps',
      'Événements et matchs illimités',
      "Cotisation de l'équipe encaissée dans l'app",
    ],
    kicker: 'Offre Équipe',
    preselectedSlotCount: 1,
    successCtaLabel: "C'est parti !",
    title: "Débloque tes outils d'équipe",
  },
};

/**
 * @param {any} decision
 * @returns {{
 *   kicker: string;
 *   preselectedSlotCount: number;
 *   successCtaLabel: string;
 *   benefits: string[];
 *   title: string;
 * } | null}
 */
export const getSubscriptionQuotaSheetContent = (decision) => {
  const paywall = mapSubscriptionDecisionToPaywall(decision);
  return QUOTA_SHEET_CONTENT_BY_KEY[paywall.paywallKey] || null;
};

/**
 * @param {any} decision
 * @returns {string[]}
 */
export const getSubscriptionPaywallBenefits = (decision) => {
  const paywall = mapSubscriptionDecisionToPaywall(decision);
  const benefits = PAYWALL_BENEFITS_BY_KEY[paywall.paywallKey] || CLUB_PAYWALL_BENEFITS;
  return benefits.slice(0, 3);
};

/**
 * @param {any} decision
 * @returns {string}
 */
export const getSubscriptionRecommendedPlanCode = (decision) => {
  const paywall = mapSubscriptionDecisionToPaywall(decision);
  const requiredPlans = paywall.requiredPlan
    .map((planCode) => String(planCode || '').trim().toUpperCase())
    .filter(Boolean);

  if (requiredPlans.includes('CLUB') && !requiredPlans.includes('TEAM')) {
    return RECOMMENDED_PLAN_CODES.CLUB;
  }

  return RECOMMENDED_PLAN_CODES.TEAM;
};

/**
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'} [subscriptionAccessLevel]
 * @returns {{ description: string; label: string }}
 */
export const getSubscriptionStatusMeta = (subscriptionAccessLevel) => (
  SUBSCRIPTION_STATUS_META[String(subscriptionAccessLevel || 'FREE')] || SUBSCRIPTION_STATUS_META.FREE
);

/**
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
export const formatSubscriptionPlanLabel = (planCode) => {
  const normalizedPlanCode = String(planCode || '').trim().toLowerCase();
  if (!normalizedPlanCode) {
    return 'Aucun plan actif';
  }

  const teamMatch = normalizedPlanCode.match(/^fc_team_(\d+)_(monthly|yearly)$/);
  if (teamMatch) {
    const slotCount = Number(teamMatch[1] || 0);
    const period = PLAN_PERIOD_LABELS[teamMatch[2]] || teamMatch[2];
    return `Team ${slotCount} equipe${slotCount > 1 ? 's' : ''} / ${period}`;
  }

  const clubMatch = normalizedPlanCode.match(/^fc_club(?:_tier_(\d+))?_(monthly|yearly)$/);
  if (clubMatch) {
    const tier = Number(clubMatch[1] || 0);
    const period = PLAN_PERIOD_LABELS[clubMatch[2]] || clubMatch[2];
    return tier > 0 ? `Club tier ${tier} / ${period}` : `Club / ${period}`;
  }

  return normalizedPlanCode
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

/**
 * @param {any} subscriptionSummary
 * @returns {string[]}
 */
export const getSubscriptionPlanLabels = (subscriptionSummary) => normalizeDecisionArray(
  subscriptionSummary?.activePlanCodes,
).map((planCode) => formatSubscriptionPlanLabel(planCode));

/**
 * @param {any} subscriptionSummary
 * @returns {{ assigned: number; available: number; coveredTeamDocumentIds: string[]; total: number }}
 */
export const getSubscriptionTeamSlotSummary = (subscriptionSummary) => {
  const rawSummary = subscriptionSummary?.teamSlotSummary && typeof subscriptionSummary.teamSlotSummary === 'object'
    ? subscriptionSummary.teamSlotSummary
    : {};
  const coveredTeamDocumentIds = Array.from(new Set(
    normalizeDecisionArray(rawSummary?.coveredTeamDocumentIds)
      .map((teamDocumentId) => String(teamDocumentId || '').trim())
      .filter(Boolean),
  ));
  const total = Number(rawSummary?.total || 0);
  const assigned = Number(rawSummary?.assigned || 0);
  const available = Number(rawSummary?.available ?? Math.max(0, total - assigned));

  return {
    assigned: Number.isFinite(assigned) ? assigned : 0,
    available: Number.isFinite(available) ? Math.max(0, available) : 0,
    coveredTeamDocumentIds,
    total: Number.isFinite(total) ? Math.max(0, total) : 0,
  };
};

/**
 * @param {any[]} entitlementsSummary
 * @param {any} [subscriptionSummary]
 * @returns {number}
 */
export const getCoveredTeamCount = (entitlementsSummary, subscriptionSummary) => (
  new Set([
    ...getSubscriptionTeamSlotSummary(subscriptionSummary).coveredTeamDocumentIds,
    ...normalizeDecisionArray(entitlementsSummary)
      .filter((entry) => entry?.scopeType === 'TEAM')
      .map((entry) => String(entry?.scopeTeamDocumentId || '').trim())
      .filter(Boolean),
  ])
).size;

/**
 * @param {any[]} freeUsageSummary
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'} [subscriptionAccessLevel]
 * @returns {Array<{ label: string; quotaType: string; remaining: number; total: number; used: number }>}
 */
export const getSubscriptionQuotaItems = (freeUsageSummary, subscriptionAccessLevel = 'FREE') => {
  if (!['CLUB_UNVERIFIED', 'FREE'].includes(subscriptionAccessLevel)) {
    return [];
  }

  const aggregatedItems = normalizeDecisionArray(freeUsageSummary)
    .reduce((itemsByType, entry) => {
      const quotaType = String(entry?.quotaType || '').trim();
      const total = Number(entry?.limit || 0);
      const used = Number(entry?.used || 0);
      const remaining = Number(entry?.remaining || Math.max(0, total - used));
      if (!quotaType || total <= 0 || RETIRED_QUOTA_TYPES.has(quotaType)) {
        return itemsByType;
      }

      const currentItem = itemsByType.get(quotaType) || {
        label: QUOTA_LABELS[quotaType] || quotaType,
        quotaType,
        remaining: 0,
        total: 0,
        used: 0,
      };

      currentItem.total += Number.isFinite(total) ? total : 0;
      currentItem.used += Number.isFinite(used) ? used : 0;
      currentItem.remaining += Number.isFinite(remaining) ? remaining : 0;
      itemsByType.set(quotaType, currentItem);
      return itemsByType;
    }, new Map());

  return Array.from(aggregatedItems.values())
    .sort((/** @type {{ label: string; quotaType: string; remaining: number; total: number; used: number }} */ left, /** @type {{ label: string; quotaType: string; remaining: number; total: number; used: number }} */ right) => {
      const leftOrder = QUOTA_ORDER.indexOf(left.quotaType);
      const rightOrder = QUOTA_ORDER.indexOf(right.quotaType);
      const safeLeftOrder = leftOrder === -1 ? QUOTA_ORDER.length : leftOrder;
      const safeRightOrder = rightOrder === -1 ? QUOTA_ORDER.length : rightOrder;
      if (safeLeftOrder !== safeRightOrder) {
        return safeLeftOrder - safeRightOrder;
      }

      return left.label.localeCompare(right.label, 'fr');
    });
};

/**
 * @param {any[]} freeUsageSummary
 * @param {string} quotaType
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'} [subscriptionAccessLevel]
 * @returns {{ label: string; quotaType: string; remaining: number; total: number; used: number } | null}
 */
export const getSubscriptionQuotaItem = (
  freeUsageSummary,
  quotaType,
  subscriptionAccessLevel = 'FREE',
) => {
  const normalizedQuotaType = String(quotaType || '').trim();
  if (!normalizedQuotaType) {
    return null;
  }

  return getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel)
    .find((entry) => entry?.quotaType === normalizedQuotaType) || null;
};
