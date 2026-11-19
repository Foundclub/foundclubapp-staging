// PAIEMENTS-10E (19/11, planche 10e) — L EQUIPE D UNE PLACE DE TOURNOI, pour « Mes paiements ».
// `/licenses/me` ne rend pas l equipe d une place : elle se lit sur la fiche du tournoi (la meme
// requete et le meme cache `['event', id]` que la fiche), l equipe ou le lecteur est ACTIF.
// ⛔ Fichier a part, charge seulement quand une place nomme son tournoi (`MyLicenses.js`) : la
// requete d evenement tire tout le client HTTP, que les temoins de « Mes paiements » ne
// chargent pas.

import {
  getTournamentViewerMember,
  isTournamentActiveMemberStatus,
} from '@/views/event/tournamentUtils';

import { useGetEvent } from '@/services/event/eventQueries';

/**
 * Le nom de l equipe active du lecteur dans ce tournoi.
 * @param {string} eventId l evenement du tournoi (`campaign.targetConfig.eventId`)
 * @param {string} viewerId le compte connecte
 * @returns {string} le nom, ou une chaine vide
 */
export default function useTournamentTeamName(eventId, viewerId) {
  const { data: event } = useGetEvent(eventId);
  const teams = Array.isArray(event?.tournamentTeams) ? event.tournamentTeams : [];
  const team = teams.find((item) => (
    getTournamentViewerMember(item, viewerId, isTournamentActiveMemberStatus)
  ));
  return String(team?.name || '');
}
