import i18next from 'i18next';

import {
  getTournamentClosure,
  getTournamentMinAge,
  getTournamentPendingMembershipForUser,
  getTournamentRosterSummary,
  isTooYoungForTournament,
  isTournamentActiveMemberStatus,
  isTournamentPendingMembershipStatus,
  isTournamentTeamOpenToJoinRequests,
  normalizeTournamentText,
} from './tournamentUtils';

// T-REJOINDRE (17/11/2026, décisions de Clément, registre D210) — LE JOUEUR SEUL ET LE VISITEUR.
// Une seule règle pour le site et le téléphone (les deux fiches lisent ce fichier).
// Fichier à part de tournamentUtils.js : T-PARCOURS-2 et T-JOUEURS y écrivent en ce moment.
// Témoin : __tests__/tournamentJoinRules.TREJOINDRE.test.js.

/**
 * Le nombre de joueurs d'une équipe, tel que la fiche peut le connaître.
 * Personne d'autre que le SuperAdmin ne lit les membres d'une équipe : pour un joueur tiers,
 * `members` arrive vide. T-JOUEURS ajoute `membersSummary.count` (serveur). Sans l'un ni l'autre,
 * le nombre est INCONNU (`null`) : une équipe a toujours au moins son capitaine, donc 0 lu n'est
 * jamais un vrai 0.
 * @param {any} team - L'équipe du tournoi.
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {number | null} Le nombre de joueurs, ou `null` s'il n'est pas connu.
 */
export const getTournamentTeamPlayerCount = (team, tournamentConfig = {}) => {
  const resume = Number(team?.membersSummary?.count);
  if (team?.membersSummary && Number.isFinite(resume)) return resume;
  const lus = getTournamentRosterSummary(team, tournamentConfig).totalCount;
  return lus > 0 ? lus : null;
};

/**
 * D50 « 2- A » — les équipes qu'un joueur seul peut demander à rejoindre : ouvertes aux demandes
 * (règle de `isTournamentTeamOpenToJoinRequests`, celle du serveur) ET pas complètes (effectif
 * connu < maximum du tournoi). Sans maximum, ou effectif inconnu : l'équipe reste proposée, le
 * serveur tranche.
 * @param {any[]} teams - Les équipes du tournoi.
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {{ maxRosterSize: number | null, playerCount: number | null, team: any }[]} La liste.
 */
export const getTournamentTeamsSeekingPlayers = (teams, tournamentConfig = {}) => {
  const max = Number(tournamentConfig?.maxRosterSize);
  const maxRosterSize = Number.isFinite(max) && max > 0 ? max : null;
  return (Array.isArray(teams) ? teams : [])
    .filter(isTournamentTeamOpenToJoinRequests)
    .map((team) => ({
      maxRosterSize,
      playerCount: getTournamentTeamPlayerCount(team, tournamentConfig),
      team,
    }))
    .filter(({ playerCount }) => (
      maxRosterSize === null || playerCount === null || playerCount < maxRosterSize
    ));
};

/**
 * « 3 joueurs sur 5 », « 3 joueurs » sans maximum, `null` si le nombre n'est pas connu.
 * @param {{ maxRosterSize: number | null, playerCount: number | null }} entry - Une équipe listée.
 * @returns {string | null} La ligne sous le nom de l'équipe.
 */
export const getTournamentTeamPlayersLine = ({ maxRosterSize, playerCount }) => {
  if (playerCount === null) return null;
  if (maxRosterSize === null) {
    return i18next.t('tournamentManagement.rosterTotal', '{{count}} joueurs', {
      count: playerCount,
    });
  }
  return i18next.t('tournamentJoin.playersOutOf', {
    count: playerCount,
    defaultValue_one: '{{count}} joueur sur {{max}}',
    defaultValue_other: '{{count}} joueurs sur {{max}}',
    max: maxRosterSize,
  });
};

/**
 * T-PAGES-6 (17/11/2026, question 5 de T-REJOINDRE, « C ») — le compte est-il l'organisateur de CE
 * tournoi (`event.organizer`, même lecture que `canManageEvent` de useAuth) ? Il ne rejoint pas une
 * équipe de son propre tournoi. Règle partagée : la fiche (T-PAGES-3 et 4) l'appelle.
 * @param {any} event - Le tournoi.
 * @param {any} [user] - Le compte connecté.
 * @returns {boolean} Vrai seulement si l'organisateur est connu et que c'est ce compte.
 */
export const isTournamentOrganizer = (event, user) => {
  const organizerId = String(event?.organizer?.documentId || '').trim();
  return Boolean(organizerId) && organizerId === String(user?.documentId || '').trim();
};

/**
 * D50 — qui voit « Rejoindre une équipe » sur la fiche d'un tournoi : un compte connecté, qui
 * n'est pas un compte Parent (il lit, il ne joue pas), assez âgé pour le tournoi (même règle que
 * T-FINITIONS-3 : âge connu sous `minAge` ⇒ pas de bouton), sans équipe ni invitation ni demande
 * dans ce tournoi, sur un tournoi non clôturé. Le serveur rejuge tout (`requestJoin`).
 * @param {object} params - Le contexte.
 * @param {string} [params.accountRoleKey] - Le rôle du compte (`useAuth`).
 * @param {any} params.event - Le tournoi.
 * @param {any[]} [params.teams] - Ses équipes.
 * @param {any} [params.user] - Le compte connecté.
 * @returns {boolean} Vrai si le bouton est montré.
 */
