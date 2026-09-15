import i18next from 'i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

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
  get AUTH_REQUIRED() {
    return i18next.t('subscriptionDecision.reasons.authRequired', 'Connexion requise');
  },
  get CLUB_TIER_LIMIT_REACHED() {
    return i18next.t(
      'subscriptionDecision.reasons.clubTierLimitReached',
      'Limite d équipes de ton offre Club atteinte',
    );
  },
  // T09 — « offre » partout : c'est le mot des trois ecrans du parcours
  // (« Changer d'offre », « Comparer les offres », « Ton offre actuelle »).
  get FREE_INCLUDED() {
    return i18next.t('subscriptionDecision.reasons.freeIncluded', 'Inclus dans l offre gratuite');
  },
  get FREE_QUOTA_AVAILABLE() {
    return i18next.t('subscriptionDecision.reasons.freeQuotaAvailable', 'Quota gratuit disponible');
  },
  get FREE_QUOTA_EXHAUSTED() {
    return i18next.t('subscriptionDecision.reasons.freeQuotaExhausted', 'Quota gratuit épuisé');
  },
  get SUBSCRIPTION_REQUIRED() {
    return i18next.t('subscriptionDecision.reasons.subscriptionRequired', 'Abonnement requis');
  },
};

/** @type {Record<string, string>} */
// Le serveur derive la cle de paywall de l'action refusee, en majuscules et
// suffixee `_REQUIRED` (ex. `facility.manage` -> `FACILITY_MANAGE_REQUIRED`).
// Toute cle absente de cette table retombe sur le paywall generique.
const DEFAULT_PAYWALL_KEYS = {
  // S12-B/D6 — sans cette ligne, le refus de quota au licencie retombait sur le
  // gabarit generique (« Cette action demande une offre FoundClub active »), qui
  // ne dit NI que le club est plein, NI combien de places il a. Les deux nombres
  // sont pourtant dans la decision.
  CLUB_LICENSEE_LIMIT: 'club-licensee-limit',
  CLUB_ROLES_MANAGE_REQUIRED: 'club-roles-manage-required',
  CLUB_TIER_TEAM_LIMIT: 'club-tier-team-limit',
  COMPOSITION_MANAGE_REQUIRED: 'composition-required',
  DUES_CAMPAIGN_CREATE_REQUIRED: 'dues-limit',
  EVENT_LIMIT: 'event-limit',
  FACILITY_MANAGE_REQUIRED: 'facility-manage-required',
  MATCH_LIMIT: 'match-limit',
  RECRUITMENT_AD_LIMIT: 'recruitment-ad-limit',
  SPONSOR_MANAGE_REQUIRED: 'sponsor-manage-required',
  TEAM_LIMIT: 'team-limit',
  TEAM_OFFER_UNLOCK: 'team-offer-unlock',
};

// I18N-1 : lus a l'usage (un tableau evalue au chargement ne suivrait pas la langue).
/**
 * Les benefices de l'offre Club, dans la langue de l'app.
 * @returns {string[]} Les trois benefices.
 */
const clubPaywallBenefits = () => [
  i18next.t(
    'subscriptionDecision.benefits.allClubTeamsCovered',
    'Toutes les équipes du club couvertes',
  ),
  i18next.t(
    'subscriptionDecision.benefits.clubRightsCentralised',
    'Droits club et gestion centralisée',
  ),
  i18next.t(
    'subscriptionDecision.benefits.unlimitedFeesRecruitment',
    'Cotisations et recrutement illimités',
  ),
];

