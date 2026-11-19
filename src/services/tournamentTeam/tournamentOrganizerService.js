import { useQuery } from '@tanstack/react-query';

import client from '@/services/client';

// IMPL-3-ORGA (18/11/2026, page 1 des planches T-DESIGN-TOURNOI) — LA PAGE DE L ORGANISATEUR.
// Cinq routes réservées à l'organisateur (ou au SuperAdmin) :
// admin `tournament-team/services/tournament-organizer.js`.

/**
 * Les chiffres de la page : inscrites, validées, places payées, encaissé, et une ligne par équipe
 * (capitaine, « N payés sur 5 », joueurs à relancer, places payées).
 * @param {string} eventId - Le tournoi.
 * @returns {Promise<any>} Le résumé.
 */
export const getTournamentOrganizerSummary = async (eventId) => {
  const response = await client.get(`/events/${eventId}/tournament/organizer`);
  return response?.data?.data || null;
};

/**
 * La clef du résumé de l'organisateur (à invalider après un geste sur une équipe).
 * @param {string} eventId - Le tournoi.
 * @returns {string[]} La clef react-query.
 */
export const tournamentOrganizerSummaryKey = (eventId) => ['tournament-organizer', eventId];

/**
 * Le résumé, lu seulement pour qui pilote (`enabled`).
 * @param {string} eventId - Le tournoi.
 * @param {object} [options] - Options react-query de plus.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Le résumé.
 */
export const useTournamentOrganizerSummary = (eventId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getTournamentOrganizerSummary(eventId),
  queryKey: tournamentOrganizerSummaryKey(eventId),
  staleTime: 15_000,
  ...options,
});

/**
 * « Relancer ceux qui n'ont pas payé » d'une équipe.
 * @param {string} teamId - L'équipe.
 * @returns {Promise<{ sent: number, skipped: number }>} Relances parties, et joueurs déjà
 *   relancés il y a moins de 12 h.
 */
export const remindTournamentTeamUnpaid = async (teamId) => {
  const response = await client.post(`/tournament-teams/${teamId}/remind-unpaid`);
  return response?.data?.data || { sent: 0, skipped: 0 };
};

/**
 * « Écrire à tous les capitaines » : le groupe du tournoi, créé une fois puis retrouvé.
 * @param {string} eventId - Le tournoi.
 * @returns {Promise<{ chatId: string, created: boolean, excludedCount: number }>} Le groupe.
 */
export const openTournamentCaptainsChat = async (eventId) => {
  const response = await client.post(`/events/${eventId}/tournament/captains-chat`);
  return response?.data?.data;
};

/**
 * « Exporter la liste » : le CSV des joueurs, lu en TEXTE, tel quel.
 * @param {string} eventId - Le tournoi.
 * @returns {Promise<string>} Le CSV.
 */
export const exportTournamentPlayers = async (eventId) => {
  const response = await client.get(`/events/${eventId}/tournament/export-players`, {
    responseType: 'text',
    transformResponse: [(/** @type {any} */ brut) => brut],
  });
  return String(response?.data ?? '');
};

/**
 * L'interrupteur « Inscriptions ouvertes / fermées ».
 * @param {string} eventId - Le tournoi.
 * @param {boolean} open - Ouvrir (vrai) ou fermer.
 * @returns {Promise<{ registrationsOpen: boolean }>} L'état écrit.
 */
export const setTournamentRegistrations = async (eventId, open) => {
  const response = await client.post(`/events/${eventId}/tournament/registrations`, {
    data: { open },
  });
  return response?.data?.data;
};
