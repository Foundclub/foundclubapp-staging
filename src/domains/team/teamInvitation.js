/**
 * teamInvitation.js — LES MOTS DU REFUS, et le tri de qui reste a inviter.
 *
 * POURQUOI CE MODULE EXISTE. La route `POST /team-membership-requests/invite`
 * refuse en ANGLAIS : « User already belongs to this team », « User already has
 * a pending invitation for this team »… `toReadableError`
 * (teamMembershipRequestService.js) remonte ce message TEL QUEL, donc l'ecran
 * afficherait une phrase anglaise a un dirigeant francais. Un refus qu'on ne
 * comprend pas est un refus muet : c'est le defaut AB05 sous un autre costume.
 *
 * 🧱 MODULE 100 % PUR — aucun import, aucun reseau, aucun `client`. C'est
 * DELIBERE : `app/.env` n'existe dans AUCUN worktree, donc tout module qui
 * atteint `@/services/client` fait tomber la suite ENTIERE de l'ecran qui
 * l'importe (piege paye aux lots AD01 et BLOQUER). Les fonctions pures vivent
 * ici ; les appels reseau restent dans `services/`.
 */

/**
 * Les refus du serveur, mot pour mot, tels qu'ils arrivent dans
 * `error.message`. Traduire par MESSAGE et non par code parce que le
 * controleur leve des `ValidationError` nues : elles n'ont pas de `code`.
 * @see admin/src/api/team-membership-request/controllers/team-membership-request.ts:712-826
 * @type {Record<string, string>}
 */
const SERVER_REFUSALS = {
  'Invited user is required': 'invitation.incomplete',
  'Invited user not found': 'invitation.unknownUser',
  'Requested team not found': 'invitation.unknownTeam',
  'Team information not provided': 'invitation.incomplete',
  'Team is required': 'invitation.incomplete',
  // 🪤 Celle-ci vient de la POLICY, pas du controleur : elle sort en 403 alors
  // qu'elle ne parle pas de droits. Sans cette ligne, un identifiant d'equipe
  // perime s'afficherait « tu n'as pas le droit », ce qui est faux.
  'Team not found': 'invitation.unknownTeam',
  'User already belongs to this team': 'invitation.alreadyMember',
  'User already has a pending invitation for this team': 'invitation.alreadyInvited',
};

/**
 * Les phrases francaises, par cause. Le repli est ecrit ici plutot qu'a
 * l'ecran pour qu'un seul endroit porte les mots.
 * @type {Record<string, string>}
 */
const FRENCH_BY_CAUSE = {
  'invitation.alreadyInvited': 'Cette personne a déjà une invitation en attente pour cette équipe.',
  'invitation.alreadyMember': 'Cette personne fait déjà partie de l\'équipe.',
  'invitation.forbidden': 'Tu n\'as pas le droit d\'inviter dans cette équipe.',
  'invitation.incomplete': 'Informations incomplètes : impossible d\'envoyer l\'invitation.',
  'invitation.unknownTeam': 'Cette équipe est introuvable.',
  'invitation.unknownUser': 'Ce profil est introuvable. Il a peut-être été supprimé.',
};

/** Le dernier mot quand rien n'est reconnu. Jamais un ecran muet. */
export const TEAM_INVITATION_FALLBACK_MESSAGE = 'Impossible d\'envoyer l\'invitation'
  + ' pour le moment.';

/**
 * Nomme la CAUSE d'un refus d'invitation, sans la traduire.
 *
 * Le 403 est traite par le STATUT et non par le message : la policy
 * `can-invite-to-team` rend `false` sans phrase quand le droit manque
 * (admin/.../policies/can-invite-to-team.ts:53-67), et Strapi habille alors le
 * refus d'un « Forbidden » generique.
 * @param {{ message?: string, status?: number | null } | null} [error] - l'erreur du service.
 * @returns {string} - une cause connue, ou une chaine vide.
 */
export const resolveTeamInvitationRefusalCause = (error) => {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim();

  const known = SERVER_REFUSALS[message];
  if (known) return known;

  if (status === 401 || status === 403) return 'invitation.forbidden';

  return '';
};

