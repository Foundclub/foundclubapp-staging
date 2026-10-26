/**
 * C10BIS · P12-05 — une equipe peut-elle se relier a une competition federale (FFBB) ?
 *
 * La meme regle que le serveur (`admin/src/api/firebase-auth/services/firebase-auth.ts`,
 * `isExternalCompetitionEligibleTeam`, et `team/services/scraper.ts`) : une de ses activites
 * est le basket ou le football. L'ecran de l'equipe ne la lisait que dans les equipes DU
 * COMPTE (`myTeams` / `trainedTeams`) : un president hors de l'equipe, que le serveur autorise
 * pourtant, ne voyait jamais « Configurer ».
 * ⚠️ Liste a garder alignee sur `EXTERNAL_COMPETITION_ELIGIBLE_SPORTS` du serveur.
 */
const SPORTS_ELIGIBLES = new Set(['basket', 'basketball', 'football']);

const normaliser = (/** @type {unknown} */ valeur) => String(valeur || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

/**
 * L'equipe joue-t-elle un sport qu'une federation synchronise ?
 * @param {any} team - L'equipe (avec `activities`), ou son resume de profil.
 * @returns {boolean}
 */
export const isExternalCompetitionEligibleTeam = (team) => {
  if (team?.externalCompetitionEligible === true) return true;
  const activites = Array.isArray(team?.activities) ? team.activities : [];
  return activites.some((/** @type {any} */ activite) => (
    SPORTS_ELIGIBLES.has(normaliser(activite?.name))
  ));
};
