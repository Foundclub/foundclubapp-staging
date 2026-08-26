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
      title: 'Série sans retard',
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
      title: 'Série de présences',
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
      body: toLabel(context?.body, 'Une nouvelle étape est franchie.'),
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
  // S12-B/D7 — SANS CES DEUX ENTREES, LA BANNIERE EST JETEE EN SILENCE.
  //
  // Le serveur (S12-A) envoie deja les deux notifications avec leur
  // `celebrationKey` (admin/src/utils/celebration-service.ts:692). Cote app,
  // `buildCelebrationPayload` rend `null` pour tout actionKey absent de CE
  // catalogue (l. 543-545) et `celebrate` s'arrete la (celebrationRuntime.js
  // :39-42) : aucun ecran, aucune erreur, rien du tout. Le dirigeant ne savait
  // jamais que son club etait plein.
  //
  // `buildCopy` porte un titre de REPLI : le push du serveur fournit le sien,
  // mais une entree sans titre rend `null` (l. 548) — la banniere doit survivre
  // a un push sans bloc `notification`.
  club_licensee_quota_approaching: {
    buildCopy: (context) => {
      const remaining = Number(context?.remaining || 0);
      const licenseeCount = Number(context?.licenseeCount || 0);
      return {
        body: remaining > 0 && licenseeCount > 0
          ? `${toLabel(context?.clubName, 'Ton club')} n'a plus que ${pluralize(remaining, 'place')} sur les ${licenseeCount} licenciés de son abonnement.`
          : '',
        eyebrow: 'ABONNEMENT',
        title: 'Bientôt au complet',
      };
    },
    category: 'club',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: DEFAULT_DURATION_MS,
    priority: 5,
    tone: 'info',
    variant: 'banner',
  },
  club_licensee_quota_reached: {
    buildCopy: (context) => {
      const licenseeCount = Number(context?.licenseeCount || 0);
      return {
        body: licenseeCount > 0
          ? `${toLabel(context?.clubName, 'Ton club')} a atteint ses ${licenseeCount} licenciés. Les nouvelles adhésions sont en pause.`
          : '',
        eyebrow: 'ABONNEMENT',
        title: 'Plafond de licenciés atteint',
      };
    },
    category: 'club',
    channels: 'both',
    cooldownMs: 86400000,
    durationMs: CELEBRATION_DURATION_MS,
    // Au-dessus des celebrations (5) : celle-ci coute des adhesions tant qu'elle
    // n'est pas lue. C'est la priorite que le serveur lui donne deja (7).
    priority: 7,
    tone: 'warning',
    variant: 'banner',
  },
  club_member_milestone: {
    buildCopy: (context) => ({
      body: `${toLabel(context?.clubName, 'Ton club')} atteint ${Number(context?.milestone || 0) || 0} membres.`,
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
      title: 'Adhésion confirmée',
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
      body: `Ta demande pour rejoindre ${toLabel(context?.clubName, 'ce club')} a bien été prise en compte.`,
      eyebrow: 'CLUB',
      title: 'Demande envoyée',
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
      body: `${Number(context?.eventCount || 0) || 1} événements sont maintenant enregistres.`,
      eyebrow: 'EVENEMENTS',
      title: 'Événements créés',
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
      body: `La composition d'équipes pour ${toLabel(context?.teamName, 'ton équipe')} est prête.`,
      eyebrow: 'COMPOSITION',
      title: "Composition d'équipes publiée",
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
      body: `${toLabel(context?.eventName, 'Ton événement')} est bien enregistre.`,
      eyebrow: 'EVENEMENT',
      title: 'Événement crée',
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
      body: `${toLabel(context?.teamName, 'Une équipe externe')} rejoint ${toLabel(context?.eventName, "l'evenement")}.`,
      eyebrow: 'INVITATION',
      title: 'Équipe externe confirmée',
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
      body: `Tu es bien confirmé pour ${toLabel(context?.eventName, "l'evenement")}.`,
      eyebrow: 'PARTICIPATION',
      title: 'Participation confirmée',
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
      body: `Ta demande pour ${toLabel(context?.eventName, 'cet événement')} a bien été envoyée.`,
      eyebrow: 'PARTICIPATION',
      title: 'Participation envoyée',
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
      body: `${toLabel(context?.eventName, 'Ton événement')} est maintenant visible pour les joueurs concernés.`,
      eyebrow: 'EVENEMENT',
      title: 'Événement publie',
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
      body: `Tous les joueurs de ${toLabel(context?.teamName, 'cette équipe')} ont répondu pour ${toLabel(context?.eventName, "l'evenement")}.`,
      eyebrow: 'CONVOCATION',
      title: 'Réponses completes',
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
      body: `Ta réponse pour ${toLabel(context?.eventName, "l'evenement")} a bien été enregistrée.`,
      eyebrow: 'PRESENCE',
      title: 'Présence confirmée',
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
      body: `Tu es confirmé sur ${toLabel(context?.taskTitle, 'ta mission du jour')}.`,
      eyebrow: 'ORGANISATION',
      title: 'Tâche validée',
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
      body: `${pluralize(Number(context?.count || 0), 'membre')} assigne(s) a ${toLabel(context?.taskTitle, 'cette tâche')}.`,
      eyebrow: 'ORGANISATION',
      title: 'Affectation terminée',
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
      body: `Ta proposition pour ${toLabel(context?.taskTitle, 'cette tâche')} a bien été prise en compte.`,
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
      body: `Toutes les tâches de ${toLabel(context?.eventName, "l'evenement")} sont maintenant couvertes.`,
      eyebrow: 'ORGANISATION',
      title: 'Organisation complète',
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
      body: `${toLabel(context?.eventName, "L'evenement")} a été mis à jour.`,
      eyebrow: 'EVENEMENT',
      title: 'Mise à jour enregistrée',
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
      body: `${toLabel(context?.teamName, 'Ton équipe')} signe sa première victoire League.`,
      eyebrow: 'LEAGUE',
      title: 'Première victoire',
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
      body: `${toLabel(context?.teamName, 'Ta squad')} a maintenant un adversaire.`,
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
      body: `Le résultat de ${toLabel(context?.matchLabel || context?.eventName, 'ton match')} est maintenant valide.`,
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
      body: `Le match contre ${toLabel(context?.opponentName, "l'adversaire")} est confirmé.`,
      eyebrow: 'LEAGUE',
      title: 'Proposition acceptée',
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
      body: `${toLabel(context?.teamName, 'Ta squad')} à son effectif pour jouer.`,
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
      title: 'Série de victoires',
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
      body: `${toLabel(context?.teamName, 'Ton équipe')} a gagne ce week-end contre ${toLabel(context?.opponentName, "l'adversaire")}.`,
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
      body: `Le paiement de ${toLabel(context?.teamName, 'ta licence')} a bien été confirmé.`,
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
      title: 'Licence officielle ajoutée',
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
      body: `${toLabel(context?.teamName, 'Ton équipe')} est prête à accueillir ses membres.`,
      eyebrow: 'EQUIPE',
      title: 'Équipe créée',
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
      body: `Tu fais maintenant partie de ${toLabel(context?.teamName, 'ton équipe')}.`,
      eyebrow: 'EQUIPE',
      title: 'Adhésion confirmée',
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
      body: `Ta demande pour rejoindre ${toLabel(context?.teamName, 'cette équipe')} a bien été envoyée.`,
      eyebrow: 'EQUIPE',
      title: 'Demande envoyée',
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
