/**
 * H1 — UN ÉCRAN VIDE DIT POURQUOI IL EST VIDE.
 *
 * Huit conditions en série peuvent fermer la liste des bilans de match, et
 * chacune était un `continue` MUET côté serveur : quand une seule se fermait,
 * il ne se passait RIEN — pas de message, pas d'erreur, pas de trace. C'est
 * exactement ce qu'a vécu Adel le 26/08 (« le pop-up ne marche pas »).
 *
 * Le serveur rend désormais une CAUSE (`emptyReason`) ; ce fichier la traduit en
 * PHRASE. Le partage est volontaire : la règle vit côté serveur, les mots côté
 * app, et on peut changer les mots sans redéployer le serveur.
 *
 * ⛔ Jamais d'écran blanc sans un mot : `UNKNOWN_EMPTY_REASON` est le filet, il
 * couvre le cas d'un serveur plus ancien qui n'envoie encore aucune cause.
 */

/** Les causes que le serveur sait nommer (`match-stats-report.ts`). */
export const MATCH_STATS_EMPTY_REASONS = Object.freeze({
  MATCH_NOT_FINISHED: 'match_not_finished',
  NO_TEAM: 'no_team',
  NOTHING_PENDING: 'nothing_pending',
  SPORT_NOT_SUPPORTED: 'sport_not_supported',
  SUPERADMIN: 'superadmin_account',
});

const EXPLANATIONS = Object.freeze({
  [MATCH_STATS_EMPTY_REASONS.MATCH_NOT_FINISHED]: {
    body: "Le bilan s'ouvre une fois l'heure de fin passée. Reviens après le coup de "
      + 'sifflet final.',
    title: "Ton match n'est pas encore terminé",
  },
  [MATCH_STATS_EMPTY_REASONS.NO_TEAM]: {
    body: "Tu n'es joueur ni entraîneur d'aucune équipe. Rejoins une équipe pour "
      + 'recevoir les bilans de ses matchs.',
    title: 'Aucune équipe rattachée à ton compte',
  },
  [MATCH_STATS_EMPTY_REASONS.NOTHING_PENDING]: {
    body: 'Quand un match terminé demandera encore une action, elle apparaîtra ici '
      + 'automatiquement.',
    title: 'Aucune action en attente',
  },
  [MATCH_STATS_EMPTY_REASONS.SPORT_NOT_SUPPORTED]: {
    body: 'La saisie du score et des statistiques ne couvre pour le moment que le '
      + 'football et le basket.',
    title: "Le sport de ton équipe n'est pas encore géré",
  },
  [MATCH_STATS_EMPTY_REASONS.SUPERADMIN]: {
    body: "Le serveur ne propose jamais de bilan de match aux comptes d'administration. "
      + 'Pour tester la saisie, connecte-toi avec un compte joueur ou entraîneur '
      + "d'une équipe de football ou de basket.",
    title: 'Ton compte ne peut pas saisir ici',
  },
});

/** Le filet : un serveur plus ancien n'envoie aucune cause. */
export const UNKNOWN_EMPTY_REASON = Object.freeze({
  body: 'Quand un match terminé demandera encore une action, elle apparaîtra ici '
    + 'automatiquement.',
  title: 'Aucune action en attente',
});

/**
 * La phrase à afficher quand la liste des bilans est vide.
 * @param {string | null | undefined} reason La cause rendue par le serveur.
 * @returns {{ body: string, title: string }} Le titre et l'explication.
 */
export const describeMatchStatsEmptyReason = (reason) => (
  EXPLANATIONS[String(reason || '').trim()] || UNKNOWN_EMPTY_REASON
);

export default describeMatchStatsEmptyReason;
