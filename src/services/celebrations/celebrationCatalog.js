// @ts-nocheck
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

const DEFAULT_DURATION_MS = 3200;
const CELEBRATION_DURATION_MS = 4200;

const toLabel = (value, fallback) => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const pluralize = (count, singular, plural = null) => (
  `${count} ${count > 1 ? (plural || `${singular}s`) : singular}`
);

const buildStreakBody = (context, singular, plural) => {
  const milestone = Number(context?.milestone || 0);
  if (!Number.isFinite(milestone) || milestone <= 0) {
    return '';
  }
  return `Tu enchaines ${pluralize(milestone, singular, plural)}. Continue comme ca.`;
};

/** @type {Record<string, any>} */
export const celebrationCatalog = {
  attendance_on_time_streak: {
    buildCopy: (context) => ({
      body: buildStreakBody(context, 'entrainement', 'entrainements'),
      eyebrow: 'ASSIDUITE',
      title: 'Serie sans retard',
    }),
    category: 'attendance',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'success',
    variant: 'celebration',
  },
  attendance_presence_streak: {
    buildCopy: (context) => ({
      body: buildStreakBody(context, 'presence', 'presences'),
      eyebrow: 'ASSIDUITE',
      title: 'Serie de presences',
    }),
    category: 'attendance',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'success',
    variant: 'celebration',
  },
  celebration_generic: {
    buildCopy: (context) => ({
      actionLabel: context?.actionLabel,
      body: toLabel(context?.body, 'Une nouvelle etape est franchie.'),
      eyebrow: toLabel(context?.eyebrow, 'FELICITATIONS'),
      title: toLabel(context?.title, 'Bravo'),
    }),
    category: 'celebration',
    channels: 'both',
    cooldownMs: 10000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 3,
    tone: 'success',
    variant: 'celebration',
  },
  club_member_milestone: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.clubName, 'Votre club')} atteint ${Number(context?.milestone || 0) || 0} membres.`,
      eyebrow: 'CLUB',
      title: 'Nouveau cap franchi',
    }),
    category: 'club',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'success',
    variant: 'celebration',
  },
  club_membership_confirmed: {
    buildCopy: (context) => ({
      body: `Bienvenue dans ${toLabel(context?.clubName, 'ton club')}.`,
      eyebrow: 'CLUB',
      title: 'Adhesion confirmee',
    }),
    category: 'club',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'success',
    variant: 'celebration',
  },
  club_membership_request_sent: {
    buildCopy: (context) => ({
      body: `Ta demande pour rejoindre ${toLabel(context?.clubName, 'ce club')} a bien ete prise en compte.`,
      eyebrow: 'CLUB',
      title: 'Demande envoyee',
    }),
    category: 'club',
    channels: 'local_banner',
    cooldownMs: 6000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 2,
    tone: 'success',
    variant: 'banner',
  },
  event_batch_created: {
    buildCopy: (context) => ({
      body: `${Number(context?.eventCount || 0) || 1} evenements sont maintenant enregistres.`,
      eyebrow: 'EVENEMENTS',
      title: 'Evenements crees',
    }),
    category: 'event',
    channels: 'local_banner',
    cooldownMs: 6000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 3,
    tone: 'success',
    variant: 'banner',
  },
  event_convocation_published: {
    buildCopy: (context) => ({
      body: `La convocation pour ${toLabel(context?.teamName, 'ton equipe')} est prete.`,
      eyebrow: 'CONVOCATION',
      title: 'Convocation publiee',
    }),
    category: 'event',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  event_created: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.eventName, 'Votre evenement')} est bien enregistre.`,
      eyebrow: 'EVENEMENT',
      title: 'Evenement cree',
    }),
    category: 'event',
    channels: 'local_banner',
    cooldownMs: 6000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 3,
    tone: 'success',
    variant: 'banner',
  },
  event_external_team_accepted: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.teamName, 'Une equipe externe')} rejoint ${toLabel(context?.eventName, "l'evenement")}.`,
      eyebrow: 'INVITATION',
      title: 'Equipe externe confirmee',
    }),
    category: 'event',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'league',
    variant: 'celebration',
  },
  event_participation_confirmed: {
    buildCopy: (context) => ({
      body: `Tu es bien confirme pour ${toLabel(context?.eventName, "l'evenement")}.`,
      eyebrow: 'PARTICIPATION',
      title: 'Participation confirmee',
    }),
    category: 'event',
    channels: 'both',
    cooldownMs: 15000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  event_participation_request_sent: {
    buildCopy: (context) => ({
      body: `Ta demande pour ${toLabel(context?.eventName, 'cet evenement')} a bien ete envoyee.`,
      eyebrow: 'PARTICIPATION',
      title: 'Participation envoyee',
    }),
    category: 'event',
    channels: 'local_banner',
    cooldownMs: 6000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 2,
    tone: 'success',
    variant: 'banner',
  },
  event_published: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.eventName, 'Votre evenement')} est maintenant visible pour les joueurs concernes.`,
      eyebrow: 'EVENEMENT',
      title: 'Evenement publie',
    }),
    category: 'event',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  event_responses_complete: {
    buildCopy: (context) => ({
      body: `Tous les joueurs de ${toLabel(context?.teamName, 'cette equipe')} ont repondu pour ${toLabel(context?.eventName, "l'evenement")}.`,
      eyebrow: 'CONVOCATION',
      title: 'Reponses completes',
    }),
    category: 'event',
    channels: 'both',
    cooldownMs: 60000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  event_rsvp_present: {
    buildCopy: (context) => ({
      body: `Ta reponse pour ${toLabel(context?.eventName, "l'evenement")} a bien ete enregistree.`,
      eyebrow: 'PRESENCE',
      title: 'Presence confirmee',
    }),
    category: 'event',
    channels: 'local_banner',
    cooldownMs: 6000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 2,
    tone: 'success',
    variant: 'banner',
  },
  event_task_assignment_validated: {
    buildCopy: (context) => ({
      body: `Tu es confirme sur ${toLabel(context?.taskTitle, 'ta mission du jour')}.`,
      eyebrow: 'ORGANISATION',
      title: 'Tache validee',
    }),
    category: 'event_task',
    channels: 'both',
    cooldownMs: 15000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  event_task_members_assigned: {
    buildCopy: (context) => ({
      body: `${pluralize(Number(context?.count || 0), 'membre')} assigne(s) a ${toLabel(context?.taskTitle, 'cette tache')}.`,
      eyebrow: 'ORGANISATION',
      title: 'Affectation terminee',
    }),
    category: 'event_task',
    channels: 'local_banner',
    cooldownMs: 5000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 2,
    tone: 'success',
    variant: 'banner',
  },
  event_task_volunteer_sent: {
    buildCopy: (context) => ({
      body: `Ta proposition pour ${toLabel(context?.taskTitle, 'cette tache')} a bien ete prise en compte.`,
      eyebrow: 'ORGANISATION',
      title: 'Volontariat enregistre',
    }),
    category: 'event_task',
    channels: 'local_banner',
    cooldownMs: 5000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 2,
    tone: 'success',
    variant: 'banner',
  },
  event_tasks_covered: {
    buildCopy: (context) => ({
      body: `Toutes les taches de ${toLabel(context?.eventName, "l'evenement")} sont maintenant couvertes.`,
      eyebrow: 'ORGANISATION',
      title: 'Organisation complete',
    }),
    category: 'event_task',
    channels: 'both',
    cooldownMs: 60000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  event_updated: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.eventName, "L'evenement")} a ete mis a jour.`,
      eyebrow: 'EVENEMENT',
      title: 'Mise a jour enregistree',
    }),
    category: 'event',
    channels: 'local_banner',
    cooldownMs: 5000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 1,
    tone: 'info',
    variant: 'banner',
  },
  league_first_victory: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.teamName, 'Votre equipe')} signe sa premiere victoire League.`,
      eyebrow: 'LEAGUE',
      title: 'Premiere victoire',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  league_match_found: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.teamName, 'Votre squad')} a maintenant un adversaire.`,
      eyebrow: 'LEAGUE',
      title: 'Match trouve',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 20000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  league_match_validated: {
    buildCopy: (context) => ({
      body: `Le resultat de ${toLabel(context?.matchLabel || context?.eventName, 'votre match')} est maintenant valide.`,
      eyebrow: 'LEAGUE',
      title: 'Score valide',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'league',
    variant: 'celebration',
  },
  league_proposal_accepted: {
    buildCopy: (context) => ({
      body: `Le match contre ${toLabel(context?.opponentName, "l'adversaire")} est confirme.`,
      eyebrow: 'LEAGUE',
      title: 'Proposition acceptee',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 20000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  league_quorum_reached: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.teamName, 'Votre squad')} a son effectif pour jouer.`,
      eyebrow: 'LEAGUE',
      title: 'Quorum atteint',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  league_victory_streak: {
    buildCopy: (context) => ({
      body: buildStreakBody(context, 'victoire', 'victoires'),
      eyebrow: 'LEAGUE',
      title: 'Serie de victoires',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  league_weekend_win: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.teamName, 'Votre equipe')} a gagne ce week-end contre ${toLabel(context?.opponentName, "l'adversaire")}.`,
      eyebrow: 'LEAGUE',
      title: 'Victoire du week-end',
    }),
    category: 'league',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'league',
    variant: 'celebration',
  },
  license_available: {
    buildCopy: () => ({
      body: 'La licence officielle est maintenant disponible dans ton espace.',
      eyebrow: 'LICENCE',
      title: 'Licence disponible',
    }),
    category: 'license',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  license_payment_confirmed: {
    buildCopy: (context) => ({
      body: `Le paiement de ${toLabel(context?.teamName, 'ta licence')} a bien ete confirme.`,
      eyebrow: 'LICENCE',
      title: 'Paiement confirme',
    }),
    category: 'license',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'success',
    variant: 'celebration',
  },
  official_license_uploaded: {
    buildCopy: () => ({
      body: 'La copie officielle est disponible pour le membre concerne.',
      eyebrow: 'LICENCE',
      title: 'Licence officielle ajoutee',
    }),
    category: 'license',
    channels: 'local_banner',
    cooldownMs: 5000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 3,
    tone: 'success',
    variant: 'banner',
  },
  team_created: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.teamName, 'Votre equipe')} est prete a accueillir ses membres.`,
      eyebrow: 'EQUIPE',
      title: 'Equipe creee',
    }),
    category: 'team',
    channels: 'local_banner',
    cooldownMs: 10000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 4,
    tone: 'success',
    variant: 'celebration',
  },
  team_membership_confirmed: {
    buildCopy: (context) => ({
      body: `Tu fais maintenant partie de ${toLabel(context?.teamName, 'ton equipe')}.`,
      eyebrow: 'EQUIPE',
      title: 'Adhesion confirmee',
    }),
    category: 'team',
    channels: 'both',
    cooldownMs: 30000,
    durationMs: CELEBRATION_DURATION_MS,
    priority: 5,
    tone: 'success',
    variant: 'celebration',
  },
  team_membership_request_sent: {
    buildCopy: (context) => ({
      body: `Ta demande pour rejoindre ${toLabel(context?.teamName, 'cette equipe')} a bien ete envoyee.`,
      eyebrow: 'EQUIPE',
      title: 'Demande envoyee',
    }),
    category: 'team',
    channels: 'local_banner',
    cooldownMs: 6000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 2,
    tone: 'success',
    variant: 'banner',
  },
};

