import i18next from 'i18next';

import { getSimulationRoster } from '@/domains/tactical/simulationRosters';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

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

/**
 * Bonus B1, équipe vide (GUIDE-BONUS, décision d'Adel « 2- A ») : trois faux
 * profils qui répondent « présent » le temps d'une animation, jamais envoyés.
 * @returns {Array<{ documentId: string; firstname: string; lastname: string }>} Profils.
 */
export const exampleResponders = () => getSimulationRoster('football').slice(0, 3);

/**
 * Guide Dirigeant·e, M4 : la carte d'une demande pour rejoindre le club, fausse et dite fausse.
 * Sans `requestId` ni `requesterId` : rien ne peut partir, et « Voir le profil » ne s'affiche pas.
 * @param {{ coachFirstName?: string }} [context] - Prénom du coach ajouté à M2 (décision 10).
 * @returns {any} Ligne de `RequestsHub`, de la forme de `requestMappers`.
 */
export const exampleMembershipRequest = ({ coachFirstName } = {}) => {
  const isSameName = String(coachFirstName || '').trim().toLowerCase() === 'karim';
  const firstName = isSameName ? 'Sami' : 'Karim';
  const requesterName = `${firstName} Benali`;
  return {
    actions: { primary: 'accept', secondary: 'reject' },
    createdAt: '',
    id: 'tour-example-request',
    meta: {
      clubId: '',
      clubName: '',
      example: true,
      requesterAvatarUrl: '',
      requesterId: '',
      requesterName,
      requestId: '',
      requestType: 'join',
    },
    status: 'pending',
    subtitle: i18next.t(
      'tourExamples.request.subtitle',
      '{{name}} demande à rejoindre ton club comme coach.',
      { name: requesterName, ...SANS_ECHAPPEMENT },
    ),
    title: i18next.t('tourExamples.request.title', 'Demande d’affiliation (exemple)'),
    type: 'club',
  };
};

/**
 * Cette ligne est-elle la demande d'exemple du guide ?
 * @param {any} item - Ligne de `RequestsHub`.
 * @returns {boolean} Vrai pour l'exemple.
 */
export const isExampleRequest = (item) => Boolean(item?.meta?.example);