/** @type {Record<string, string[]>} */
const PAYWALL_BENEFITS_BY_KEY = {
  // Ce club PAIE deja : ses benefices ne sont pas un argumentaire de vente, ce
  // sont les consequences du plafond — dites dans l'ordre ou elles inquietent.
  get 'club-licensee-limit'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.existingMembersKeepAll',
        'Les membres deja inscrits gardent tout',
      ),
      i18next.t(
        'subscriptionDecision.benefits.onlyNewMembershipsPaused',
        'Seules les NOUVELLES adhesions sont en pause',
      ),
      i18next.t(
        'subscriptionDecision.benefits.upgradeTierToReopen',
        'Passe a la tranche superieure pour rouvrir',
      ),
    ];
  },
  get 'club-tier-team-limit'() {
    return clubPaywallBenefits();
  },
  get 'composition-required'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.lineupCallupsTwoTaps',
        'Composition et convocations en 2 taps',
      ),
      i18next.t(
        'subscriptionDecision.benefits.unlimitedEventsMatches',
        'Événements et matchs illimités',
      ),
      i18next.t('subscriptionDecision.benefits.wholeTeamBenefits', 'Toute l équipe en profite'),
    ];
  },
  get 'dues-limit'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.unlimitedFeeCampaigns',
        'Campagnes de cotisation illimitées',
      ),
      i18next.t(
        'subscriptionDecision.benefits.simplePaymentTracking',
        'Suivi des paiements simplifie',
      ),
      i18next.t(
        'subscriptionDecision.benefits.oneClickReminders',
        'Relances des membres en un clic',
      ),
    ];
  },
  get 'event-limit'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.unlimitedEventsMatches',
        'Événements et matchs illimités',
      ),
      i18next.t('subscriptionDecision.benefits.lineupCallups', 'Composition et convocations'),
      i18next.t('subscriptionDecision.benefits.wholeTeamBenefits', 'Toute l équipe en profite'),
    ];
  },
  get 'match-limit'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.unlimitedMatchesEvents',
        'Matchs et événements illimités',
      ),
      i18next.t('subscriptionDecision.benefits.lineupCallups', 'Composition et convocations'),
      i18next.t(
        'subscriptionDecision.benefits.simpleAttendanceTracking',
        'Suivi des présences simplifie',
      ),
    ];
  },
  get 'recruitment-ad-limit'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.unlimitedRecruitmentAds',
        'Annonces de recrutement illimitées',
      ),
      i18next.t(
        'subscriptionDecision.benefits.visibilityWithPlayers',
        'Visibilité aupres des joueurs',
      ),
      i18next.t('subscriptionDecision.benefits.unlimitedContacts', 'Contacts sans limite'),
    ];
  },
  get 'team-limit'() {
    return [
      i18next.t(
        'subscriptionDecision.benefits.addTeamsAsNeeded',
        'Ajoute autant d équipes que besoin',
      ),
      i18next.t(
        'subscriptionDecision.benefits.unlimitedEventsMatches',
        'Événements et matchs illimités',
      ),
      i18next.t(
        'subscriptionDecision.benefits.fullTeamManagement',
        'Gestion complète de chaque équipe',
      ),
    ];
  },
};

/** @type {Record<string, string>} */
const RECOMMENDED_PLAN_CODES = {
  CLUB: 'fc_club_tier_1_yearly',
  TEAM: 'fc_team_1_yearly',
};

// T09 — ces libelles sont lus par le CLIENT (« Offre conseillée: … »), pas par le
// code : ils portent donc le nom sous lequel l'offre est VENDUE. Le catalogue
// serveur vend « Équipe » (subscription-catalog.ts:61) ; « Team » etait le seul
// endroit de l'app a nommer ce produit en anglais.
/** @type {Record<string, string>} */
const REQUIRED_PLAN_LABELS = {
  CLUB: 'Club',
  get TEAM() {
    return i18next.t('subscriptionDecision.requiredPlanLabels.team', 'Équipe');
  },
};

// Nom de tranche Club, tel que le catalogue serveur la vend : « Club 100 » /
// « Club 500 » / « Club 1000 » / « Club Illimité » (subscription-catalog.ts,
// CLUB_TIER_CONFIG). Le code de palier (1/2/3/4) ne sort jamais a l'ecran.
//
// ⚠️ LE NUMERO DU CODE N'EST PAS LE NOM DE L'OFFRE, et c'est voulu :
// `fc_club_tier_1` s'appelle « Club 100 ». Un identifiant de magasin ne se
// renomme JAMAIS une fois cree (Apple ne les libere pas), il est invisible du
// client, et le renommer casserait tous les abonnements en cours. Le nom
// affiche, lui, est celui du 2026-08-28 : le nombre de LICENCIES couverts.
/** @type {Record<number, string>} */
const CLUB_TIER_NAMES = {
  1: '100',
  2: '500',
  3: '1000',
  get 4() {
    return i18next.t('subscriptionDecision.clubTierNames.unlimited', 'Illimité');
  },
};

/** @type {Record<string, string>} */
const PLAN_PERIOD_LABELS = {
  get monthly() {
    return i18next.t('subscriptionDecision.planPeriods.month', 'mois');
  },
  get yearly() {
    return i18next.t('subscriptionDecision.planPeriods.year', 'an');
  },
};

const QUOTA_ORDER = [
  'EVENT_PUBLISH',
  'MATCH_PUBLISH',
  'RECRUITMENT_AD_PUBLISH',
  'FREE_TEAM',
];

