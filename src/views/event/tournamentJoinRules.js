import i18next from 'i18next';

import { getEventLocationText } from '@/utils/eventLocationText';

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
 * IMPL-1-FICHE × IMPL-3 (chef, 18/11) — l'organisateur a fermé les inscriptions
 * (`tournamentConfig.registrationsClosed === true`) ; absent ou autre valeur : ouvertes.
 * @param {any} event - Le tournoi.
 * @returns {boolean} Vrai si les inscriptions sont fermées.
 */
export const isTournamentRegistrationClosed = (event) => (
  event?.tournamentConfig?.registrationsClosed === true
);

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
 * (règle de `isTournamentTeamOpenToJoinRequests`, celle du serveur).
 * T-SANS-PLAFOND (18/11, Adel D239) : plus de nombre maximum de joueurs ; une équipe à 5 ou plus
 * reste proposée (elle prend des remplaçants).
 * @param {any[]} teams - Les équipes du tournoi.
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {{ playerCount: number | null, team: any }[]} La liste.
 */
export const getTournamentTeamsSeekingPlayers = (teams, tournamentConfig = {}) => (
  (Array.isArray(teams) ? teams : [])
    .filter(isTournamentTeamOpenToJoinRequests)
    .map((team) => ({
      playerCount: getTournamentTeamPlayerCount(team, tournamentConfig),
      team,
    }))
);

/**
 * « 3 joueurs » (plus de « sur 5 » : D239), `null` si le nombre n'est pas connu.
 * @param {{ playerCount: number | null }} entry - Une équipe listée.
 * @returns {string | null} La ligne sous le nom de l'équipe.
 */
export const getTournamentTeamPlayersLine = ({ playerCount }) => (
  playerCount === null
    ? null
    : i18next.t('tournamentManagement.rosterTotal', '{{count}} joueurs', { count: playerCount })
);

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
 * Le compte a-t-il déjà une équipe dans ce tournoi (capitaine, admin, membre actif, invitation
 * ou demande en attente) ? Extrait de `canAskToJoinTournamentTeam` (T-PAGES-2, 17/11) pour que
 * la page d'une équipe dise cette raison AVANT la déclaration (fait F22), avec la même règle.
 * Personne n'a `tournament-team-member.find` : la fiche reçoit `members` vide. Le lecteur se
 * reconnaît donc par le capitaine, les admins de l'équipe, et par la marque du serveur
 * `viewerMembership` (T-PARCOURS-2, son statut à lui seul, par équipe) quand elle est là.
 * @param {any[] | undefined} teams - Les équipes du tournoi (`event.tournamentTeams`).
 * @param {string | undefined} userId - Le compte connecté.
 * @returns {boolean} Vrai s'il est déjà pris dans une équipe.
 */
export const hasTournamentTeamForUser = (teams, userId) => {
  if (!userId) return false;
  const equipes = Array.isArray(teams) ? teams : [];
  const dejaDansUneEquipe = equipes.some((team) => (
    team?.captainUser?.documentId === userId
    || (team?.adminUsers || []).some((/** @type {any} */ admin) => admin?.documentId === userId)
    || (team?.members || []).some((/** @type {any} */ member) => (
      member?.user?.documentId === userId && isTournamentActiveMemberStatus(member?.responseStatus)
    ))
    || isTournamentActiveMemberStatus(team?.viewerMembership?.responseStatus)
    || isTournamentPendingMembershipStatus(team?.viewerMembership?.responseStatus)
  ));
  return dejaDansUneEquipe || Boolean(getTournamentPendingMembershipForUser(equipes, userId));
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
  // IMPL-1-FICHE × IMPL-3 : inscriptions fermées par l'organisateur, plus de demande.
  if (isTournamentRegistrationClosed(event)) return false;
  if (!normalizeTournamentText(event?.type?.name).includes('tournoi')) return false;
  if (getTournamentClosure(event).isClosed || event?.isActive === false) return false;
  if (isTooYoungForTournament(event, user)) return false;
  if (isTournamentOrganizer(event, user)) return false;
  return !hasTournamentTeamForUser(teams, userId);
};

/**
 * T-PAGES-6 (17/11/2026, point 3, fait F22) — la raison de refus connue AVANT la déclaration et les
 * cases, montrée dès le premier écran du panneau. L'âge connu sous le minimum, une équipe
 * déjà prise et une demande en cours cachent déjà le bouton (`canAskToJoinTournamentTeam`) ;
 * reste le compte sans date de naissance, que le serveur refuse à l'envoi (même phrase,
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

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, pages 6, 7 et 8) — les règles de la fiche
// refaite et de la carte d'événement, partagées par le téléphone et le site.
// Témoin : __tests__/IMPL-1-FICHE.regles.test.js.

/**
 * Le seuil d'affichage des équipes : 30 % de la capacité, arrondi au supérieur (8 pour 24).
 * @param {number | null | undefined} capacite - Les équipes attendues.
 * @returns {number | null} Le seuil, ou `null` sans capacité.
 */
