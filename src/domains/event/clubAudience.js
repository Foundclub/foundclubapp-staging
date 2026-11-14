// EVT-CLUB-ECRANS (14/11/2026, D121) — « un evenement pour tout le club », les regles pures cote
// app. Contrat serveur (fix/EVT-CLUB-admin 6ffd967b) :
//   - creation : `audienceScope` ('club' | 'all_sections') ; hors Match / Tournoi, `club` et PAS de
//     `team` ;
//   - fiche du dirigeant : GET /events/:id/club-audience -> { counts, multisport, rows, relance } ;
//   - relance : POST /events/:id/remind { keys } (24 h par personne cote serveur). Un evenement
//     sans `audienceScope` ne passe par AUCUNE de ces regles : rien ne change pour lui.

/** Les valeurs de depart des filtres de la fiche : tout afficher. */
export const CLUB_AUDIENCE_ALL = Object.freeze({
  age: 'all',
  answer: 'all',
  search: '',
  section: 'all',
  sport: 'all',
  team: 'all',
});

const CLUB_SCOPES = ['club', 'all_sections'];

const idOf = (/** @type {any} */ value) => String(value?.documentId || value?.id || '').trim();

const normalize = (/** @type {any} */ value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

/**
 * Vrai pour un evenement « tout le club ».
 * @param {any} event L'evenement (ou l'etat du tunnel).
 * @returns {boolean} Vrai si `audienceScope` est connu.
 */
export const isClubAudienceEvent = (event) => (
  CLUB_SCOPES.includes(String(event?.audienceScope || ''))
);

/**
 * R1 A — un Match ou un Tournoi garde son equipe (convocation, inscriptions) ; les autres types
 * sont
 * rattaches au club seul. Meme detection par nom que le tunnel (`eventWizardDetectionUtils`).
 * @param {string} typeName Le nom du type d'evenement.
 * @returns {boolean} Vrai si l'equipe reste.
 */
export const keepsTeamWithClubAudience = (typeName) => {
  const name = normalize(typeName);
  return name.includes('match') || name.includes('tournoi');
};

/**
 * Q1 A / Q10 B — la liste des reponses du club : le dirigeant du club de l'evenement, ou l'admin de
 * l'omnisports dont il est une section (R6). Jamais un entraineur seul. Le serveur juge aussi
 * (403).
 * @param {any} event L'evenement.
 * @param {any} userData L'utilisateur connecte.
 * @param {{ president: string }} roles `USER_ROLES`.
 * @returns {boolean} Vrai si la fiche montre la liste du club.
 */
export const canSeeClubAudience = (event, userData, roles) => {
  if (!isClubAudienceEvent(event)) return false;
  const eventClub = event?.club || event?.team?.club || null;
  const eventClubId = idOf(eventClub);
  const isPresident = Boolean(roles?.president) && userData?.role?.name === roles.president;
  if (isPresident && eventClubId && idOf(userData?.club) === eventClubId) return true;
  const multisportId = idOf(eventClub?.parentMultisport);
  return (
    Boolean(multisportId)
    && (userData?.multisportClubs || []).some((/** @type {any} */ club) => idOf(club) === multisportId)
  );
};

/**
 * Ordre alphabetique par prenom, puis initiale (maquette 4a).
 * @param {any[]} rows Les lignes du serveur.
 * @returns {any[]} Une copie triee.
 */
export const sortClubAudienceRows = (rows = []) => [...(Array.isArray(rows) ? rows : [])].sort(
  (a, b) => normalize(a?.firstname).localeCompare(normalize(b?.firstname))
      || normalize(a?.lastInitial).localeCompare(normalize(b?.lastInitial)),
);

const matchesAnswer = (/** @type {any} */ row, /** @type {string} */ answer) => {
  if (answer === 'present') return row?.answer === 'present';
  if (answer === 'absent') return row?.answer === 'absent';
  if (answer === 'unanswered') return !row?.answer;
  return true;
};

const matchesOthers = (/** @type {any} */ row, /** @type {any} */ filters) => {
  /** @type {Record<string, string>} */
  const merged = { ...CLUB_AUDIENCE_ALL, ...(filters || {}) };
  const {
    age, search, section, sport, team,
  } = merged;
  if (age !== 'all' && row?.ageBracket !== age) return false;
  if (section !== 'all' && row?.section !== section) return false;
  if (sport !== 'all' && row?.sport !== sport) return false;
  if (team === 'none' && row?.team) return false;
  if (team !== 'all' && team !== 'none' && idOf(row?.team) !== team) return false;
  const query = normalize(search);
  const fullName = normalize(`${row?.firstname || ''} ${row?.lastInitial || ''}`);
  if (query && !fullName.includes(query)) return false;
  return true;
};

/**
 * Les filtres s'additionnent (maquette 4b) : reponse, age, section, equipe, sport, recherche.
 * @param {any[]} rows Les lignes.
 * @param {Record<string, string>} filters Les filtres.
 * @returns {any[]} Les lignes affichees, dans l'ordre recu.
 */
export const filterClubAudienceRows = (rows = [], filters = CLUB_AUDIENCE_ALL) => (
  Array.isArray(rows) ? rows : []
).filter(
  (row) => matchesOthers(row, filters) && matchesAnswer(row, filters?.answer || 'all'),
);

/**
 * Les 4 compteurs-filtres : ils suivent les autres filtres, pas celui de la reponse (qu'ils
 * posent).
 * @param {any[]} rows Les lignes.
 * @param {Record<string, string>} filters Les filtres.
 * @returns {{ all: number, present: number, absent: number, unanswered: number }} Les comptes.
 */
export const countClubAudienceRows = (rows = [], filters = CLUB_AUDIENCE_ALL) => {
  const scoped = (Array.isArray(rows) ? rows : []).filter((row) => matchesOthers(row, filters));
  return {
    absent: scoped.filter((row) => row?.answer === 'absent').length,
    all: scoped.length,
    present: scoped.filter((row) => row?.answer === 'present').length,
    unanswered: scoped.filter((row) => !row?.answer).length,
  };
};

/**
 * @typedef {object} ClubRelance
 * @property {boolean} [available] Vrai si une relance est possible (calcule au serveur).
 * @property {string|null} [lastRemindedAt] La derniere relance.
 * @property {string|null} [nextReminderAt] La prochaine relance possible.
 */

/**
 * Q13 / R3 A — le bouton « Relancer les N sans reponse » : il relance ce qui est AFFICHE, se grise
 * 24 h apres une relance (avec l'heure de la prochaine), et disparait quand l'evenement a commence
 * (`available` faux, calcule au serveur) ou quand aucun sans reponse n'est affiche.
 * @param {ClubRelance|null} relance Etat serveur.
 * @param {any[]} displayedRows Les lignes affichees.
 * @param {Date} [now] L'instant de reference.
 * @returns {{ visible: boolean, waiting: boolean, keys: string[], lastRemindedAt: string|null,
 *   nextReminderAt: string|null }} L'etat.
 */
export const getClubRelanceState = (relance, displayedRows = [], now = new Date()) => {
  const keys = (Array.isArray(displayedRows) ? displayedRows : [])
    .filter((row) => !row?.answer && row?.key)
    .map((row) => String(row.key));
  const nextReminderAt = relance?.nextReminderAt || null;
  const nextMs = nextReminderAt ? new Date(nextReminderAt).getTime() : NaN;
  return {
    keys,
    lastRemindedAt: relance?.lastRemindedAt || null,
    nextReminderAt,
    visible: relance?.available === true && keys.length > 0,
    waiting: Number.isFinite(nextMs) && nextMs > now.getTime(),
  };
};

/**
 * La derniere ligne avant le serveur, pour « tout le club ». Un evenement ordinaire repart a
 * l'identique (aucune cle ajoutee : la charge d'aujourd'hui ne bouge pas).
 * - hors Match / Tournoi : `club` pose, `team` retire (rattache au club) ;
 * - decision du chef (14/11) : « tout le club » = une date seule, jamais une serie.
 * @param {Record<string, any>} formData La charge construite par le recapitulatif.
 * @param {any} wizardState L'etat du tunnel.
 * @returns {Record<string, any>} La charge a envoyer.
 */
export const applyClubAudienceToFormData = (formData, wizardState) => {
  if (!isClubAudienceEvent(wizardState)) return formData;
  /** @type {Record<string, any>} */
  const next = { ...formData, audienceScope: wizardState.audienceScope, isRecurrent: false };
  if (!keepsTeamWithClubAudience(wizardState?.type?.name)) {
    next.club = idOf(wizardState?.club) || formData?.club || null;
    delete next.team;
  }
  return next;
};