/** @type {Record<string, string>} */
const QUOTA_LABELS = {
  get EVENT_PUBLISH() {
    return i18next.t('subscriptionDecision.quotaLabels.events', 'Evenements');
  },
  get FREE_TEAM() {
    return i18next.t('subscriptionDecision.quotaLabels.teams', 'Equipes');
  },
  get MATCH_PUBLISH() {
    return i18next.t('subscriptionDecision.quotaLabels.matches', 'Matchs');
  },
  get RECRUITMENT_AD_PUBLISH() {
    return i18next.t('subscriptionDecision.quotaLabels.recruitment', 'Recrutement');
  },
};

// Quota retire de la matrice (decision #6 du 2026-07-09 : chat/contact 100 % libre).
// Le serveur ne le renvoie plus, mais d'anciennes lignes DB ne doivent jamais s'afficher.
const RETIRED_QUOTA_TYPES = new Set(['PROFILE_CONTACT']);

/** @type {Record<string, { description: string; label: string }>} */
const SUBSCRIPTION_STATUS_META = {
  // R10 — les DEUX etats Club portent la meme etiquette, volontairement :
  // l'abonnement est identique de part et d'autre, et la certification est une
  // action de la console SuperAdmin (admin/src/bootstrap/permission-sync.js:173)
  // qu'aucune route n'ouvre au dirigeant. Un badge « Club à vérifier » lui
  // demandait donc un geste impossible — et rendait l'etat NON certifie plus
  // inquietant que l'etat certifie, alors qu'il n'ouvre pas moins de droits.
  CLUB: {
    get description() {
      return i18next.t(
        'subscriptionDecision.statusMeta.club.description',
        'Les droits Club sont actifs sur tout ton club.',
      );
    },
    get label() {
      return i18next.t('subscriptionDecision.statusMeta.clubActive', 'Club · actif');
    },
  },
  CLUB_UNVERIFIED: {
    get description() {
      return i18next.t(
        'subscriptionDecision.statusMeta.clubUnverified.description',
        'Tes droits Club sont actifs. Ton club est en cours de certification par la plateforme.',
      );
    },
    get label() {
      return i18next.t('subscriptionDecision.statusMeta.clubActive', 'Club · actif');
    },
  },
  FREE: {
    get description() {
      return i18next.t(
        'subscriptionDecision.statusMeta.free.description',
        'Tu utilises actuellement les quotas gratuits FoundClub.',
      );
    },
    get label() {
      return i18next.t('subscriptionDecision.statusMeta.free.label', 'Gratuit');
    },
  },
  TEAM: {
    get description() {
      return i18next.t(
        'subscriptionDecision.statusMeta.team.description',
        'Les droits Équipe sont ouverts sur les équipes couvertes.',
      );
    },
    get label() {
      return i18next.t('subscriptionDecision.statusMeta.team.label', 'Équipe');
    },
  },
};

/**
 * Compteur d'une decision, ou null.
 *
 * `Number(null)` vaut ZERO : sans ce garde, un champ absent devenait « 0 membre
 * pour 0 licencie » — une phrase fausse la ou l'on veut precisement des nombres
 * justes. Absent veut dire « je ne sais pas », jamais « zero ».
 * @param {any} value
 * @returns {number | null}
 */
