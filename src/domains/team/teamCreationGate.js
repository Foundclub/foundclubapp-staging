import { getActiveClubId, getUserRoleKey } from '@/domains/auth/authUseCases';

/**
 * LE JUGE D'ENTRÉE DU TUNNEL D'ÉQUIPE — lot EQUIPES (2026-08-28).
 *
 * 🔴 LE DÉFAUT QU'IL RÉPARE (recette d'Adel du 28/08, club SMUC) : le tunnel de
 * création d'équipe faisait remplir HUIT écrans, puis affichait à la 8/8 une
 * fenêtre « Erreur » disant, en anglais,
 * `User is not an authorized staff member of this club`.
 *
 * ⚠️ TROIS CHOSES DIFFÉRENTES SE CACHENT DERRIÈRE « je ne peux pas créer », et
 * les confondre est ce qui a coûté huit écrans de saisie :
 *   ① ÊTRE AFFILIÉ  — mon adhésion à ce club est-elle ACCEPTÉE ? Une demande
 *      `pending` n'est PAS une affiliation : le serveur
 *      (`admin/src/api/club/services/auth.ts`, `getClubAuthorizationContext`)
 *      ne regarde que `club.members` / `user.club` / `user.clubAffiliations`.
 *      C'est le cas réel d'Adel, et le refus du serveur était JUSTE.
 *   ② AVOIR LE DROIT — ce club autorise-t-il ses entraîneur·es à créer des
 *      équipes ? (`club.teamCreationManagementMode`, réglage du dirigeant)
 *   ③ AVOIR LA PLACE — le club a-t-il encore une équipe disponible dans son
 *      offre ? C'est le portier d'abonnement, et il reste au SERVEUR.
 *
 * 🔒 CE JUGE NE TRANCHE QUE ① ET ②, jamais ③, et c'est délibéré : l'app ne
 * connaît ni les créneaux d'équipe payés (`TEAM_SLOT_AVAILABLE`) ni le palier
 * du club. Bloquer ici sur un compteur gratuit à zéro refuserait un abonné qui
 * a le droit de créer. Pour ③ on AVERTIT à l'entrée, et c'est le refus serveur
 * qui ouvre le mur payant existant, avec les mots d'Adel.
 *
 * ⛔ Il ne remplace AUCUN contrôle serveur : `is-team-staff-create.ts` refait
 * les trois, dans cet ordre, et c'est lui qui fait autorité.
 */

/** Les raisons de blocage, telles que l'écran d'entrée les nomme. */
export const TEAM_CREATION_BLOCK = /** @type {const} */({
  affiliationPending: 'AFFILIATION_PENDING',
  coachNotAllowed: 'COACH_NOT_ALLOWED',
});

/** Les deux réglages du dirigeant, tels que le serveur les écrit sur le club. */
export const TEAM_CREATION_MODE = /** @type {const} */({
  clubOwnerOnly: 'CLUB_OWNER_ONLY',
  coachAllowed: 'COACH_ALLOWED',
});

const normalizeId = (/** @type {any} */ value) => String(value || '').trim();

/**
 * L'adhésion à ce club est-elle encore une simple DEMANDE en attente ?
 *
 * Répond `true` seulement quand les deux moitiés sont vraies : aucun club
 * accepté d'un côté, une demande `pending` sur CE club de l'autre. C'est
 * exactement l'état dans lequel `resolveMyClubDocumentId` laisse entrer dans le
 * tunnel (`authUseCases.js`) — on ne retire pas cette entrée, on la rend
 * lisible.
 * @param {any} userData Le profil connecté.
 * @param {string} clubId Le club visé par la création.
 * @returns {boolean} Vrai si l'affiliation n'est qu'une demande en attente.
 */
