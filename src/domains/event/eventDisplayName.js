/**
 * LE NOM D'UN EVENEMENT, cote app — « Match vs <adversaire> ».
 *
 * 🎯 Idee d'Adel du 2026-08-19 : « on demande le nom de l'equipe adverse, pour
 * voir affiche en nom de l'evenement "Match vs (nom de l'equipe)" ».
 *
 * 🔁 CE FICHIER EST LE JUMEAU DE `admin/src/api/event/utils/event-display-name.js`.
 * Les deux depots n'ont aucun paquet commun ; la regle est donc ecrite deux fois,
 * a l'identique, et elles se lisent ensemble. ⛔ Si l'une change, l'autre change.
 *
 * 🧨 POURQUOI ELLE EXISTE AUSSI ICI alors que le serveur ecrit deja le bon
 * `event.name` : les evenements crees AVANT Y02 gardent leur nom machine en
 * base. Cote app, on sait resoudre l'adversaire depuis les entites deja
 * chargees (`invitedTeams`, `league_match`) — donc l'ancien parc s'affiche bien
 * sans attendre aucun rattrapage.
 *
 * ⛔ REGLE ABSOLUE : jamais « vs » suivi d'un blanc.
 */

/** Un nom d'adversaire ne depasse pas cette longueur (la colonne est un varchar 120). */
export const OPPONENT_NAME_MAX_LENGTH = 120;

/**
 * Les libelles qui ressemblent a un adversaire mais n'en nomment aucun.
 * `external-events-sync.ts` retombe sur « Adversaire » quand le calendrier
 * federal ne nomme pas le camp d'en face : l'afficher serait un « vs » orphelin
 * deguise.
 */
const LIBELLES_SANS_ADVERSAIRE = [
  'adversaire',
  'a definir',
  'a determiner',
  'inconnu',
  'tbd',
];

const texte = (/** @type {any} */ value) => (
  value === null || value === undefined ? '' : String(value).trim()
);

const comparable = (/** @type {any} */ value) => texte(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

/**
 * Le type d'evenement est-il un match ?
 * @param {any} typeName Nom du type d'evenement.
 * @returns {boolean} Vrai pour « Match », « Match amical »…
 */
export const isMatchTypeName = (typeName) => comparable(typeName).includes('match');

/**
 * Nettoie un nom d'adversaire.
 * @param {any} value Nom brut.
 * @returns {string} Nom nettoye, ou chaine vide si aucun adversaire n'est nomme.
 */
export const normalizeOpponentName = (value) => {
  const nettoye = texte(value).replace(/\s+/g, ' ');
  if (!nettoye) return '';
  if (LIBELLES_SANS_ADVERSAIRE.includes(comparable(nettoye))) return '';
  return nettoye.slice(0, OPPONENT_NAME_MAX_LENGTH);
};

const cleEntite = (/** @type {any} */ entite) => texte(
  entite && (entite.documentId ?? entite.id),
);

/**
 * Le club qui ORGANISE l'evenement.
 *
 * Deux chemins le peuplent, et jamais les memes : la fiche et l'ecran
 * descendent jusqu'a `event.team.club`, les affiches s'arretent a
 * `event.club`. L'un OU l'autre suffit.
 * @param {any} eventLike Evenement, tel que l'API le sert.
 * @returns {string} La cle du club organisateur, vide s'il est inconnu.
 */
const cleClubOrganisateur = (eventLike) => cleEntite(
  eventLike?.team?.club ?? eventLike?.club,
);

/**
 * 🧨 R2 — UNE EQUIPE DE MON PROPRE CLUB N'EST PAS UN ADVERSAIRE.
 *
 * Retour de recette de la 2.6.26 : inviter une equipe de son propre club
 * faisait que l'evenement PRENAIT SON NOM (« Match vs U15 B ») et se
 * comportait comme un match CONTRE elle. La regle d'en dessous ne regardait
 * que les EQUIPES ; elle ne regardait jamais leur CLUB.
 *
 * ⚖️ Elle exige les DEUX clubs CONNUS et EGAUX. Quand l'un manque — ancien
 * parc, charge utile compacte — on ne DEVINE pas : le comportement d'avant
 * reste. C'est ce qui rend ce garde-fou sans risque sur les donnees deja la.
 * @param {any} equipe Equipe invitee.
 * @param {any} eventLike Evenement, tel que l'API le sert.
 * @returns {boolean} Vrai seulement si les deux clubs sont connus et egaux.
 */
const estDuClubOrganisateur = (equipe, eventLike) => {
  const clubOrganisateur = cleClubOrganisateur(eventLike);
  const clubDeLEquipe = cleEntite(equipe?.club);
  return Boolean(clubOrganisateur && clubDeLEquipe && clubOrganisateur === clubDeLEquipe);
};

/**
 * L'adversaire d'un evenement : le champ stocke d'abord, les entites ensuite.
 *
 * L'ordre n'est pas arbitraire — `opponentName` est le seul endroit ou un humain
 * a DIT qui est l'adversaire. Les entites servent aux evenements crees avant Y02
 * et aux matchs de League, ou personne ne le saisit.
 * @param {any} eventLike Evenement, tel que l'API le sert.
 * @returns {string} Le nom de l'adversaire, ou chaine vide s'il est inconnu.
 */
export const resolveEventOpponentName = (eventLike) => {
  const stocke = normalizeOpponentName(eventLike?.opponentName);
  if (stocke) return stocke;

  const notreCle = cleEntite(eventLike?.team);
  const notreNom = comparable(eventLike?.team?.name);

  const invitees = Array.isArray(eventLike?.invitedTeams) ? eventLike.invitedTeams : [];
  const invitee = invitees.find((equipe) => {
    const nom = texte(equipe?.name);
    if (!nom) return false;
    if (estDuClubOrganisateur(equipe, eventLike)) return false;
    const cle = cleEntite(equipe);
    return cle ? cle !== notreCle : comparable(nom) !== notreNom;
  });
  if (invitee) return normalizeOpponentName(invitee.name);

  const leagueMatch = eventLike?.league_match;
  if (leagueMatch?.team_a || leagueMatch?.team_b) {
    const nousSommesA = comparable(leagueMatch?.team_a?.name) === notreNom;
    const eux = nousSommesA ? leagueMatch?.team_b : leagueMatch?.team_a;
    if (texte(eux?.name)) return normalizeOpponentName(eux.name);
  }

  return '';
};

/**
 * Le nom d'un evenement, tel qu'il doit s'afficher PARTOUT.
 *
 * Un match dont on connait l'adversaire s'appelle « Match vs X ». Tout le reste
 * garde exactement le nom d'aujourd'hui — c'est la non-regression du lot.
 * @param {any} eventLike Evenement, tel que l'API le sert.
 * @param {string} [replis] Le mot de repli quand rien ne nomme l'evenement.
 * @returns {string} Le nom affichable, jamais vide, jamais un « vs » orphelin.
 */
export const resolveEventDisplayName = (eventLike, replis = 'Evenement') => {
  const typeName = texte(eventLike?.type?.name || eventLike?.typeName);
  const adversaire = resolveEventOpponentName(eventLike);

  if (adversaire && isMatchTypeName(typeName)) {
    return `${typeName || 'Match'} vs ${adversaire}`;
  }

  const nomExistant = [eventLike?.name, eventLike?.description, typeName]
    .map(texte)
    .find(Boolean);

  return nomExistant || replis;
};