export const getTournamentTeamsThreshold = (capacite) => {
  const total = Math.round(Number(capacite));
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.ceil((total * TOURNAMENT_VISITOR_TEAMS_THRESHOLD_PERCENT) / 100);
};

/**
 * Le lieu court d'un tournoi : « AR Soccer · Montpellier » (le complexe, puis la ville), tiré du
 * lieu écrit ; jamais le terrain (`facility.name`, « Terrain A »), qui n'est pas un lieu.
 * @param {any} event - Le tournoi.
 * @returns {string} Le lieu court, ou ''.
 */
export const getTournamentShortPlace = (event) => {
  const morceaux = String(getEventLocationText(event) || '')
    .split(',')
    .map((morceau) => morceau.trim())
    .filter(Boolean);
  if (morceaux.length > 2 && /^france$/i.test(morceaux[morceaux.length - 1])) morceaux.pop();
  const [nom] = morceaux;
  if (!nom) return '';
  if (morceaux.length < 2) return nom;
  const ville = morceaux[morceaux.length - 1]
    .replace(/^\d{4,5}\s+/, '')
    .replace(/\s+\d{4,5}$/, '')
    .trim();
  return ville && ville !== nom ? `${nom} · ${ville}` : nom;
};

/**
 * « Cherche N joueurs » : les places qui manquent pour atteindre le seuil des payés (5 par
 * défaut), sur une équipe OUVERTE aux demandes seulement ; 0 sinon, ou si l'effectif est inconnu.
 * @param {any} team - L'équipe du tournoi.
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {number} Le nombre de joueurs cherchés.
 */
export const getTournamentTeamLookingFor = (team, tournamentConfig = {}) => {
  if (!isTournamentTeamOpenToJoinRequests(team)) return 0;
  const effectif = getTournamentTeamPlayerCount(team, tournamentConfig);
  if (effectif === null) return 0;
  const seuil = Math.round(Number(tournamentConfig?.paidMembersToValidate));
  return Math.max(0, (seuil > 0 ? seuil : 5) - effectif);
};

/**
 * « Prénom I. » depuis un prénom et un nom (ou une initiale).
 * @param {unknown} prenom - Le prénom.
 * @param {unknown} nom - Le nom, ou son initiale.
 * @returns {string} Le libellé, ou ''.
 */
const prenomEtInitiale = (prenom, nom) => {
  const premier = String(prenom || '').trim();
  const initiale = String(nom || '').trim().charAt(0).toUpperCase();
  if (!premier) return '';
  return initiale ? `${premier} ${initiale}.` : premier;
};

/**
 * Les joueurs d'une équipe vus de l'extérieur (aperçu 8e) : « Prénom I. », jamais le paiement de
 * chacun ; un mineur (drapeau `isMinor` ou `minor` du serveur) sans prénom (`label: null`).
 * @param {any} team - L'équipe du tournoi.
 * @returns {{ label: string | null, minor: boolean }[]} Les joueurs.
 */
export const getTournamentTeamPublicPlayers = (team) => (
  (Array.isArray(team?.membersSummary?.list) ? team.membersSummary.list : [])
    .map((/** @type {any} */ joueur) => {
      // Contrat d'IMPL-5 : dans un résumé masqué, un mineur arrive sans prénom ni initiale.
      const videMasque = team?.membersSummary?.paidHidden === true
        && !String(joueur?.firstName || '').trim() && !String(joueur?.lastInitial || '').trim();
      const minor = joueur?.isMinor === true || joueur?.minor === true || videMasque;
      const label = prenomEtInitiale(joueur?.firstName, joueur?.lastInitial) || null;
      return { label: minor ? null : label, minor };
    })
);

/**
 * Le capitaine en « Prénom I. » : `captainDisplayName` du serveur (contrat d'IMPL-5), sinon tiré de
 * `captainUser` ; '' quand le serveur ne le rend pas.
 * @param {any} team - L'équipe du tournoi.
 * @returns {string} Le libellé.
 */
export const getTournamentTeamCaptainShort = (team) => String(team?.captainDisplayName || '').trim()
  || prenomEtInitiale(
  team?.captainUser?.firstname || team?.captainUser?.firstName,
  team?.captainUser?.lastname || team?.captainUser?.lastName || team?.captainUser?.lastInitial,
);
