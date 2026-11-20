// PAIEMENTS-10E (19/11, planche 10e) — L EQUIPE D UNE PLACE DE TOURNOI, pour « Mes paiements ».
// `/licenses/me` ne rend pas l equipe d une place : elle se lit sur la fiche du tournoi (meme cle
// de cache `['event', id]` et meme appel que la fiche, `useGetEvent`), l equipe ou le lecteur est
// ACTIF. Appele seulement par la carte d une place qui nomme son tournoi (`MyLicenses.js`).

import { useQuery } from '@tanstack/react-query';

import useAuth from '@/domains/auth/useAuth';

import {
  getTournamentViewerMember,
  isTournamentActiveMemberStatus,
  isTournamentTeamSetAside,
} from '@/views/event/tournamentUtils';

import { EVENT_DETAIL_STALE_MS } from '@/services/event/eventCacheDurations';

/**
 * Les equipes du tournoi telles que la fiche les rend au lecteur (ses equipes y sont toutes, quel
 * que soit leur statut : IMPL-5E, admin `selectTournamentTeamsForReader`).
 * @param {string} eventId l evenement du tournoi
 * @returns {{ isSuccess: boolean, teams: any[] }} les equipes, et si la fiche a ete lue
 */
const useTournamentEventTeams = (eventId) => {
  const { data: event, isSuccess } = useQuery({
    enabled: Boolean(eventId),
    queryFn: async () => (await import('@/services/event/eventService')).getEventById(eventId),
    queryKey: ['event', eventId],
    refetchOnMount: false,
    staleTime: EVENT_DETAIL_STALE_MS,
  });
  const rows = event?.tournamentTeams;
  return { isSuccess: Boolean(isSuccess), teams: Array.isArray(rows) ? rows : [] };
};

/**
 * Le nom de l equipe active du lecteur dans ce tournoi.
 * ponytail: `useGetEvent` refait ici (meme cle, meme appel) parce qu importer `eventQueries` tire
 * tout le client HTTP au chargement de « Mes paiements », que ses temoins ne savent pas charger ;
 * le service est charge a l appel (`import()` : le site sait, Jest non, d ou le mock des
 * temoins). Sortie : un mock commun du client dans le setup jest.
 * @param {string} eventId l evenement du tournoi (`campaign.targetConfig.eventId`)
 * @param {string} viewerId le compte connecte
 * @returns {string} le nom, ou une chaine vide
 */
export default function useTournamentTeamName(eventId, viewerId) {
  const { teams } = useTournamentEventTeams(eventId);
  const team = teams.find((item) => (
    getTournamentViewerMember(item, viewerId, isTournamentActiveMemberStatus)
  ));
  return String(team?.name || '');
}

/**
 * RECOLTE-APP-51 (20/11, M1365 bis) — LA PLACE DU LECTEUR NE SE PAIE PLUS : toutes ses equipes du
 * tournoi (celles ou il est membre actif) sont refusees ou retirees (archivees). C est la regle du
 * serveur (`isClosedTeam`, refus TOURNAMENT_TEAM_CLOSED), lue sur la fiche du tournoi. Preuve
 * POSITIVE seulement : fiche non lue (chargement, erreur, pas d evenement) ou une equipe active
 * (place transferee, D282) => `false`, la page reste comme avant (le serveur refuse de toute
 * facon). ponytail: `/licenses/me` ne dit pas l equipe de la place ; on la deduit des equipes du
 * lecteur. Un joueur dont l equipe active est ailleurs mais dont la place non payee est restee sur
 * l equipe refusee verra encore « Payer » (refus du serveur). Sortie : un drapeau
 * `tournamentTeamClosed` rendu par `getMine` / `getMineAssignment` (lot admin).
 * @param {string} eventId l evenement du tournoi (`campaign.targetConfig.eventId`), vide hors
 * tournoi
 * @returns {boolean} vrai si la place ne se paie plus
 */
export function useTournamentPlaceClosed(eventId) {
  const { userData } = useAuth();
  const viewerId = String(userData?.documentId || '');
  const { isSuccess, teams } = useTournamentEventTeams(eventId);
  if (!eventId || !viewerId || !isSuccess) return false;
  const mine = teams.filter((item) => (
    getTournamentViewerMember(item, viewerId, isTournamentActiveMemberStatus)
  ));
  return mine.length > 0 && mine.every(isTournamentTeamSetAside);
}
