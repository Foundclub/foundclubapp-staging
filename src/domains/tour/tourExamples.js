import i18next from 'i18next';

import { getSimulationRoster } from '@/domains/tactical/simulationRosters';

/**
 * Données d'exemple du guide (TUTOE-2, pack `01_ARCHITECTURE.md` §6) : construites
 * côté client, jamais envoyées. Un écran ne les lit QUE s'il reçoit le paramètre
 * de route `tourExample`, et coupe alors ses requêtes et ses mutations.
 */

/**
 * L'écran est-il ouvert sur une donnée d'exemple du guide ?
 * @param {any} params - Paramètres de route.
 * @returns {boolean} Vrai en simulation.
 */
export const isTourExample = (params) => Boolean(params?.tourExample);

/**
 * Sport de l'équipe entraînée (même heuristique que l'ancienne simulation du
 * tour coach), football par défaut.
 * @param {any} userData - Personne connectée.
 * @returns {string} Sport.
 */
export const resolveExampleSport = (userData) => {
  const trainedTeamSport = (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : [])
    .map((/** @type {any} */ team) => team?.activities?.[0]?.name)
    .find(Boolean);
  return trainedTeamSport || userData?.preferredSport || 'football';
};

/**
 * Match « Exemple » contre US Monpeyroux : les paramètres de l'écran de
 * convocation. Ni `eventId` ni `teamId` : aucune requête ne peut partir.
 * @param {{ userData?: any }} [context] - Personne connectée.
 * @returns {Record<string, any>} Paramètres de `MatchCallUpSelection`.
 */
export const exampleMatch = (context = {}) => {
  const sport = resolveExampleSport(context?.userData);
  const teams = Array.isArray(context?.userData?.trainedTeams) ? context.userData.trainedTeams : [];
  return {
    eventTypeLabel: i18next.t('tourExamples.match.label', 'Exemple · contre US Monpeyroux'),
    players: getSimulationRoster(sport),
    sport,
    teamName: String(teams[0]?.name || ''),
    tourExample: 'match',
  };
};
