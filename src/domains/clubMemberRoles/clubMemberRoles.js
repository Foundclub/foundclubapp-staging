/**
 * LOT RÔLES (demande d'Adel du 2026-09-28) — la logique PURE de l'écran
 * « Membres et rôles ». Aucun import de client HTTP : n'importe quel écran ou
 * test peut la charger sans doubler le réseau.
 *
 * Le serveur (`GET /clubs/:id/member-roles`) rend, pour chaque membre, ses
 * équipes comme joueur (`playerTeamIds`) et comme entraîneur (`trainerTeamIds`),
 * et s'il est dirigeant (`isManager`). Un membre peut cumuler les trois.
 */

/** @typedef {'player' | 'coach' | 'manager'} MemberRoleKind */

/**
 * @typedef {object} ClubMemberRoleRow
 * @property {string} documentId - Identifiant du compte.
 * @property {string} firstname - Prénom.
 * @property {string} lastname - Nom.
 * @property {string | null} avatarUrl - Photo.
 * @property {boolean} isManager - Dirigeant (rôle global).
 * @property {boolean} isSelf - C'est le lecteur.
 * @property {string} roleKey - Rôle global : president / coach / player / parent / superAdmin.
 * @property {string[]} playerTeamIds - Équipes où il joue.
 * @property {string[]} trainerTeamIds - Équipes qu'il entraîne.
 */

/**
 * @typedef {object} MemberRoleChange
 * @property {'add' | 'remove'} action - Donner ou retirer.
 * @property {MemberRoleKind} role - Le rôle.
 * @property {string} [teamDocumentId] - L'équipe (joueur / entraîneur).
 * @property {string} userDocumentId - Le membre.
 */

/** @type {ClubMemberRoleRow[]} */
const EMPTY_LIST = [];

/**
 * Le membre a-t-il déjà ce rôle ?
 * @param {ClubMemberRoleRow | null | undefined} member - Le membre.
 * @param {MemberRoleKind} role - Le rôle.
 * @param {string} [teamId] - L'équipe, pour joueur / entraîneur.
 * @returns {boolean} Vrai s'il l'a.
 */
export const hasMemberRole = (member, role, teamId) => {
  if (!member) return false;
  if (role === 'manager') return member.isManager === true;
  const seats = role === 'player' ? member.playerTeamIds : member.trainerTeamIds;
  return Array.isArray(seats) && seats.includes(String(teamId || ''));
};

/**
 * Le changement qu'un appui demande : donner le rôle s'il manque, le retirer sinon.
 * @param {ClubMemberRoleRow} member - Le membre.
 * @param {MemberRoleKind} role - Le rôle.
 * @param {string} [teamId] - L'équipe, pour joueur / entraîneur.
 * @returns {MemberRoleChange} Le changement.
 */
export const buildMemberRoleChange = (member, role, teamId) => {
  /** @type {MemberRoleChange} */
  const change = {
    action: hasMemberRole(member, role, teamId) ? 'remove' : 'add',
    role,
    userDocumentId: String(member?.documentId || ''),
  };
  return role === 'manager' ? change : { ...change, teamDocumentId: String(teamId || '') };
};

/**
 * Ce changement mérite-t-il une confirmation ?
 *
 * Mettre quelqu'un joueur est un geste léger, qui se défait d'un appui. Tout
 * RETRAIT se confirme, et toute PROMOTION aussi : nommer entraîneur un joueur
 * lui donne le rôle global Entraîneur, nommer co-dirigeant lui donne tout le club.
 * @param {MemberRoleChange} change - Le changement.
 * @param {ClubMemberRoleRow} member - Le membre.
 * @returns {boolean} Vrai s'il faut demander.
 */
export const memberRoleChangeNeedsConfirmation = (change, member) => {
  if (change.action === 'remove') return true;
  if (change.role === 'manager') return true;
  if (change.role === 'coach') {
    return member?.roleKey !== 'coach' && member?.roleKey !== 'president';
  }
  return false;
};

/**
 * La liste à l'écran : le lecteur en tête (« Toi »), puis l'ordre du serveur (par nom).
 * @param {ClubMemberRoleRow[] | null | undefined} members - Les membres.
 * @returns {ClubMemberRoleRow[]} La liste ordonnée.
 */
export const sortMembersForDisplay = (members) => {
  const list = Array.isArray(members) ? members : EMPTY_LIST;
  return [...list.filter((member) => member?.isSelf), ...list.filter((member) => !member?.isSelf)];
};

/**
 * Filtre par nom, sans casse ni accents.
 * @param {ClubMemberRoleRow[]} members - Les membres.
 * @param {string} query - Ce qui est tapé.
 * @returns {ClubMemberRoleRow[]} Ceux qui correspondent.
 */
export const filterMembersByName = (members, query) => {
  const normalize = (/** @type {unknown} */ value) => String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  const needle = normalize(query);
  if (!needle) return members;
  return members.filter(
    (member) => normalize(`${member?.firstname} ${member?.lastname}`).includes(needle),
  );
};

/**
 * Remplace une ligne par sa version à jour (celle que rend le serveur).
 * @param {{ members?: ClubMemberRoleRow[] } | undefined} payload - La liste en cache.
 * @param {ClubMemberRoleRow | null | undefined} updated - La ligne à jour.
 * @returns {{ members?: ClubMemberRoleRow[] } | undefined} La liste à jour.
 */
export const replaceMemberRow = (payload, updated) => {
  if (!payload || !updated?.documentId || !Array.isArray(payload.members)) return payload;
  return {
    ...payload,
    members: payload.members.map(
      (member) => (member?.documentId === updated.documentId ? updated : member),
    ),
  };
};