export const isClubAffiliationPending = (userData, clubId) => {
  const normalizedClubId = normalizeId(clubId);
  if (!normalizedClubId) return false;

  const requests = Array.isArray(userData?.clubMembershipRequests)
    ? userData.clubMembershipRequests
    : [];
  const hasPendingRequest = requests.some((/** @type {any} */ request) => (
    request?.state === 'pending'
    && normalizeId(request?.club?.documentId || request?.club?.id) === normalizedClubId
  ));
  if (!hasPendingRequest) return false;

  // Une adhésion acceptée l'emporte toujours sur une demande restée en base.
  return normalizeId(getActiveClubId(userData)) !== normalizedClubId;
};

/**
 * Ce club autorise-t-il ses entraîneur·es à créer des équipes ?
 *
 * ⚠️ Le défaut est `COACH_ALLOWED`, parce que c'est CE QUI SE PASSE
 * AUJOURD'HUI : `isClubStaffMember` accepte `['dirigeant', 'entraineur']` par
 * défaut. Un club existant qui n'a jamais touché au réglage ne doit rien voir
 * changer.
 * @param {any} club Le club, tel que `GET /clubs/:id` le rend.
 * @returns {boolean} Vrai si les entraîneur·es peuvent créer.
 */
export const clubAllowsCoachTeamCreation = (club) => (
  String(club?.teamCreationManagementMode || TEAM_CREATION_MODE.coachAllowed).trim()
    !== TEAM_CREATION_MODE.clubOwnerOnly
);

/**
 * Ce club exige-t-il qu'un dirigeant valide les équipes créées par ses coachs ?
 * @param {any} club Le club, tel que `GET /clubs/:id` le rend.
 * @returns {boolean} Vrai si la validation est exigée.
 */
export const clubRequiresTeamApproval = (club) => (
  club?.teamCreationByCoachesRequiresValidation === true
);

/**
 * Le compte agit-il en tant qu'entraîneur (et non en dirigeant du club) ?
 * @param {any} userData Le profil connecté.
 * @returns {boolean} Vrai pour un rôle entraîneur.
 */
export const actsAsCoach = (userData) => getUserRoleKey(userData?.role?.name) === 'coach';

/**
 * LA DÉCISION D'ENTRÉE, rendue en une seule fois pour l'écran 1/8.
 * @param {{ club?: any, userData?: any }} params Le club visé et le profil.
 * @returns {{
 *   blockReason: string | null,
 *   isAllowed: boolean,
 *   message: string,
 *   requiresClubApproval: boolean,
 *   title: string,
 * }} La décision, avec le texte exact à afficher.
 */
export const resolveTeamCreationGate = ({ club = null, userData = null } = {}) => {
  const clubId = normalizeId(club?.documentId || club?.id);
  const clubName = String(club?.name || '').trim();
  const clubLabel = clubName || 'ton club';

  if (clubId && isClubAffiliationPending(userData, clubId)) {
    return {
      blockReason: TEAM_CREATION_BLOCK.affiliationPending,
      isAllowed: false,
      message: `Ton adhésion à ${clubLabel} n'est pas encore validée. Un dirigeant du club `
        + "doit d'abord accepter ta demande : tu pourras créer ton équipe juste après. "
        + 'Inutile de remplir le formulaire maintenant, il serait refusé à la dernière étape.',
      requiresClubApproval: false,
      title: 'Ton adhésion est en attente',
    };
  }

  if (club && actsAsCoach(userData) && !clubAllowsCoachTeamCreation(club)) {
    return {
      blockReason: TEAM_CREATION_BLOCK.coachNotAllowed,
      isAllowed: false,
      message: `${clubLabel} a choisi que seuls ses dirigeants créent les équipes. `
        + 'Demande à un dirigeant de créer la tienne, ou de te donner ce droit dans les '
        + 'réglages du club.',
      requiresClubApproval: false,
      title: 'Ce club réserve la création aux dirigeants',
    };
  }

  return {
    blockReason: null,
    isAllowed: true,
    message: '',
    requiresClubApproval: Boolean(club) && actsAsCoach(userData) && clubRequiresTeamApproval(club),
    title: '',
  };
};

export default resolveTeamCreationGate;
