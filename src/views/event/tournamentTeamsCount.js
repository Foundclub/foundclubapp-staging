import i18next from 'i18next';

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
 * Une équipe inscrite : en attente ou validée, non archivée (ni refusée, ni archivée).
 * @param {any} team - L'équipe du tournoi.
 * @returns {boolean} Vrai si elle compte parmi les inscrites.
 */
export const isTournamentTeamRegistered = (team) => Boolean(
  team && !team.archivedAt
  && STATUTS_INSCRITS.includes(String(team.status || 'pending').toLowerCase()),
);

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
  return event.tournamentTeams.filter(isTournamentTeamRegistered).length;
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

/**
 * FICHE-TOURNOI (19/11/2026, écran 8b) — la tête de l'onglet Équipes pour qui n'organise pas le
 * tournoi : « 9 équipes inscrites · 15 places libres », dès le seuil des 30 % seulement (règle
 * « 4- A ») ; sous le seuil, ou sans nombre connu : `null` (la ligne d'avant reste). Les nombres
 * viennent du résumé que le serveur rend à toute fiche (`tournamentTeamsSummary`).
 * Témoin : __tests__/FICHE-TOURNOI.regles.test.js.
 * @param {any} event - Le tournoi.
 * @returns {string | null} La ligne, ou `null`.
 */
export const getTournamentTeamsTabLine = (event) => {
  if (!isTournamentTeamsCountShown(event)) return null;
  const inscrites = Number(getTournamentRegisteredTeamsCount(event));
  const libres = Math.max(0, Number(getTournamentTeamsCapacity(event)) - inscrites);
  return [
    i18next.t('ficheTournoi.teamsRegistered', {
      count: inscrites,
      defaultValue_one: '{{count}} équipe inscrite',
      defaultValue_other: '{{count}} équipes inscrites',
    }),
    i18next.t('ficheTournoi.freePlaces', {
      count: libres,
      defaultValue_one: '{{count}} place libre',
      defaultValue_other: '{{count}} places libres',
    }),
  ].join(' · ');
};
