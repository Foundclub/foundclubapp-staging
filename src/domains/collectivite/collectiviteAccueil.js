import { formatDateWithDayPrefix } from '@/utils/date';
import { getPlanningItemWindow } from '@/utils/planning/planningSlots';

/**
 * 🏛️ COLL-ACCUEIL (01/10/2026, design validé HY521H1 v29) — ce que l'accueil de la Ville
 * calcule, en fonctions PURES : aucun appel réseau, aucun client HTTP importé
 * (mémoire piege-env-absent-worktree-import-service : n'importe quel écran ou le site les
 * importe sans doublure de test).
 *
 * L'accueil part de la FONCTION d'une collectivité (planche « Ce que fait une
 * collectivité », SPEC §2 A-H) : ce qui l'attend, ses actions, la vision de sa semaine
 * et de ses clubs (en NOMBRES, jamais une personne de club), ses actualités.
 */

/**
 * Les actions de l'accueil, dans l'ordre de la planche. Une action sans `route` n'est
 * PAS affichée : son écran n'existe pas encore. Le lot qui construit l'écran pose sa
 * route ici, et l'action apparaît, à sa place, sans autre changement.
 * ⛔ Ne jamais poser une route qui n'existe pas : un bouton qui ne mène nulle part est
 * pire qu'un bouton absent.
 * @type {ReadonlyArray<{ icon: string, key: string, lot: string, route: string | null }>}
 */
export const COLLECTIVITE_HOME_ACTIONS = Object.freeze([
  // Le cœur du produit : le créneau de saison (lots C2a serveur, C2b écran).
  {
    icon: 'calendar', key: 'assignSlot', lot: 'C2a + C2b', route: null,
  },
  // Les actualités de la Ville (lot C4a).
  {
    icon: 'send', key: 'publishNews', lot: 'C4a', route: null,
  },
  // Fermer une installation, bloquer un créneau (lot C4b).
  {
    icon: 'close', key: 'closeInstallation', lot: 'C4b', route: null,
  },
  {
    icon: 'flag', key: 'blockSlot', lot: 'C4b', route: null,
  },
  // Inviter un club absent de FoundClub (lot C-CLUBS).
  {
    icon: 'users', key: 'inviteClub', lot: 'C-CLUBS', route: null,
  },
  // Existe depuis COLL1C : le formulaire d'installation de la collectivité.
  {
    icon: 'stadium', key: 'addInstallation', lot: 'COLL1C', route: 'CollectiviteInstallationForm',
  },
]);

/**
 * Les actions dont l'écran existe.
 * @param {ReadonlyArray<{ route: string | null }>} [actions] - Le registre.
 * @returns {Array<any>} Les actions affichables.
 */
export const availableHomeActions = (actions = COLLECTIVITE_HOME_ACTIONS) => (
  actions.filter((action) => Boolean(action.route))
);

const horodatage = (/** @type {unknown} */ valeur) => {
  const date = typeof valeur === 'string' || valeur instanceof Date ? new Date(valeur) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.POSITIVE_INFINITY;
};

/**
 * La demande qui attend depuis le plus longtemps : c'est elle que l'accueil montre en tête.
 * @param {unknown} demandes - Les demandes EN ATTENTE (`/collectivites/:id/requests`).
 * @returns {any | null} La plus ancienne, ou null.
 */
export const oldestPendingRequest = (demandes) => {
  if (!Array.isArray(demandes) || demandes.length === 0) return null;
  return [...demandes].sort((a, b) => horodatage(a?.createdAt) - horodatage(b?.createdAt))[0];
};

/**
 * Le conflit d'une demande, mis en nombres pour la carte « Ce qui vous attend » :
 * places prises, capacité, et ce que l'acceptation donnerait.
 * @param {any} conflit - `conflict` d'une demande en attente (describeConflict, lot 1c).
 * @returns {{ full: boolean, maxSlots: number, remaining: number, taken: number,
 *   teamsIfAccepted: number } | null} Le résumé, ou null s'il est illisible.
 */
export const summarizeConflict = (conflit) => {
  const maxSlots = Number(conflit?.maxSlots);
  const remaining = Number(conflit?.remaining);
  if (!Number.isInteger(maxSlots) || maxSlots < 1 || !Number.isFinite(remaining)) return null;
  const libres = Math.max(0, Math.min(maxSlots, remaining));
  const taken = maxSlots - libres;
  return {
    full: libres === 0,
    maxSlots,
    remaining: libres,
    taken,
    // Accepter ajoute une équipe aux occupants du moment.
    teamsIfAccepted: Math.max(taken, maxSlots - remaining) + 1,
  };
};