const CONTEXT_SUBJECT_KEYS = [
  'subjectDocumentId',
  'eventId',
  'teamId',
  'clubId',
  'assignmentId',
  'taskId',
  'matchId',
  'paymentId',
  'campaignId',
  'userId',
];

const resolveSubjectKey = (context = {}) => CONTEXT_SUBJECT_KEYS
  .map((key) => String(context?.[key] || '').trim())
  .find(Boolean) || '';

export const buildCelebrationDedupeKey = (actionKey, context = {}, overrideKey = '') => {
  const explicit = String(overrideKey || '').trim();
  if (explicit) return explicit;

  const subjectKey = resolveSubjectKey(context);
  const milestone = String(context?.milestone || context?.milestoneValue || '').trim();
  return ['celebration', actionKey, subjectKey || 'global', milestone || null]
    .filter(Boolean)
    .join(':');
};

export const inferCelebrationActionFromNotification = (notificationType, context = {}) => {
  const type = String(notificationType || '').trim();
  if (!type) return '';

  if (type === NOTIFICATION_TYPES.CLUB_REQUEST && String(context?.status || '').toLowerCase() === 'processed') {
    return 'club_membership_confirmed';
  }
  if (type === NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST && String(context?.status || '').toLowerCase() === 'accepted') {
    return 'team_membership_confirmed';
  }
  if (type === NOTIFICATION_TYPES.PARTICIPATION_REQUEST && String(context?.status || '').toLowerCase() === 'accepted') {
    return 'event_participation_confirmed';
  }
  if (type === NOTIFICATION_TYPES.EVENT_PUBLISHED) return 'event_published';
  if (type === NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED) return 'event_convocation_published';
  if (type === NOTIFICATION_TYPES.LICENSE_PAYMENT_CONFIRMED) return 'license_payment_confirmed';
  if (type === NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND || type === NOTIFICATION_TYPES.MATCH_FOUND) return 'league_match_found';
  if (type === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) return 'league_proposal_accepted';
  if (type === NOTIFICATION_TYPES.LEAGUE_QUORUM_REACHED) return 'league_quorum_reached';
  if (type === NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED) return 'league_match_validated';
  if (type === NOTIFICATION_TYPES.CELEBRATION) return 'celebration_generic';
  return '';
};

