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
 * Guide Dirigeant·e, fin de B1 (décision « 80- B ») : les 2 membres fictifs de la campagne.
 * @returns {Array<{ documentId: string; firstname: string; lastname: string }>} Profils.
 */
export const exampleCampaignMembers = () => getSimulationRoster('football').slice(0, 2);

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

const EXAMPLE_EVENT_PREFIX = 'tour-example-event-';

/**
 * Guide Dirigeant·e, M1 ④ : trois événements de la semaine en cours, pour un planning encore vide.
 * Jamais envoyés ; `isExamplePlanningEvent` empêche d'ouvrir leur fiche.
 * @param {{ facility?: any, now?: Date }} [context] - Installation affichée, et date du jour.
 * @returns {any[]} Événements bruts du planning.
 */
export const examplePlanningEvents = ({ facility = null, now = new Date() } = {}) => (
  [[0, 18, 'U13'], [2, 19, 'Seniors'], [4, 17, 'U9']].map(([dayOffset, hour, team]) => {
    const start = new Date(now);
    // Lundi de la semaine en cours, comme la grille.
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7) + Number(dayOffset));
    start.setHours(Number(hour), 0, 0, 0);
    return {
      documentId: `${EXAMPLE_EVENT_PREFIX}${dayOffset}`,
      endAt: new Date(start.getTime() + 90 * 60000).toISOString(),
      facility,
      kind: 'event',
      startAt: start.toISOString(),
      title: i18next.t('tourExamples.planning.title', 'Exemple · {{team}}', {
        team, ...SANS_ECHAPPEMENT,
      }),
    };
  })
);

/**
 * L'événement vient-il du planning d'exemple du guide ?
 * @param {any} event - Événement du planning.
 * @returns {boolean} Vrai pour un événement d'exemple du guide.
 */
export const isExamplePlanningEvent = (event) => String(event?.documentId || '')
  .startsWith(EXAMPLE_EVENT_PREFIX);