/**
 * Les clubs rattachés en NOMBRES (SPEC §2 G, H) : clubs, équipes, membres. Un compteur de
 * membres illisible rend `members: null` (l'écran écrit « — », jamais un 0 inventé).
 * @param {unknown} clubs - `/collectivites/:id/clubs`.
 * @returns {{ clubs: number, members: number | null, teams: number }} Les totaux.
 */
export const clubTotals = (clubs) => {
  const liste = Array.isArray(clubs) ? clubs : [];
  let members = /** @type {number | null} */ (0);
  let teams = 0;
  liste.forEach((club) => {
    teams += Number.isInteger(club?.teamsCount) ? club.teamsCount : 0;
    if (members !== null) {
      members = Number.isInteger(club?.membersCount) ? members + club.membersCount : null;
    }
  });
  return { clubs: liste.length, members, teams };
};

/**
 * Les initiales d'un club pour son écusson : « AS Montrivage » ⇒ « AM ».
 * @param {unknown} nom - Le nom du club.
 * @returns {string} Une ou deux lettres majuscules, ou « ? ».
 */
export const clubInitials = (nom) => {
  const mots = String(nom || '').trim().split(/[\s\-']+/u).filter((mot) => /\p{L}/u.test(mot));
  if (mots.length === 0) return '?';
  const premiere = (/** @type {string} */ mot) => (mot.match(/\p{L}/u) || [''])[0].toUpperCase();
  if (mots.length === 1) return premiere(mots[0]);
  return `${premiere(mots[0])}${premiere(mots[mots.length - 1])}`;
};

/**
 * Le premier moment de la semaine où l'installation est PLEINE (autant d'équipes que de
 * places), d'après les blocs de son planning. Même règle de recouvrement que
 * `getPlanningPeakOccupancy` (une fin libère avant qu'un début n'occupe).
 * @param {unknown} blocs - `data` de `/facilities/:id/planning`.
 * @param {unknown} maxSlots - La capacité de l'installation.
 * @returns {Date | null} Le début du premier moment complet, ou null.
 */
export const firstFullMoment = (blocs, maxSlots) => {
  const capacite = Number(maxSlots);
  if (!Array.isArray(blocs) || !Number.isInteger(capacite) || capacite < 1) return null;
  /** @type {Array<{ delta: number, time: number }>} */
  const reperes = [];
  blocs.forEach((bloc) => {
    const fenetre = getPlanningItemWindow(bloc);
    if (!fenetre?.startAt || !fenetre?.endAt) return;
    reperes.push({ delta: 1, time: fenetre.startAt.getTime() });
    reperes.push({ delta: -1, time: fenetre.endAt.getTime() });
  });
  reperes.sort((a, b) => (a.time === b.time ? a.delta - b.delta : a.time - b.time));
  let courant = 0;
  const premier = reperes.find((repere) => {
    courant += repere.delta;
    return repere.delta > 0 && courant >= capacite;
  });
  return premier ? new Date(premier.time) : null;
};

/**
 * Le moment complet, en mots courts : « jeu 18:00 » (même jour abrégé que formatSlot).
 * @param {Date | null} date - Le moment.
 * @returns {string} Le libellé, ou '' si la date est illisible.
 */
export const formatWeekMoment = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const [jour] = formatDateWithDayPrefix(date, { fallback: '' }).split(' ');
  const deux = (/** @type {number} */ valeur) => String(valeur).padStart(2, '0');
  return `${jour} ${deux(date.getHours())}:${deux(date.getMinutes())}`;
};

/**
 * Un compte « Ville seule » : il gère (ou demande à gérer) une collectivité et n'a AUCUN
 * rôle sportif (rôle « Authenticated », clef `new`). Lui arrive sur l'espace de la Ville ;
 * un compte mixte (dirigeant, joueur, entraîneur, parent qui gère aussi une Ville) garde
 * son accueil (décision d'Adel « accueil A », 01/10).
 * @param {{ roleKey: string, managedCount: number, hasManagerRequest: boolean }} compte
 * @returns {boolean} Vrai pour un compte Ville seule.
 */
export const isVilleOnlyAccount = ({ hasManagerRequest, managedCount, roleKey }) => (
  roleKey === 'new' && (managedCount > 0 || hasManagerRequest === true)
);
