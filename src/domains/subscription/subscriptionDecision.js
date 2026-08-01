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
  CLUB_TIER_LIMIT_REACHED: 'Limite d équipes de ton offre Club atteinte',
  CLUB_VERIFICATION_REQUIRED: 'Vérification du club requise',
  FREE_INCLUDED: 'Inclus dans le plan gratuit',
  FREE_QUOTA_AVAILABLE: 'Quota gratuit disponible',
  FREE_QUOTA_EXHAUSTED: 'Quota gratuit épuisé',
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
  'Toutes les équipes du club couvertes',
  'Droits club et gestion centralisée',
  'Cotisations et recrutement illimités',
];

/** @type {Record<string, string[]>} */
const PAYWALL_BENEFITS_BY_KEY = {
  'club-tier-team-limit': CLUB_PAYWALL_BENEFITS,
  'club-verification-required': CLUB_PAYWALL_BENEFITS,
  'composition-required': [
    'Composition et convocations en 2 taps',
    'Événements et matchs illimités',
    'Toute l équipe en profite',
  ],
  'dues-limit': [
    'Campagnes de cotisation illimitées',
    'Suivi des paiements simplifie',
    'Relances des membres en un clic',
  ],
  'event-limit': [
    'Événements et matchs illimités',
    'Composition et convocations',
    'Toute l équipe en profite',
  ],
  'match-limit': [
    'Matchs et événements illimités',
    'Composition et convocations',
    'Suivi des présences simplifie',
  ],
  'recruitment-ad-limit': [
    'Annonces de recrutement illimitées',
    'Visibilité aupres des joueurs',
    'Contacts sans limite',
  ],
  'team-limit': [
    'Ajoute autant d équipes que besoin',
    'Événements et matchs illimités',
    'Gestion complète de chaque équipe',
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
    description: 'Les droits Club sont actifs pour ton club vérifie.',
    label: 'Club',
  },
  CLUB_UNVERIFIED: {
    description: 'Tes droits Club sont actifs. Il reste à faire vérifier ton club — sans effet sur ton offre.',
    label: 'Club à vérifier',
  },
  FREE: {
    description: 'Tu utilises actuellement les quotas gratuits FoundClub.',
    label: 'Gratuit',
  },
  TEAM: {
    description: 'Les droits Team sont ouverts sur les équipes couvertes.',
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
    message: DEFAULT_REASON_LABELS[reason] || 'Accès refuse',
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
    ? ` Offre conseillée: ${requiredPlanText}.`
    : '';
  const withRequiredPlan = (sentence) => `${sentence}${requiredPlanSuffix}`.trim();

  switch (paywall.paywallKey) {
    case 'club-roles-manage-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La gestion des rôles et des droits du club est réservée a l offre Club.',
        ),
        title: 'Rôles club reserves',
      };
    case 'club-tier-team-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: 'Ton offre Club a atteint son nombre maximum d équipes. Passe au palier supérieur pour ajouter de nouvelles équipes.',
        title: 'Limite d équipes atteinte',
      };
    case 'club-update-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La modification de la fiche du club est réservée a l offre Club.',
        ),
        title: 'Fiche club réservée',
      };
    case 'club-verification-required':
      return {
        ctaLabel: 'Voir mon club',
        description: 'Ton offre Club est activé, mais les droits club restent bloques tant que la vérification du dirigeant n est pas terminée.',
        title: 'Vérification du club requise',
      };
    case 'composition-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `La composition d équipe est réservée a l offre Équipe.${requiredPlanSuffix}`.trim(),
        title: 'Composition réservée',
      };
    case 'dues-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `La création de campagnes de cotisation demande une offre active.${requiredPlanSuffix}`.trim(),
        title: 'Cotisations réservées',
      };
    case 'event-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Tu as atteint la limite gratuite de publication d événements.${requiredPlanSuffix}`.trim(),
        title: 'Publication d événement limitée',
      };
    case 'facility-manage-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La gestion des installations du club est réservée a l offre Club.',
        ),
        title: 'Installations réservées',
      };
    case 'match-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `Tu as atteint la limite gratuite de publication de match.${requiredPlanSuffix}`.trim(),
        title: 'Publication de match limitée',
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
        title: 'Publication recrutement limitée',
      };
    case 'sponsor-manage-required':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: withRequiredPlan(
          'La gestion des sponsors du club est réservée a l offre Club.',
        ),
        title: 'Sponsors reserves',
      };
    case 'team-limit':
      return {
        ctaLabel: 'Voir mon abonnement',
        description: `La création d équipe demande une offre active.${requiredPlanSuffix}`.trim(),
        title: 'Création d équipe limitée',
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

// Murs qui exigent l'offre Club et dont le blocage se leve par un PREMIER achat
// Club (docs/STRATEGIE_PAYWALL_2026_08_01.md §1.4).
// `club-tier-team-limit` en est volontairement ABSENT : son utilisateur a deja une
// offre Club, et un second achat sur un club deja couvert leve CLUB_ALREADY_COVERED
// (admin/src/api/subscription/services/subscription-billing.ts:617). Sa montee de
// palier passe par l'ecran d'abonnement, qui sait deja faire un changement de plan.
const CLUB_PURCHASE_PAYWALL_KEYS = new Set([
  // `club.roles.manage` : la cle est calculee par le serveur mais jetee par ses 9
  // branches muettes (§1.3a) — elle redeviendra atteignable avec ce chantier-la.
  'club-roles-manage-required',
  'dues-limit',
  'facility-manage-required',
  'sponsor-manage-required',
]);

/**
 * Contenu de la feuille de vente Club : meme forme que la feuille de quota, pour
 * que les deux partagent la meme presentation (paliers + prix + achat direct).
 * Retourne null pour tout ce qui n'est pas un premier achat Club.
 * @param {any} decision
 * @returns {{
 *   benefits: string[];
 *   description: string;
 *   kicker: string;
 *   successCtaLabel: string;
 *   title: string;
 * } | null}
 */
export const getSubscriptionClubSheetContent = (decision) => {
  const paywall = mapSubscriptionDecisionToPaywall(decision);
  if (!CLUB_PURCHASE_PAYWALL_KEYS.has(paywall.paywallKey)) {
    return null;
  }

  // Sans `requiredPlan`, la description perd son suffixe « Offre conseillée: Club. » :
  // la feuille affiche deja les paliers Club, le repeter est du bruit sur un ecran
  // de vente. Le titre, lui, n'en depend pas.
  const content = getSubscriptionPaywallContent({ ...decision, requiredPlan: [] });
  return {
    benefits: getSubscriptionPaywallBenefits(decision),
    description: content.description,
    kicker: 'Offre Club',
    successCtaLabel: 'Reprendre',
    title: content.title,
  };
};

// L11 — ce que l'offre qui vient d'etre achetee debloque REELLEMENT, miroir de la
// matrice serveur (admin/src/api/subscription/services/subscription-permission.ts:43-80) :
// FREE_QUOTAS leve les quotas event.publish / match.publish / recruitment.ad.publish /
// team.create avec TEAM ou CLUB ; ACTION_REQUIRED_PLANS reserve composition.manage a
// TEAM ou CLUB, et club.roles.manage / dues.campaign.create / facility.manage /
// sponsor.manage a CLUB seul. `club.broadcast` (CLUB aussi) est volontairement
// absent : aucun point d'appel dans l'app, la porte n'existe pas
// (docs/STRATEGIE_PAYWALL_2026_08_01.md §1.2).
/** @type {string[]} */
const TEAM_UNLOCKED_CAPABILITIES = ['events', 'recruitment', 'composition', 'teams'];
/** @type {string[]} */
const CLUB_UNLOCKED_CAPABILITIES = [
  'clubTeams',
  'events',
  'recruitment',
  'composition',
  'facilities',
  'sponsors',
  'dues',
  'clubRoles',
];

/**
 * Liste des capacites ouvertes par l'achat qui vient d'aboutir. La portee vient
 * de l'ACHAT (l'appelant sait ce qu'il a vendu), jamais du cache d'abonnement :
 * juste apres l'achat, le webhook du store n'a pas encore converge et le cache
 * decrit l'ANCIEN etat (L08). Portee inconnue (achat Stripe web sans detail
 * d'offre) : on rend le socle commun aux deux offres — en dire moins est
 * honnete, inventer ne l'est pas.
 * @param {string | null | undefined} offerScope 'TEAM' | 'CLUB' | absent
 * @returns {string[]} cles de `subscriptionSuccess.unlocks.*` dans fr.js
 */
export const getSubscriptionUnlockedCapabilities = (offerScope) => {
  const normalizedScope = String(offerScope || '').trim().toUpperCase();
  return normalizedScope === 'CLUB'
    ? [...CLUB_UNLOCKED_CAPABILITIES]
    : [...TEAM_UNLOCKED_CAPABILITIES];
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
 * Les droits Club sont-ils ouverts ? La verification du dirigeant est un SIGNAL
 * D'AFFICHAGE, pas une porte : depuis la decision produit du 2026-07-17, un
 * entitlement CLUB actif ouvre l'acces meme sans club verifie
 * (admin/src/api/subscription/services/subscription-permission.ts:751-756 —
 * motif : aucun club n'etant verifie en production, la porte refusait le
 * premier client payant). Traiter CLUB_UNVERIFIED comme « pas de droits »
 * revient a revendre l'offre Club a quelqu'un qui l'a deja payee.
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'} [subscriptionAccessLevel]
 * @returns {boolean}
 */
export const hasActiveClubOffer = (subscriptionAccessLevel) => (
  subscriptionAccessLevel === 'CLUB' || subscriptionAccessLevel === 'CLUB_UNVERIFIED'
);

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

// Cle de paywall « moderne » (feuille de vente AVEC bouton d'achat) qui repond a
// chaque quota gratuit. Les 4 se debloquent avec l'offre Équipe, qui est la
// seule achetable dans la sheet aujourd'hui — d'ou l'absence de quota Club ici.
/** @type {Record<string, string>} */
const ENTRY_POINT_PAYWALL_BY_QUOTA_TYPE = {
  EVENT_PUBLISH: 'EVENT_LIMIT',
  FREE_TEAM: 'TEAM_LIMIT',
  MATCH_PUBLISH: 'MATCH_LIMIT',
  RECRUITMENT_AD_PUBLISH: 'RECRUITMENT_AD_LIMIT',
};

// Ce que le point d'entree dit une fois grise. Griser en silence est interdit
// (STRATEGIE_PAYWALL_2026_08_01 §2.3) : sans phrase, l'utilisateur croit a un bug.
/** @type {Record<string, string>} */
const ENTRY_POINT_EXHAUSTED_HINTS = {
  EVENT_PUBLISH: "Ton événement gratuit est déjà en ligne — débloque l'offre Équipe",
  FREE_TEAM: "Ta création gratuite est utilisée — débloque l'offre Équipe",
  MATCH_PUBLISH: "Ton match gratuit est déjà en ligne — débloque l'offre Équipe",
  RECRUITMENT_AD_PUBLISH: "Ton annonce gratuite est déjà en ligne — débloque l'offre Équipe",
};

// Seuls ces roles peuvent acheter, et ce sont les seuls pour qui le serveur
// calcule les compteurs (admin/src/api/app-bootstrap/services/app-bootstrap.ts:111,
// arbitrage Adel Q4 du 2026-08-01). Pour les autres, griser serait un mensonge :
// l'app n'a aucun compteur a lire, et leur vendre un abonnement est exclu.
const SUBSCRIPTION_CAPABLE_ROLE_KEYS = new Set(['coach', 'president', 'superAdmin']);

/**
 * Verrou d'un POINT D'ENTREE payant (STRATEGIE_PAYWALL_2026_08_01 §2.3).
 *
 * Repond a une seule question, AVANT que l'utilisateur ne s'engage : l'app
 * sait-elle DEJA que l'action est bloquee par le quota gratuit ? Si oui, le
 * point d'entree se grise, porte son etiquette, et l'appui ouvre la feuille de
 * vente — au lieu de laisser remplir un tunnel entier pour refuser a la fin.
 *
 * Rend `null` des que griser serait un mensonge : profil qui ne peut pas
 * acheter, abonne, quota encore disponible, ou quota inconnu. La decision
 * rendue vise les 4 cles a presentation moderne, donc avec bouton d'achat.
 * @param {object} input
 * @param {any[]} input.freeUsageSummary - Compteurs gratuits de `GET /app/bootstrap`.
 * @param {string} input.quotaType - Une cle de `ENTRY_POINT_PAYWALL_BY_QUOTA_TYPE`.
 * @param {string} [input.roleKey] - Cle de role rendue par `getUserRoleKey`.
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'} [input.subscriptionAccessLevel]
 * @returns {{ badgeLabel: string; decision: any; hint: string; scope: 'team' } | null}
 */
export const getSubscriptionEntryPointLock = ({
  freeUsageSummary,
  quotaType,
  roleKey,
  subscriptionAccessLevel = 'FREE',
}) => {
  const normalizedQuotaType = String(quotaType || '').trim();
  const paywallKey = ENTRY_POINT_PAYWALL_BY_QUOTA_TYPE[normalizedQuotaType];
  if (!paywallKey || !SUBSCRIPTION_CAPABLE_ROLE_KEYS.has(String(roleKey || '').trim())) {
    return null;
  }

  const quotaItem = getSubscriptionQuotaItem(
    freeUsageSummary,
    normalizedQuotaType,
    subscriptionAccessLevel,
  );
  if (!quotaItem || quotaItem.remaining > 0) {
    return null;
  }

  return {
    badgeLabel: 'Offre Équipe',
    decision: {
      allowed: false,
      paywall: paywallKey,
      reason: 'SUBSCRIPTION_REQUIRED',
      requiredPlan: ['TEAM'],
    },
    hint: ENTRY_POINT_EXHAUSTED_HINTS[normalizedQuotaType],
    scope: /** @type {'team'} */ ('team'),
  };
};