export const buildCelebrationPayload = (actionKey, context = {}, overrides = {}) => {
  const definition = celebrationCatalog[actionKey];
  if (!definition) return null;

  const copy = definition.buildCopy(context || {});
  if (!copy?.title) return null;

  return {
    actionKey,
    actionLabel: overrides.actionLabel ?? copy.actionLabel,
    body: overrides.body ?? copy.body,
    category: overrides.category ?? definition.category,
    channels: overrides.channels ?? definition.channels,
    cooldownMs: Number(overrides.cooldownMs || definition.cooldownMs || 0),
    dedupeKey: buildCelebrationDedupeKey(
      actionKey,
      context,
      overrides.dedupeKey || context?.celebrationDedupeKey || context?.dedupeKey,
    ),
    durationMs: Number(overrides.durationMs || definition.durationMs || DEFAULT_DURATION_MS),
    eyebrow: overrides.eyebrow ?? copy.eyebrow,
    metadata: {
      actionKey,
      context,
      source: overrides.source || context?.source || 'local',
    },
    priority: Number(overrides.priority ?? definition.priority ?? 1),
    progressBar: overrides.progressBar ?? true,
    title: overrides.title ?? copy.title,
    tone: overrides.tone ?? definition.tone ?? 'info',
    variant: overrides.variant ?? definition.variant ?? 'banner',
  };
};
