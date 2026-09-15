// @ts-nocheck
import i18next from 'i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

const DEFAULT_DURATION_MS = 3200;
const CELEBRATION_DURATION_MS = 4200;

const toLabel = (value, fallback) => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

// I18N-4 : la phrase de serie est un pluriel i18next, fourni par chaque entree (le
// singulier / pluriel manuel `pluralize` accordait deja a `n > 1`, comme i18next en francais).
const buildStreakBody = (context, phrase) => {
  const milestone = Number(context?.milestone || 0);
  if (!Number.isFinite(milestone) || milestone <= 0) {
    return '';
  }
  return phrase(milestone);
};

/** @type {Record<string, any>} */
export const celebrationCatalog = {
  attendance_on_time_streak: {
    buildCopy: (context) => ({
      body: buildStreakBody(context, (count) => i18next.t(
        'celebrationCatalog.attendanceOnTimeStreak.body',
        {
          count,
          defaultValue_one: 'Tu enchaines {{count}} entrainement. Continue comme ca.',
          defaultValue_other: 'Tu enchaines {{count}} entrainements. Continue comme ca.',
        },
      )),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.attendance', 'ASSIDUITE'),
      title: i18next.t('celebrationCatalog.attendanceOnTimeStreak.title', 'Série sans retard'),
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
      body: buildStreakBody(context, (count) => i18next.t(
        'celebrationCatalog.attendancePresenceStreak.body',
        {
          count,
          defaultValue_one: 'Tu enchaines {{count}} presence. Continue comme ca.',
          defaultValue_other: 'Tu enchaines {{count}} presences. Continue comme ca.',
        },
      )),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.attendance', 'ASSIDUITE'),
      title: i18next.t('celebrationCatalog.attendancePresenceStreak.title', 'Série de présences'),
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
      body: toLabel(context?.body, i18next.t(
        'celebrationCatalog.generic.body',
        'Une nouvelle étape est franchie.',
      )),
      eyebrow: toLabel(context?.eyebrow, i18next.t(
        'celebrationCatalog.generic.eyebrow',
        'FELICITATIONS',
      )),
      title: toLabel(context?.title, i18next.t('celebrationCatalog.generic.title', 'Bravo')),
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
          ? i18next.t('celebrationCatalog.clubLicenseeQuotaApproaching.body', {
            club: toLabel(
              context?.clubName,
              i18next.t('celebrationCatalog.fallbacks.yourClubCap', 'Ton club'),
            ),
            count: remaining,
            defaultValue_one: "{{club}} n'a plus que {{count}} place sur les {{total}} licenciés de son abonnement.", // eslint-disable-line max-len
            defaultValue_other: "{{club}} n'a plus que {{count}} places sur les {{total}} licenciés de son abonnement.", // eslint-disable-line max-len
            total: licenseeCount,
            ...SANS_ECHAPPEMENT,
          })
          : '',
        eyebrow: i18next.t('celebrationCatalog.eyebrows.subscription', 'ABONNEMENT'),
        title: i18next.t(
          'celebrationCatalog.clubLicenseeQuotaApproaching.title',
          'Bientôt au complet',
        ),
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
          ? i18next.t(
            'celebrationCatalog.clubLicenseeQuotaReached.body',
            '{{club}} a atteint ses {{total}} licenciés. Les nouvelles adhésions sont en pause.',
            {
              club: toLabel(
                context?.clubName,
                i18next.t('celebrationCatalog.fallbacks.yourClubCap', 'Ton club'),
              ),
              total: licenseeCount,
              ...SANS_ECHAPPEMENT,
            },
          )
          : '',
        eyebrow: i18next.t('celebrationCatalog.eyebrows.subscription', 'ABONNEMENT'),
        title: i18next.t(
          'celebrationCatalog.clubLicenseeQuotaReached.title',
          'Plafond de licenciés atteint',
        ),
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
      body: i18next.t(
        'celebrationCatalog.clubMemberMilestone.body',
        '{{club}} atteint {{total}} membres.',
        {
          club: toLabel(
            context?.clubName,
            i18next.t('celebrationCatalog.fallbacks.yourClubCap', 'Ton club'),
          ),
          total: Number(context?.milestone || 0) || 0,
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'CLUB',
      title: i18next.t('celebrationCatalog.clubMemberMilestone.title', 'Nouveau cap franchi'),
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
      body: i18next.t(
        'celebrationCatalog.clubMembershipConfirmed.body',
        'Bienvenue dans {{club}}.',
        {
          club: toLabel(
            context?.clubName,
            i18next.t('celebrationCatalog.fallbacks.yourClub', 'ton club'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'CLUB',
      title: i18next.t('celebrationCatalog.clubMembershipConfirmed.title', 'Adhésion confirmée'),
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
      body: i18next.t(
        'celebrationCatalog.clubMembershipRequestSent.body',
        'Ta demande pour rejoindre {{club}} a bien été prise en compte.',
        {
          club: toLabel(
            context?.clubName,
            i18next.t('celebrationCatalog.fallbacks.thisClub', 'ce club'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'CLUB',
      title: i18next.t('celebrationCatalog.clubMembershipRequestSent.title', 'Demande envoyée'),
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
      body: i18next.t(
        'celebrationCatalog.eventBatchCreated.body',
        '{{total}} événements sont maintenant enregistres.',
        {
          total: Number(context?.eventCount || 0) || 1,
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.events', 'EVENEMENTS'),
      title: i18next.t('celebrationCatalog.eventBatchCreated.title', 'Événements créés'),
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
      body: i18next.t(
        'celebrationCatalog.eventConvocationPublished.body',
        "La composition d'équipes pour {{team}} est prête.",
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourTeam', 'ton équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.lineup', 'COMPOSITION'),
      title: i18next.t(
        'celebrationCatalog.eventConvocationPublished.title',
        "Composition d'équipes publiée",
      ),
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
      body: i18next.t(
        'celebrationCatalog.eventCreated.body',
        '{{event}} est bien enregistre.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.yourEventCap', 'Ton événement'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.event', 'EVENEMENT'),
      title: i18next.t('celebrationCatalog.eventCreated.title', 'Événement crée'),
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
      body: i18next.t(
        'celebrationCatalog.eventExternalTeamAccepted.body',
        '{{team}} rejoint {{event}}.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.theEvent', "l'evenement"),
          ),
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.externalTeamCap', 'Une équipe externe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'INVITATION',
      title: i18next.t(
        'celebrationCatalog.eventExternalTeamAccepted.title',
        'Équipe externe confirmée',
      ),
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
      body: i18next.t(
        'celebrationCatalog.eventParticipationConfirmed.body',
        'Tu es bien confirmé pour {{event}}.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.theEvent', "l'evenement"),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.participation', 'PARTICIPATION'),
      title: i18next.t(
        'celebrationCatalog.eventParticipationConfirmed.title',
        'Participation confirmée',
      ),
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
      body: i18next.t(
        'celebrationCatalog.eventParticipationRequestSent.body',
        'Ta demande pour {{event}} a bien été envoyée.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.thisEvent', 'cet événement'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.participation', 'PARTICIPATION'),
      title: i18next.t(
        'celebrationCatalog.eventParticipationRequestSent.title',
        'Participation envoyée',
      ),
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
      body: i18next.t(
        'celebrationCatalog.eventPublished.body',
        '{{event}} est maintenant visible pour les joueurs concernés.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.yourEventCap', 'Ton événement'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.event', 'EVENEMENT'),
      title: i18next.t('celebrationCatalog.eventPublished.title', 'Événement publie'),
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
      body: i18next.t(
        'celebrationCatalog.eventResponsesComplete.body',
        'Tous les joueurs de {{team}} ont répondu pour {{event}}.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.theEvent', "l'evenement"),
          ),
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.thisTeam', 'cette équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.callUp', 'CONVOCATION'),
      title: i18next.t('celebrationCatalog.eventResponsesComplete.title', 'Réponses completes'),
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
      body: i18next.t(
        'celebrationCatalog.eventRsvpPresent.body',
        'Ta réponse pour {{event}} a bien été enregistrée.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.theEvent', "l'evenement"),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.presence', 'PRESENCE'),
      title: i18next.t('celebrationCatalog.eventRsvpPresent.title', 'Présence confirmée'),
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
      body: i18next.t(
        'celebrationCatalog.eventTaskAssignmentValidated.body',
        'Tu es confirmé sur {{task}}.',
        {
          task: toLabel(
            context?.taskTitle,
            i18next.t('celebrationCatalog.fallbacks.yourTaskToday', 'ta mission du jour'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.organisation', 'ORGANISATION'),
      title: i18next.t('celebrationCatalog.eventTaskAssignmentValidated.title', 'Tâche validée'),
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
      body: i18next.t('celebrationCatalog.eventTaskMembersAssigned.body', {
        count: Number(context?.count || 0),
        defaultValue_one: '{{count}} membre assigne(s) a {{task}}.',
        defaultValue_other: '{{count}} membres assigne(s) a {{task}}.',
        task: toLabel(
          context?.taskTitle,
          i18next.t('celebrationCatalog.fallbacks.thisTask', 'cette tâche'),
        ),
        ...SANS_ECHAPPEMENT,
      }),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.organisation', 'ORGANISATION'),
      title: i18next.t('celebrationCatalog.eventTaskMembersAssigned.title', 'Affectation terminée'),
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
      body: i18next.t(
        'celebrationCatalog.eventTaskVolunteerSent.body',
        'Ta proposition pour {{task}} a bien été prise en compte.',
        {
          task: toLabel(
            context?.taskTitle,
            i18next.t('celebrationCatalog.fallbacks.thisTask', 'cette tâche'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.organisation', 'ORGANISATION'),
      title: i18next.t('celebrationCatalog.eventTaskVolunteerSent.title', 'Volontariat enregistre'),
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
      body: i18next.t(
        'celebrationCatalog.eventTasksCovered.body',
        'Toutes les tâches de {{event}} sont maintenant couvertes.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.theEvent', "l'evenement"),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.organisation', 'ORGANISATION'),
      title: i18next.t('celebrationCatalog.eventTasksCovered.title', 'Organisation complète'),
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
      body: i18next.t(
        'celebrationCatalog.eventUpdated.body',
        '{{event}} a été mis à jour.',
        {
          event: toLabel(
            context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.theEventCap', "L'evenement"),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.event', 'EVENEMENT'),
      title: i18next.t('celebrationCatalog.eventUpdated.title', 'Mise à jour enregistrée'),
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
      body: i18next.t(
        'celebrationCatalog.leagueFirstVictory.body',
        '{{team}} signe sa première victoire League.',
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourTeamCap', 'Ton équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueFirstVictory.title', 'Première victoire'),
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
      body: i18next.t(
        'celebrationCatalog.leagueMatchFound.body',
        '{{team}} a maintenant un adversaire.',
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourSquadCap', 'Ta squad'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueMatchFound.title', 'Match trouve'),
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
      body: i18next.t(
        'celebrationCatalog.leagueMatchValidated.body',
        'Le résultat de {{match}} est maintenant valide.',
        {
          match: toLabel(
            context?.matchLabel || context?.eventName,
            i18next.t('celebrationCatalog.fallbacks.yourMatch', 'ton match'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueMatchValidated.title', 'Score valide'),
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
      body: i18next.t(
        'celebrationCatalog.leagueProposalAccepted.body',
        'Le match contre {{opponent}} est confirmé.',
        {
          opponent: toLabel(
            context?.opponentName,
            i18next.t('celebrationCatalog.fallbacks.theOpponent', "l'adversaire"),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueProposalAccepted.title', 'Proposition acceptée'),
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
      body: i18next.t(
        'celebrationCatalog.leagueQuorumReached.body',
        '{{team}} à son effectif pour jouer.',
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourSquadCap', 'Ta squad'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueQuorumReached.title', 'Quorum atteint'),
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
      body: buildStreakBody(context, (count) => i18next.t(
        'celebrationCatalog.leagueVictoryStreak.body',
        {
          count,
          defaultValue_one: 'Tu enchaines {{count}} victoire. Continue comme ca.',
          defaultValue_other: 'Tu enchaines {{count}} victoires. Continue comme ca.',
        },
      )),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueVictoryStreak.title', 'Série de victoires'),
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
      body: i18next.t(
        'celebrationCatalog.leagueWeekendWin.body',
        '{{team}} a gagne ce week-end contre {{opponent}}.',
        {
          opponent: toLabel(
            context?.opponentName,
            i18next.t('celebrationCatalog.fallbacks.theOpponent', "l'adversaire"),
          ),
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourTeamCap', 'Ton équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: 'LEAGUE',
      title: i18next.t('celebrationCatalog.leagueWeekendWin.title', 'Victoire du week-end'),
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
      body: i18next.t(
        'celebrationCatalog.licenseAvailable.body',
        'La licence officielle est maintenant disponible dans ton espace.',
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.license', 'LICENCE'),
      title: i18next.t('celebrationCatalog.licenseAvailable.title', 'Licence disponible'),
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
      body: i18next.t(
        'celebrationCatalog.licensePaymentConfirmed.body',
        'Le paiement de {{license}} a bien été confirmé.',
        {
          license: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourLicense', 'ta licence'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.license', 'LICENCE'),
      title: i18next.t('celebrationCatalog.licensePaymentConfirmed.title', 'Paiement confirme'),
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
      body: i18next.t(
        'celebrationCatalog.officialLicenseUploaded.body',
        'La copie officielle est disponible pour le membre concerne.',
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.license', 'LICENCE'),
      title: i18next.t(
        'celebrationCatalog.officialLicenseUploaded.title',
        'Licence officielle ajoutée',
      ),
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
      body: i18next.t(
        'celebrationCatalog.teamCreated.body',
        '{{team}} est prête à accueillir ses membres.',
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourTeamCap', 'Ton équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.team', 'EQUIPE'),
      title: i18next.t('celebrationCatalog.teamCreated.title', 'Équipe créée'),
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
      body: i18next.t(
        'celebrationCatalog.teamMembershipConfirmed.body',
        'Tu fais maintenant partie de {{team}}.',
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.yourTeam', 'ton équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.team', 'EQUIPE'),
      title: i18next.t('celebrationCatalog.teamMembershipConfirmed.title', 'Adhésion confirmée'),
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
      body: i18next.t(
        'celebrationCatalog.teamMembershipRequestSent.body',
        'Ta demande pour rejoindre {{team}} a bien été envoyée.',
        {
          team: toLabel(
            context?.teamName,
            i18next.t('celebrationCatalog.fallbacks.thisTeam', 'cette équipe'),
          ),
          ...SANS_ECHAPPEMENT,
        },
      ),
      eyebrow: i18next.t('celebrationCatalog.eyebrows.team', 'EQUIPE'),
      title: i18next.t('celebrationCatalog.teamMembershipRequestSent.title', 'Demande envoyée'),
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
  if (type === NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND) return 'league_match_found';
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