const readDecisionCount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * @param {any} decision
 * @returns {{
 *   allowed: boolean;
 *   licenseeCount: number | null;
 *   memberCount: number | null;
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
    // S12-B/D6 — les deux nombres du refus de quota. Ils vivent dans la decision
    // (subscription-permission.ts:833-834) et nulle part ailleurs : le bootstrap
    // n'expose PAS `licenseeCount`. Les perdre ici, c'est afficher « ton club est
    // plein » sans jamais pouvoir dire de combien.
    licenseeCount: readDecisionCount(safeDecision?.licenseeCount),
    memberCount: readDecisionCount(safeDecision?.memberCount),
    message: DEFAULT_REASON_LABELS[reason] || i18next.t(
      'subscriptionDecision.accessDenied',
      'Accès refuse',
    ),
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
    return i18next.t(
      'subscriptionDecision.requiredPlanText.two',
      '{{first}} ou {{second}}',
      { first: labels[0], second: labels[1], ...SANS_ECHAPPEMENT },
    );
  }

  return i18next.t(
    'subscriptionDecision.requiredPlanText.many',
    '{{others}} ou {{last}}',
    {
      last: labels[labels.length - 1],
      others: labels.slice(0, -1).join(', '),
      ...SANS_ECHAPPEMENT,
    },
  );
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
    ? i18next.t(
      'subscriptionDecision.requiredPlanSuffix',
      ' Offre conseillée: {{requiredPlanText}}.',
      { requiredPlanText, ...SANS_ECHAPPEMENT },
    )
    : '';
  const withRequiredPlan = (sentence) => `${sentence}${requiredPlanSuffix}`.trim();

  switch (paywall.paywallKey) {
    case 'club-licensee-limit': {
      // S12-B/D6 — LE BLOCAGE RACONTE, IL NE REFUSE PAS SEULEMENT.
      // « X membres / Y licencies souscrits » : sans ces deux nombres, le
      // dirigeant ne sait pas de combien augmenter, et le demandeur refuse croit
      // a un bug. Les nombres manquent (vieille decision, refus relaye) : on
      // garde la phrase sans eux plutot que d'ecrire « undefined ».
      const countsSentence = paywall.memberCount !== null && paywall.licenseeCount !== null
        ? i18next.t(
          'subscriptionDecision.clubFull.counts',
          ' Ton club compte {{members}} pour {{licensees}}.',
          {
            licensees: i18next.t('subscriptionDecision.clubFull.licensees', {
              count: paywall.licenseeCount,
              defaultValue_one: '{{count}} licencié souscrit',
              defaultValue_other: '{{count}} licenciés souscrits',
            }),
            members: i18next.t('subscriptionDecision.clubFull.members', {
              count: paywall.memberCount,
              defaultValue_one: '{{count}} membre',
              defaultValue_other: '{{count}} membres',
            }),
            ...SANS_ECHAPPEMENT,
          },
        )
        : '';
      // Lot CATALOGUE (28/08) : le verbe a change avec l'offre. On n'augmente
      // plus un nombre saisi, on passe a la tranche au-dessus (Club 100 -> 500
      // -> 1000 -> Illimite), et c'est le magasin qui fait la bascule.
      return {
        ctaLabel: i18next.t(
          'subscriptionDecision.paywall.clubLicenseeLimit.cta',
          'Passer à la tranche supérieure',
        ),
        description: i18next.t(
          'subscriptionDecision.paywall.clubLicenseeLimit.description',
          'Les nouvelles adhésions sont en pause : ton club a atteint le nombre de licenciés '
            + 'couverts par son abonnement.{{countsSentence}} Les membres déjà inscrits gardent '
            + 'tout.',
          { countsSentence, ...SANS_ECHAPPEMENT },
        ),
        title: i18next.t(
          'subscriptionDecision.paywall.clubLicenseeLimit.title',
          'Ton club est complet',
        ),
      };
    }
    case 'club-roles-manage-required':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: withRequiredPlan(
          i18next.t(
            'subscriptionDecision.paywall.clubRoles.description',
            'La gestion des rôles et des droits du club est réservée a l offre Club.',
          ),
        ),
        title: i18next.t('subscriptionDecision.paywall.clubRoles.title', 'Rôles club reserves'),
      };
    case 'club-tier-team-limit':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.clubTierTeamLimit.description',
          'Ton offre Club a atteint son nombre maximum d équipes. Passe au palier supérieur '
            + 'pour ajouter de nouvelles équipes.',
        ),
        title: i18next.t(
          'subscriptionDecision.paywall.clubTierTeamLimit.title',
          'Limite d équipes atteinte',
        ),
      };
    case 'composition-required':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.composition.description',
          'La composition d équipe est réservée a l offre Équipe.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t('subscriptionDecision.paywall.composition.title', 'Composition réservée'),
      };
    case 'dues-limit':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.dues.description',
          'La création de campagnes de cotisation demande une offre active.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t('subscriptionDecision.paywall.dues.title', 'Cotisations réservées'),
      };
    case 'event-limit':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.event.description',
          'Tu as atteint la limite gratuite de publication d événements.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t(
          'subscriptionDecision.paywall.event.title',
          'Publication d événement limitée',
        ),
      };
    case 'facility-manage-required':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: withRequiredPlan(
          i18next.t(
            'subscriptionDecision.paywall.facility.description',
            'La gestion des installations du club est réservée a l offre Club.',
          ),
        ),
        title: i18next.t('subscriptionDecision.paywall.facility.title', 'Installations réservées'),
      };
    case 'match-limit':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.match.description',
          'Tu as atteint la limite gratuite de publication de match.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t(
          'subscriptionDecision.paywall.match.title',
          'Publication de match limitée',
        ),
      };
    case 'recruitment-ad-limit':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.recruitment.description',
          'Cette publication de recrutement demande une offre active.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t(
          'subscriptionDecision.paywall.recruitment.title',
          'Publication recrutement limitée',
        ),
      };
    case 'sponsor-manage-required':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: withRequiredPlan(
          i18next.t(
            'subscriptionDecision.paywall.sponsor.description',
            'La gestion des sponsors du club est réservée a l offre Club.',
          ),
        ),
        title: i18next.t('subscriptionDecision.paywall.sponsor.title', 'Sponsors reserves'),
      };
    case 'team-limit':
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.team.description',
          'La création d équipe demande une offre active.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t('subscriptionDecision.paywall.team.title', 'Création d équipe limitée'),
      };
    default:
      return {
        ctaLabel: i18next.t('subscriptionDecision.paywall.viewSubscription', 'Voir mon abonnement'),
        description: i18next.t(
          'subscriptionDecision.paywall.default.description',
          'Cette action demande une offre FoundClub active.{{requiredPlanSuffix}}',
          { requiredPlanSuffix, ...SANS_ECHAPPEMENT },
        ).trim(),
        title: i18next.t(
          'subscriptionDecision.paywall.default.title',
          'Abonnement FoundClub requis',
        ),
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
    get benefits() {
      return [
        i18next.t(
          'subscriptionDecision.benefits.lineupCallupsTwoTaps',
          'Composition et convocations en 2 taps',
        ),
        i18next.t(
          'subscriptionDecision.benefits.unlimitedEventsMatches',
          'Événements et matchs illimités',
        ),
        i18next.t(
          'subscriptionDecision.benefits.wholeTeamBenefitsSheet',
          "Toute l'équipe en profite",
        ),
      ];
    },
    get kicker() {
      return i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe');
    },
    preselectedSlotCount: 1,
    get successCtaLabel() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.composition.successCta',
        'Préparer ma compo',
      );
    },
    get title() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.composition.title',
        "La composition d'équipe est réservée à l'offre Équipe",
      );
    },
  },
  'event-limit': {
    get benefits() {
      return [
        i18next.t(
          'subscriptionDecision.benefits.unlimitedEventsMatches',
          'Événements et matchs illimités',
        ),
        i18next.t(
          'subscriptionDecision.benefits.realTimeAttendance',
          'Présences en temps réel, relances auto',
        ),
        i18next.t(
          'subscriptionDecision.benefits.callupsTwoTaps',
          'Convocations envoyées en 2 taps',
        ),
      ];
    },
    get kicker() {
      return i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe');
    },
    preselectedSlotCount: 1,
    get successCtaLabel() {
      return i18next.t('subscriptionDecision.quotaSheet.event.successCta', 'Publier mon événement');
    },
    get title() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.event.title',
        'Tu veux publier un 2ᵉ événement ?',
      );
    },
  },
  'match-limit': {
    get benefits() {
      return [
        i18next.t(
          'subscriptionDecision.benefits.unlimitedMatchesEvents',
          'Matchs et événements illimités',
        ),
        i18next.t(
          'subscriptionDecision.benefits.realTimeAttendance',
          'Présences en temps réel, relances auto',
        ),
        i18next.t(
          'subscriptionDecision.benefits.callupsTwoTaps',
          'Convocations envoyées en 2 taps',
        ),
      ];
    },
    get kicker() {
      return i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe');
    },
    preselectedSlotCount: 1,
    get successCtaLabel() {
      return i18next.t('subscriptionDecision.quotaSheet.match.successCta', 'Publier mon match');
    },
    get title() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.match.title',
        'Tu veux publier un 2ᵉ match ?',
      );
    },
  },
  'recruitment-ad-limit': {
    get benefits() {
      return [
        i18next.t(
          'subscriptionDecision.benefits.unlimitedRecruitmentAds',
          'Annonces de recrutement illimitées',
        ),
        i18next.t(
          'subscriptionDecision.benefits.visibleToAreaPlayers',
          'Visible par tous les joueurs de ta zone',
        ),
        i18next.t(
          'subscriptionDecision.benefits.applicationsInMessages',
          'Candidatures directement dans tes messages',
        ),
      ];
    },
    get kicker() {
      return i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe');
    },
    preselectedSlotCount: 1,
    get successCtaLabel() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.recruitment.successCta',
        'Publier mon annonce',
      );
    },
    get title() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.recruitment.title',
        'Tu veux publier une 2ᵉ annonce ?',
      );
    },
  },
  'team-limit': {
    get benefits() {
      return [
        i18next.t(
          'subscriptionDecision.benefits.allTeamsUnlimitedEvents',
          'Toutes tes équipes, événements illimités',
        ),
        i18next.t(
          'subscriptionDecision.benefits.callWholeTeamTwoTaps',
          'Convoque toute ton équipe en 2 taps',
        ),
        i18next.t(
          'subscriptionDecision.benefits.collectEachTeamFee',
          'Encaisse la cotisation de chaque équipe',
        ),
      ];
    },
    get kicker() {
      return i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe');
    },
    preselectedSlotCount: 2,
    get successCtaLabel() {
      return i18next.t('subscriptionDecision.quotaSheet.team.successCta', 'Créer ma 2ᵉ équipe');
    },
    get title() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.team.title',
        'Tu veux créer une 2ᵉ équipe ?',
      );
    },
  },
  // Deblocage direct de l'offre Équipe depuis la sheet Actions d'équipe (decision 7).
  'team-offer-unlock': {
    get benefits() {
      return [
        i18next.t(
          'subscriptionDecision.benefits.templateLineupCallups',
          'Composition type et convocations en 2 taps',
        ),
        i18next.t(
          'subscriptionDecision.benefits.unlimitedEventsMatches',
          'Événements et matchs illimités',
        ),
        i18next.t(
          'subscriptionDecision.benefits.teamFeeInApp',
          "Cotisation de l'équipe encaissée dans l'app",
        ),
      ];
    },
    get kicker() {
      return i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe');
    },
    preselectedSlotCount: 1,
    get successCtaLabel() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.teamOfferUnlock.successCta',
        "C'est parti !",
      );
    },
    get title() {
      return i18next.t(
        'subscriptionDecision.quotaSheet.teamOfferUnlock.title',
        "Débloque tes outils d'équipe",
      );
    },
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
  const benefits = PAYWALL_BENEFITS_BY_KEY[paywall.paywallKey] || clubPaywallBenefits();
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
  // ABO-FIX / R4 (01/09) — `dues-limit` RESTE ici, et c'est deliberé : un achat
  // Club leve bien ce mur, dans TOUS les cas. Ce qui a change, c'est qu'il n'est
  // plus le seul : une campagne qui ne vise QU'UNE equipe est aussi debloquee par
  // une offre Equipe (admin/src/.../license.ts, assertDuesCampaignSubscription).
  // ⛔ NE PAS retirer cette cle pour « corriger » l'ecart : on supprimerait le
  // chemin d'achat direct a des gens qui l'ont aujourd'hui. L'offre reellement
  // conseillee arrive du serveur dans `requiredPlan`, calculee sur la RESSOURCE
  // (resolveRequiredPlans) — l'ecran l'affiche telle quelle.
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
    kicker: i18next.t('subscriptionDecision.clubSheet.kicker', 'Offre Club'),
    successCtaLabel: i18next.t('subscriptionDecision.clubSheet.successCta', 'Reprendre'),
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
 * Famille d'offre qu'un refus reclame, pour ouvrir le carrousel sur la BONNE
 * carte (L38). Deleguee a `getSubscriptionRecommendedPlanCode` : la regle « qui
 * a besoin de Club » est deja ecrite la, et deux copies d'une meme regle
 * finissent toujours par diverger.
 * @param {any} decision
 * @returns {'TEAM' | 'CLUB'}
 */
