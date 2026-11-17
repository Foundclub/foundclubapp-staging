import {
  getTournamentVisitorTeamsLine,
  TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT,
} from './tournamentJoinRules';

/**
 * T-PAGES-4 (17/11, décision d'Adel « 4- A ») — combien d'équipes un tournoi a, et si on peut le
 * dire. Une seule lecture pour la fiche du téléphone (EventDetails.js) et la carte des listes
 * (EventCardNew.js, site compris) : le résumé du serveur (`tournamentTeamsSummary`), sinon le même
 * compte que lui (en attente + validées, hors archivées, admin `tournament-teams-summary.js`).
 * La phrase vient de la règle de T-REJOINDRE (`getTournamentVisitorTeamsLine`), non recopiée.
 * ponytail: le seuil se recompare ici avec la constante de tournamentJoinRules.js, qui ne rend
 * qu'une phrase ; sortie : une règle booléenne exportée par ce fichier (T-PAGES-6).
 */

const STATUTS_INSCRITS = ['pending', 'accepted'];

/**
 * La capacité du tournoi (équipes attendues), ou `null`.
 * @param {any} event - Le tournoi.
 * @returns {number | null} La capacité.
 */
export const getTournamentTeamsCapacity = (event) => {
  const capacite = Math.round(Number(
    event?.tournamentTeamsSummary?.expectedCount ?? event?.tournamentConfig?.maxTeams,
  ));
  return Number.isFinite(capacite) && capacite > 0 ? capacite : null;
};

/**
 * Le nombre d'équipes inscrites, ou `null` s'il n'est pas connu (visiteur sans résumé).
 * @param {any} event - Le tournoi.
 * @returns {number | null} Le nombre.
 */
export const getTournamentRegisteredTeamsCount = (event) => {
  const resume = event?.tournamentTeamsSummary?.registeredCount;
  if (resume !== null && resume !== undefined && Number.isFinite(Number(resume))) {
    return Math.round(Number(resume));
  }
  if (!Array.isArray(event?.tournamentTeams)) return null;
  return event.tournamentTeams.filter((team) => (
    team && !team.archivedAt
    && STATUTS_INSCRITS.includes(String(team.status || 'pending').toLowerCase())
  )).length;
};

/**
 * Le nombre d'équipes peut-il se dire (capacité connue et seuil des 30 % atteint) ?
 * @param {any} event - Le tournoi.
 * @returns {boolean} Vrai à partir du seuil.
 */
export const isTournamentTeamsCountShown = (event) => {
  const capacite = getTournamentTeamsCapacity(event);
  const inscrites = getTournamentRegisteredTeamsCount(event);
  if (!capacite || inscrites === null) return false;
  return inscrites >= Math.ceil((capacite * TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT) / 100);
};

/**
 * La phrase du nombre d'équipes : « 24 équipes attendues », puis « 8 équipes inscrites sur 24 » ;
 * `null` sans capacité.
 * @param {any} event - Le tournoi.
 * @returns {string | null} La phrase.
 */
export const getTournamentTeamsLine = (event) => getTournamentVisitorTeamsLine({
  ...event,
  tournamentTeamsSummary: {
    expectedCount: getTournamentTeamsCapacity(event),
    registeredCount: getTournamentRegisteredTeamsCount(event),
  },
});
