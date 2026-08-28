/**
 * H6 — LES BORNES DE SAISIE D'UN BILAN DE MATCH, EN UN SEUL ENDROIT.
 *
 * ⚠️ CES TROIS NOMBRES SONT RECOPIÉS CÔTÉ SERVEUR et les deux copies se déplacent
 * ENSEMBLE : `admin/src/api/match-stats-report/services/match-stats-report.ts`
 * (`MAX_MATCH_SCORE`, `MAX_MINUTES_PLAYED`, `MAX_STAT_VALUE`).
 *
 * Depuis SCORE1, le serveur REFUSE explicitement ce qui dépasse, au lieu de
 * raboter en silence — un `-5` ne devient plus `0`, un `2,7` ne devient plus `3`,
 * et `999999999` n'est plus écrit en base. Si l'app laissait taper au-delà, le
 * joueur remplirait tout son formulaire pour se prendre un refus à l'envoi.
 * Une valeur différente ici et là-bas, c'est ce refus-là.
 */

/** Prolongations comprises. Au-delà, c'est une faute de frappe. */
export const MAX_MINUTES_PLAYED = 240;
/** Le plafond qu'affichait déjà l'app ; ce qui change, c'est qu'on refuse au-dessus. */
export const MAX_STAT_VALUE = 999;
/** Un score de match. `999999999 - 0` était accepté et écrit en base. */
export const MAX_MATCH_SCORE = 999;

/**
 * Le plafond d'un champ de statistique, quand rien de plus fin ne s'applique.
 *
 * ⚠️ Ce n'est PAS le plafond final : `MatchStatsEditor` calcule des bornes plus
 * serrées à partir du score (on ne marque pas 4 buts dans un match gagné 2-0).
 * Celui-ci est le filet de dernier recours, celui qui valait `999` pour TOUT,
 * minutes comprises.
 * @param {string} field Le nom du champ saisi (`minutesPlayed`, `points`, …).
 * @returns {number} La valeur maximale acceptée pour ce champ.
 */
export const getMatchStatsFieldMax = (field) => (
  field === 'minutesPlayed' ? MAX_MINUTES_PLAYED : MAX_STAT_VALUE
);

/**
 * Ramène une saisie clavier à un entier positif borné, sous forme de texte.
 * @param {any} value La valeur brute tapée.
 * @param {number} max Le plafond accepté.
 * @returns {string} L'entier borné, ou `''` si le champ est vide.
 */
export const clampMatchStatsValue = (value, max = MAX_STAT_VALUE) => {
  const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');
  if (!digitsOnly) return '';
  const parsed = Number.parseInt(digitsOnly, 10) || 0;
  return String(Math.max(0, Math.min(max, parsed)));
};

export default getMatchStatsFieldMax;