export const getSubscriptionRequiredScope = (decision) => (
  getSubscriptionRecommendedPlanCode(decision) === RECOMMENDED_PLAN_CODES.CLUB ? 'CLUB' : 'TEAM'
);

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
    return i18next.t('subscriptionDecision.planLabel.none', 'Aucune offre active');
  }

  // T09 — c'est le SEUL nom que connaisse l'ecran « Mon abonnement » : il ne
  // recoit qu'un planCode (SubscriptionOverview.js:239), jamais le displayName du
  // catalogue. Il doit donc reconstruire mot pour mot le nom sous lequel l'offre
  // a ete vendue, sans quoi le client ne reconnait pas ce qu'il paie.
  const teamMatch = normalizedPlanCode.match(/^fc_team_(\d+)_(monthly|yearly)$/);
  if (teamMatch) {
    const slotCount = Number(teamMatch[1] || 0);
    const period = PLAN_PERIOD_LABELS[teamMatch[2]] || teamMatch[2];
    return i18next.t('subscriptionDecision.planLabel.team', {
      count: slotCount,
      defaultValue_one: 'Équipe · {{count}} équipe / {{period}}',
      defaultValue_other: 'Équipe · {{count}} équipes / {{period}}',
      period,
      ...SANS_ECHAPPEMENT,
    });
  }

  // S12-B — L'OFFRE AU LICENCIE, NOMMEE A COTE DES PALIERS, PAS DEDANS.
  // Sans cette branche, l'ecran « Mon abonnement » affichait le repli en
  // capitales du bas de fonction : « Fc Club Licensee Yearly ». Le client ne
  // reconnait pas ce qu'il paie. ⛔ On n'ELARGIT PAS la regex des paliers
  // ci-dessous : un plan au licencie n'a pas de palier, il a un nombre.
  const licenseeMatch = normalizedPlanCode.match(/^fc_club_licensee_(monthly|yearly)$/);
  if (licenseeMatch) {
    const period = PLAN_PERIOD_LABELS[licenseeMatch[1]] || licenseeMatch[1];
    return i18next.t(
      'subscriptionDecision.planLabel.clubLicensee',
      'Club au licencié / {{period}}',
      { period, ...SANS_ECHAPPEMENT },
    );
  }

  const clubMatch = normalizedPlanCode.match(/^fc_club(?:_tier_(\d+))?_(monthly|yearly)$/);
  if (clubMatch) {
    const tier = Number(clubMatch[1] || 0);
    const period = PLAN_PERIOD_LABELS[clubMatch[2]] || clubMatch[2];
    // Une tranche inconnue retombe sur « Club » nu plutot que d'inventer un
    // nombre : mieux vaut un nom incomplet qu'un nom faux.
    const tierName = CLUB_TIER_NAMES[tier] || '';
    return tierName ? i18next.t(
      'subscriptionDecision.planLabel.clubTier',
      'Club {{tierName}} / {{period}}',
      { period, tierName, ...SANS_ECHAPPEMENT },
    ) : i18next.t(
      'subscriptionDecision.planLabel.club',
      'Club / {{period}}',
      { period, ...SANS_ECHAPPEMENT },
    );
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
 * @returns {{ assigned: number; available: number; clubCoveredTeamDocumentIds: string[];
 *   coveredTeamDocumentIds: string[]; total: number }}
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
  // CLUBEQ / C2 (2026-09-04) : le serveur dit desormais POURQUOI une equipe est
  // couverte. `reason === 'club'` = payee par l offre Club de son club, donc
  // impossible a racheter en offre Equipe. Une version de serveur qui ne le dit
  // pas encore rend simplement une liste vide : l ecran reste utilisable.
  const clubCoveredTeamDocumentIds = Array.from(new Set(
    normalizeDecisionArray(rawSummary?.coveredTeams)
      .filter((entry) => String(entry?.reason || '').trim() === 'club')
      .map((entry) => String(entry?.teamDocumentId || '').trim())
      .filter(Boolean),
  ));
  const total = Number(rawSummary?.total || 0);
  const assigned = Number(rawSummary?.assigned || 0);
  const available = Number(rawSummary?.available ?? Math.max(0, total - assigned));

  return {
    assigned: Number.isFinite(assigned) ? assigned : 0,
    available: Number.isFinite(available) ? Math.max(0, available) : 0,
    clubCoveredTeamDocumentIds,
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
 * L'entitlement par lequel QUELQU'UN D'AUTRE paie pour moi, ou `null`.
 *
 * 🔒 CE SELECTEUR REPOND A UNE QUESTION D'ARGENT : « puis-je dire a cette
 * personne qu'elle n'a rien a payer ? ». Une reponse trop genereuse annonce la
 * gratuite a quelqu'un qui devra payer. Les trois conditions ci-dessous sont
 * donc cumulatives, et la plus stricte gagne :
 *
 *  1. le niveau d'acces est CONNU et n'est pas `FREE` — c'est le juge unique de
 *     l'application (`getSubscriptionAccessLevel`) qui l'affirme, pas nous. Tant
 *     que le bootstrap n'a pas repondu, on ne dit rien ;
 *  2. la personne ne PAIE rien elle-meme — sinon « tu n'as rien a payer »
 *     serait faux : elle paie, justement ;
 *  3. un entitlement est paye par quelqu'un d'AUTRE, et ce quelqu'un porte un
 *     nom. Sans nom, pas de message : on ne peut pas expliquer d'ou vient la
 *     couverture, donc on se tait.
 *
 * ⚠️ La portee d'une offre vient de l'ACHAT, jamais du cache d'abonnement :
 * juste apres un achat, `subscriptionSummary` decrit encore l'ANCIEN etat. Ce
 * selecteur ne sert donc qu'a EXPLIQUER une couverture deja etablie — jamais a
 * decider d'un droit d'acces.
 *
 * Le meme calcul vit en ligne dans `views/profile/SubscriptionOverview.js`
 * (page heros « deja couvert », handoff 7b). Il appartenait a une autre session
 * le 2026-08-10 : le brancher ici est le pas suivant, il ne change rien au
 * comportement.
 * @param {object} params
 * @param {any[]} params.entitlementsSummary
 * @param {string | null | undefined} params.subscriptionAccessLevel
 * @param {any} [params.subscriptionSummary]
 * @param {string} [params.userDocumentId]
 * @returns {any | null}
 */
export const getCoveringEntitlement = ({
  entitlementsSummary,
  subscriptionAccessLevel,
  subscriptionSummary,
  userDocumentId,
}) => {
  // 1. Le juge unique n'a pas encore parle, ou il dit « gratuit ».
  if (!subscriptionAccessLevel || subscriptionAccessLevel === 'FREE') {
    return null;
  }

  // 2. CETTE PERSONNE PAIE-T-ELLE ELLE-MEME ?
  //
  // 🧨 VITRINE / W4 — `activePlanCodes` NE REPOND PAS A CETTE QUESTION, et c est
  // ce qui rendait cet ecran STRUCTURELLEMENT INATTEIGNABLE. Le serveur construit
  // cette liste a partir de TOUS les droits actifs du compte, y compris ceux
  // payes par quelqu un d autre (`getSubscriptionSummary`,
  // admin/src/api/subscription/services/subscription-permission.ts). Etre couvert
  // par l offre Club de son club suffisait donc a la remplir — donc a se voir
  // refuser la page qui explique justement cette couverture.
  //
  // Les deux listes qui repondent vraiment existent deja : `payerSubscriptionIds`
  // (les abonnements dont CE compte est le payeur) et, en repli pour un serveur
  // qui ne la rendrait pas encore, les entitlements dont `paidBy` c est moi.
  const myDocumentId = String(userDocumentId || '').trim();
  const entitlements = normalizeDecisionArray(entitlementsSummary);
  const payerSubscriptionIds = normalizeDecisionArray(subscriptionSummary?.payerSubscriptionIds);
  const paysSomethingHimself = payerSubscriptionIds.length > 0
    || (myDocumentId !== '' && entitlements.some(
      (entry) => String(entry?.paidBy?.documentId || '').trim() === myDocumentId,
    ));
  if (paysSomethingHimself) {
    return null;
  }

  // 3. Un entitlement paye par un tiers NOMME.
  const candidates = entitlements.filter((entry) => {
    const payerDocumentId = String(entry?.paidBy?.documentId || '').trim();
    return payerDocumentId
      && payerDocumentId !== myDocumentId
      && String(entry?.paidBy?.firstname || '').trim() !== '';
  });

  // Une couverture club porte plus loin qu'une couverture d'equipe : si les deux
  // existent, c'est celle-la qu'il faut nommer.
  return candidates.find((entry) => entry?.scopeType === 'CLUB') || candidates[0] || null;
};

/**
 * @param {any[]} freeUsageSummary
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB'} [subscriptionAccessLevel]
 * @returns {Array<{ label: string; quotaType: string; remaining: number; total: number; used: number }>}
 */
export const getSubscriptionQuotaItems = (freeUsageSummary, subscriptionAccessLevel = 'FREE') => {
  // Les compteurs de l'offre GRATUITE ne concernent que ceux qui ne paient rien.
  // CLUB_UNVERIFIED figurait ici par erreur, d'avant la decision produit du
  // 2026-07-17 (admin/src/api/subscription/services/subscription-permission.ts
  // :751-756) : un entitlement CLUB actif ouvre TOUT, club certifie ou pas —
  // c'est ce que tranche `hasActiveClubOffer` (ligne 618) et ses 8 lignes de
  // motif. Lui afficher « il te reste 1 publication gratuite » revenait a lui
  // revendre ce qu'il paye deja.
  // On teste `!== 'FREE'` plutot que d'appeler le juge : la question posee ici
  // n'est pas « a-t-il l'offre Club ? » mais « ne paie-t-il rien ? ». Un niveau
  // futur tombe alors du cote sur — celui qui ne revend rien a un client.
  if (subscriptionAccessLevel !== 'FREE') {
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
  get EVENT_PUBLISH() {
    return i18next.t(
      'subscriptionDecision.entryPointHints.eventPublish',
      "Ton événement gratuit est déjà en ligne — débloque l'offre Équipe",
    );
  },
  get FREE_TEAM() {
    return i18next.t(
      'subscriptionDecision.entryPointHints.freeTeam',
      "Ta création gratuite est utilisée — débloque l'offre Équipe",
    );
  },
  get MATCH_PUBLISH() {
    return i18next.t(
      'subscriptionDecision.entryPointHints.matchPublish',
      "Ton match gratuit est déjà en ligne — débloque l'offre Équipe",
    );
  },
  get RECRUITMENT_AD_PUBLISH() {
    return i18next.t(
      'subscriptionDecision.entryPointHints.recruitmentAdPublish',
      "Ton annonce gratuite est déjà en ligne — débloque l'offre Équipe",
    );
  },
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
    badgeLabel: i18next.t('subscriptionDecision.quotaSheet.kickerTeamOffer', 'Offre Équipe'),
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
