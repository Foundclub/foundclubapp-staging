import client from '../client';

/** @typedef {import('@/domains/clubMemberRoles/clubMemberRoles').ClubMemberRoleRow} Row */
/** @typedef {import('@/domains/clubMemberRoles/clubMemberRoles').MemberRoleChange} Change */
/** @typedef {{ documentId: string, name: string }} TeamRef */
/** @typedef {{ club: object, members: Row[], teams: TeamRef[] }} Roster */

/**
 * LOT RÔLES (2026-09-28) — la liste des membres d'un club et leurs rôles.
 * `GET /clubs/:id/member-roles` — réservé au dirigeant du club (policy serveur).
 * @param {string} clubId - Le club.
 * @returns {Promise<Roster>} La liste.
 */
export const getClubMemberRoles = async (clubId) => {
  const response = await client.get(`/clubs/${clubId}/member-roles`);
  return response?.data?.data;
};

/**
 * Donner ou retirer un rôle à un membre (joueur / entraîneur d'une équipe,
 * co-dirigeant).
 * @param {string} clubId - Le club.
 * @param {Change} change - Le changement.
 * @returns {Promise<{ changed: boolean, member: Row | null }>} La ligne à jour.
 */
export const updateClubMemberRole = async (clubId, change) => {
  const response = await client.post(`/clubs/${clubId}/member-roles`, change);
  return response?.data?.data;
};