/**
 * Traduit un refus d'invitation en une phrase que le dirigeant comprend.
 *
 * ⛔ Un message SERVEUR inconnu n'est jamais affiche tel quel : il est en
 * anglais, et souvent technique. On rend le repli.
 * @param {{ message?: string, status?: number | null } | null} [error] - l'erreur du service.
 * @returns {string} - la phrase a afficher, jamais vide.
 */
export const describeTeamInvitationRefusal = (error) => {
  const cause = resolveTeamInvitationRefusalCause(error);
  return FRENCH_BY_CAUSE[cause] || TEAM_INVITATION_FALLBACK_MESSAGE;
};

/**
 * L'identifiant stable d'une personne, quel que soit l'endroit d'ou elle vient.
 * @param {any} person - un utilisateur rendu par la recherche ou par l'equipe.
 * @returns {string} - son `documentId`, ou une chaine vide.
 */
export const readPersonId = (person) => String(person?.documentId || '').trim();

/**
 * Le nom affichable d'une personne, sans jamais rendre une chaine vide.
 * @param {any} person - un utilisateur.
 * @param {string} [fallback] - ce qu'on ecrit quand on ne sait pas.
 * @returns {string} - le nom a afficher.
 */
export const describePersonName = (person, fallback = 'Cette personne') => (
  [person?.firstname, person?.lastname].filter(Boolean).join(' ').trim()
  || String(person?.username || '').trim()
  || fallback
);

/**
 * Qui reste-t-il a inviter ? On retire les personnes DEJA dans l'equipe et
 * celles qu'on vient d'inviter pendant cette session.
 *
 * 🔒 Le serveur refuse deja les deux cas (controleur :759 et :785). Ce tri ne
 * remplace pas ce mur : il evite de PROPOSER un geste dont on sait qu'il sera
 * refuse — c'est de la politesse, pas de la securite.
 * @param {object} params - les listes a croiser.
 * @param {any[]} [params.candidates] - les membres du club, deja charges par l'ecran.
 * @param {any[]} [params.players] - les joueurs de l'equipe.
 * @param {any[]} [params.trainers] - les encadrants de l'equipe.
 * @param {string[]} [params.alreadyInvitedIds] - ceux invites pendant cette session.
 * @param {string} [params.currentUserId] - moi : on ne s'invite pas soi-meme.
 * @param {string} [params.search] - ce qui est tape dans le champ de recherche.
 * @returns {any[]} - les candidats retenus, tries par nom.
 */
export const selectInvitableCandidates = ({
  alreadyInvitedIds = [],
  candidates = [],
  currentUserId = '',
  players = [],
  search = '',
  trainers = [],
} = {}) => {
  const excluded = new Set([
    ...(Array.isArray(players) ? players : []).map(readPersonId),
    ...(Array.isArray(trainers) ? trainers : []).map(readPersonId),
    String(currentUserId || '').trim(),
  ].filter(Boolean));

  const invited = new Set((Array.isArray(alreadyInvitedIds) ? alreadyInvitedIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean));

  const needle = String(search || '').trim().toLowerCase();

  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => {
      const id = readPersonId(candidate);
      // ⚠️ Sans `documentId` le serveur refuserait (« Invited user is
      // required ») : on ne propose pas un geste impossible.
      if (!id) return false;
      if (excluded.has(id)) return false;
      if (!needle) return true;
      return describePersonName(candidate, '').toLowerCase().includes(needle);
    })
    .map((candidate) => ({
      ...candidate,
      // On NE RETIRE PAS les personnes deja invitees : on les garde visibles
      // avec leur etat, sinon elles disparaissent sous les doigts de celui qui
      // vient d'appuyer, et il croit avoir rate son geste.
      hasPendingInvitation: invited.has(readPersonId(candidate)),
    }))
    .sort((a, b) => describePersonName(a, '').localeCompare(describePersonName(b, ''), 'fr'));
};
