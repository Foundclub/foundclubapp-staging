// PAIEMENTS-10E (19/11, planche 10e) — L EQUIPE D UNE PLACE DE TOURNOI, pour « Mes paiements ».
// `/licenses/me` ne rend pas l equipe d une place : elle se lit sur la fiche du tournoi (meme cle
// de cache `['event', id]` et meme appel que la fiche, `useGetEvent`), l equipe ou le lecteur est
// ACTIF. Appele seulement par la carte d une place qui nomme son tournoi (`MyLicenses.js`).

import { useQuery } from '@tanstack/react-query';

import {
  getTournamentViewerMember,
  isTournamentActiveMemberStatus,
} from '@/views/event/tournamentUtils';

import { EVENT_DETAIL_STALE_MS } from '@/services/event/eventCacheDurations';

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
  const { data: event } = useQuery({
    enabled: Boolean(eventId),
    queryFn: async () => (await import('@/services/event/eventService')).getEventById(eventId),
    queryKey: ['event', eventId],
    refetchOnMount: false,
    staleTime: EVENT_DETAIL_STALE_MS,
  });
  const rows = event?.tournamentTeams;
  const teams = Array.isArray(rows) ? rows : [];
  const team = teams.find((item) => (
    getTournamentViewerMember(item, viewerId, isTournamentActiveMemberStatus)
  ));
  return String(team?.name || '');
}