export const canAskToJoinTournamentTeam = ({
  accountRoleKey, event, teams, user,
}) => {
  const userId = user?.documentId;
  if (!userId || accountRoleKey === 'parent') return false;
  if (!normalizeTournamentText(event?.type?.name).includes('tournoi')) return false;
  if (getTournamentClosure(event).isClosed || event?.isActive === false) return false;
  if (isTooYoungForTournament(event, user)) return false;
  if (isTournamentOrganizer(event, user)) return false;
  const equipes = Array.isArray(teams) ? teams : [];
  // Personne n'a `tournament-team-member.find` : la fiche reçoit `members` vide. Le lecteur se
  // reconnaît donc par le capitaine, les admins de l'équipe, et par la marque du serveur
  // `viewerMembership` (T-PARCOURS-2, son statut à lui seul, par équipe) quand elle est là.
  const dejaDansUneEquipe = equipes.some((team) => (
    team?.captainUser?.documentId === userId
    || (team?.adminUsers || []).some((/** @type {any} */ admin) => admin?.documentId === userId)
    || (team?.members || []).some((/** @type {any} */ member) => (
      member?.user?.documentId === userId && isTournamentActiveMemberStatus(member?.responseStatus)
    ))
    || isTournamentActiveMemberStatus(team?.viewerMembership?.responseStatus)
    || isTournamentPendingMembershipStatus(team?.viewerMembership?.responseStatus)
  ));
  return !dejaDansUneEquipe && !getTournamentPendingMembershipForUser(equipes, userId);
};

/**
 * T-PAGES-6 (17/11/2026, point 3, fait F22) — la raison de refus connue AVANT la déclaration et les
 * cases, montrée dès le premier écran du panneau. L'âge connu sous le minimum, une équipe déjà
 * prise
 * et une demande en cours cachent déjà le bouton (`canAskToJoinTournamentTeam`) ; reste le compte
 * sans date de naissance, que le serveur refuse à l'envoi (même phrase,
 * `assertTargetUserAgeAllowed`).
 * @param {object} params - Le contexte.
 * @param {any} params.event - Le tournoi.
 * @param {any} [params.user] - Le compte connecté.
 * @returns {string} La phrase, ou une chaîne vide.
 */
export const getTournamentJoinBlockingNotice = ({ event, user }) => {
  const minAge = getTournamentMinAge(event);
  if (!minAge || !user?.documentId || String(user?.birthdate || '').trim()) return '';
  return i18next.t(
    'tournamentJoin.birthdateMissing',
    'Renseigne ta date de naissance dans ton profil pour rejoindre ce tournoi (ouvert à partir de '
      + '{{minAge}} ans).',
    { minAge },
  );
};

// D49 « 3- A » avec un seuil (Clément, 17/11, registre D210), mot pour mot : « si ~30 % équipes
// inscrites alors on affiche le nombre d'équipes inscrites, sinon on ne met uniquement le nombre
// d'équipes attendu ». En pourcentage entier : 30 % de 24 = 7,2, arrondi au supérieur = 8.
export const TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT = 30;

/**
 * D49 — ce que le visiteur SANS COMPTE lit des équipes d'un tournoi. Le serveur rend à la fiche
 * publique `tournamentTeamsSummary: { registeredCount, expectedCount }`, sans aucune personne ni
 * aucun nom d'équipe (admin `event/utils/tournament-teams-summary.js`).
 *   · capacité connue et inscrites ≥ 30 % de la capacité (arrondi au supérieur) :
 *     « N équipes inscrites sur M » ;
 *   · capacité connue, sous le seuil (ou nombre d'inscrites inconnu) : « M équipes attendues » ;
 *   · capacité inconnue : rien (`null`), jamais « 0 équipe ».
 * @param {any} event - Le tournoi tel que la fiche le reçoit.
 * @returns {string | null} La ligne à afficher, ou `null`.
 */
export const getTournamentVisitorTeamsLine = (event) => {
  const summary = event?.tournamentTeamsSummary || {};
  const capacite = Math.round(Number(summary.expectedCount ?? event?.tournamentConfig?.maxTeams));
  if (!Number.isFinite(capacite) || capacite <= 0) return null;
  const inscrites = summary.registeredCount === null || summary.registeredCount === undefined
    ? NaN
    : Math.round(Number(summary.registeredCount));
  const seuil = Math.ceil((capacite * TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT) / 100);
  if (Number.isFinite(inscrites) && inscrites >= seuil) {
    return i18next.t('tournamentJoin.visitorRegistered', {
      count: inscrites,
      defaultValue_one: '{{count}} équipe inscrite sur {{max}}',
      defaultValue_other: '{{count}} équipes inscrites sur {{max}}',
      max: capacite,
    });
  }
  return i18next.t('tournamentJoin.visitorExpected', {
    count: capacite,
    defaultValue_one: '{{count}} équipe attendue',
    defaultValue_other: '{{count}} équipes attendues',
  });
};
