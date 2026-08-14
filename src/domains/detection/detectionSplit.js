/**
 * C-D — Constituer les equipes d'une DETECTION (ecrans 13, 14 et 15 du pack).
 *
 * POURQUOI CE MODULE EXISTE, ET POURQUOI IL EST PUR
 * -------------------------------------------------
 * Le serveur sait deja RANGER une repartition : `detectionSplit` fait l'aller-retour
 * complet depuis D73 (admin `event-composition.ts:455-499`, ecriture `:1840-1846`).
 * Ce qu'il ne fait pas, c'est la CALCULER : `checkInFirst`, `memberMode` et `splitBy`
 * y sont normalises puis rendus a l'app, et personne ne les lit (mesure du 2026-08-14 :
 * 0 lecteur hors du normalisateur). Le calcul vit donc ici, et son RESULTAT est range.
 *
 * ⛔ LE RISQUE GRAVE DE CE LOT : un joueur perdu ou duplique. Un joueur perdu, c'est un
 * candidat qui s'est deplace et que personne n'appelle ; duplique, c'est deux equipes
 * qui l'attendent. Tout ce fichier est ecrit autour d'un seul invariant :
 *
 *   👉 chaque joueur entre ressort EXACTEMENT UNE FOIS, dans une equipe ou en non affecte.
 *
 * ⚠️ VOCABULAIRE — le mot « banc » est interdit en detection (regle du pack, §6). Un
 * joueur sans equipe est **NON AFFECTE** (`unassignedIds`), jamais « remplacant ».
 */

export const MEMBER_MODES = {
  EXCLUDED: 'excluded',
  GROUPED: 'grouped',
  MIX: 'mix',
};

export const SPLIT_BY = {
  NONE: 'none',
  REQUESTED_POSITION: 'requested_position',
};

// Les 4 chasubles, dans l'ordre du pack. ⚠️ Ces valeurs sont un CONTRAT SERVEUR :
// admin `event-composition.ts:470` rejette tout ce qui n'est pas dans cette liste
// (il rend `null`). Ne pas les traduire, ne pas les reordonner.
export const BIB_COLORS = ['jaune', 'rouge', 'bleu', 'vert'];

// Le serveur borne a 8 (`MAX_AUTO_TEAMS`). On s'aligne plutot que d'importer la
// constante de `tactical_v2` : ce dossier disparait au lot C-F, et le nouveau
// parcours n'a pas a en dependre une 6e fois.
export const MAX_DETECTION_TEAMS = 8;

const getPlayerId = (player) => {
  const id = player?.documentId || player?.id;
  return id ? String(id) : '';
};

/** Un joueur de l'equipe organisatrice, par opposition a un candidat a la detection. */
export const isTeamMember = (player) => player?.participantSource === 'team_player';

/** Le poste demande en candidatant (admin le calcule deja : `appliedPosition`). */
export const getRequestedPosition = (player) => {
  const position = player?.appliedPosition;
  return typeof position === 'string' && position.trim() ? position.trim() : null;
};

const toIdSet = (value) => new Set(
  (Array.isArray(value) ? value : []).map((entry) => String(entry || '')).filter(Boolean)
);

const clampTeamCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_DETECTION_TEAMS, Math.floor(parsed)));
};

/**
 * Deduplique par identifiant ET ordonne, pour que deux telephones qui affichent la
 * meme detection produisent le meme decoupage. Le tri suit celui du serveur
 * (`buildComparablePlayerLabel`) : nom, puis prenom, puis identifiant en dernier
 * recours — sans quoi deux homonymes rendraient l'ordre dependant de l'entree.
 */
const toOrderedUniquePlayers = (players) => {
  const seen = new Set();
  return (Array.isArray(players) ? players : [])
    .filter((player) => {
      const playerId = getPlayerId(player);
      if (!playerId || seen.has(playerId)) return false;
      seen.add(playerId);
      return true;
    })
    .sort((left, right) => {
      const byLastname = String(left?.lastname || '').localeCompare(String(right?.lastname || ''), 'fr');
      if (byLastname !== 0) return byLastname;
      const byFirstname = String(left?.firstname || '').localeCompare(String(right?.firstname || ''), 'fr');
      if (byFirstname !== 0) return byFirstname;
      return getPlayerId(left).localeCompare(getPlayerId(right));
    });
};

/**
 * Distribue une file dans les equipes visees, en tourniquet. Le curseur est PARTAGE
 * entre les appels successifs : c'est ce qui garde l'equilibre quand on distribue
 * poste par poste (3 groupes d'un seul joueur finiraient tous dans l'equipe 1 si
 * chaque groupe repartait de zero).
 */
const dealRoundRobin = (queue, targetTeams, cursorStart = 0) => {
  if (!targetTeams.length) return cursorStart;
  let cursor = cursorStart;
  queue.forEach((player) => {
    targetTeams[cursor % targetTeams.length].playerIds.push(getPlayerId(player));
    cursor += 1;
  });
  return cursor;
};

/**
 * Constitue les equipes d'une detection.
 *
 * @param {object} options
 * @param {boolean} [options.checkInFirst] Ecran 13 — « Pointer les presents d'abord ».
 *   Actif, un joueur non pointe n'est PAS reparti : il ressort non affecte.
 * @param {string[]} [options.excludedIds] Joueurs sortis nommement de la repartition.
 * @param {string} [options.memberMode] Ecran 13 — `mix` | `grouped` | `excluded`.
 * @param {object[]} [options.players] Les joueurs rendus par le serveur.
 * @param {string[]} [options.presentIds] Ecran 13 — les joueurs pointes a l'arrivee.
 * @param {string} [options.splitBy] Ecran 15 — `none` | `requested_position`.
 * @param {number} [options.teamCount] Ecran 15 — le compteur d'equipes.
 * @returns {{ teams: Array<{bibColor: string|null, index: number, playerIds: string[]}>,
 *            unassignedIds: string[] }}
 */
export const splitIntoTeams = ({
  checkInFirst = false,
  excludedIds = [],
  memberMode = MEMBER_MODES.GROUPED,
  players = [],
  presentIds = [],
  splitBy = SPLIT_BY.NONE,
  teamCount = 2,
} = {}) => {
  const normalizedCount = clampTeamCount(teamCount);
  const ordered = toOrderedUniquePlayers(players);
  const excluded = toIdSet(excludedIds);
  const present = toIdSet(presentIds);

  const teams = Array.from({ length: normalizedCount }, (_, index) => ({
    bibColor: BIB_COLORS[index] || null,
    index,
    playerIds: [],
  }));

  // Les 3 portes qui sortent un joueur de la repartition. Elles s'additionnent, et
  // aucune ne le fait disparaitre : il ressort toujours en NON AFFECTE.
  const unassigned = [];
  const distributable = [];
  ordered.forEach((player) => {
    const playerId = getPlayerId(player);
    const isSetAside = excluded.has(playerId)
      || (checkInFirst && !present.has(playerId))
      || (memberMode === MEMBER_MODES.EXCLUDED && isTeamMember(player));
    if (isSetAside) unassigned.push(playerId);
    else distributable.push(player);
  });

  // Mode « garder l'equipe groupee » : les membres forment UNE equipe verrouillee,
  // les candidats se repartissent dans les AUTRES. S'il n'y a qu'une equipe, elle
  // est deja prise par les membres : les candidats restent non affectes plutot que
  // d'etre melanges a une equipe que le coach a demande de garder intacte.
  const isGrouped = memberMode === MEMBER_MODES.GROUPED;
  const members = isGrouped ? distributable.filter(isTeamMember) : [];
  const toDeal = isGrouped ? distributable.filter((player) => !isTeamMember(player)) : distributable;
  let openTeams = teams;

  if (isGrouped && members.length) {
    teams[0].playerIds.push(...members.map(getPlayerId));
    openTeams = teams.slice(1);
  }

  if (!openTeams.length) {
    unassigned.push(...toDeal.map(getPlayerId));
  } else if (splitBy === SPLIT_BY.REQUESTED_POSITION) {
    // Ecran 15 — « Separer par poste recherche » : on etale CHAQUE poste sur les
    // equipes, pour ne pas concentrer les 3 gardiens dans la meme.
    const byPosition = new Map();
    toDeal.forEach((player) => {
      const position = getRequestedPosition(player) || '';
      if (!byPosition.has(position)) byPosition.set(position, []);
      byPosition.get(position).push(player);
    });
    // Postes nommes d'abord, par ordre alphabetique ; les sans-poste ferment la
    // marche, pour qu'ils comblent les trous plutot que de les creuser.
    const positions = [...byPosition.keys()].sort((left, right) => {
      if (!left) return 1;
      if (!right) return -1;
      return left.localeCompare(right, 'fr');
    });
    let cursor = 0;
    positions.forEach((position) => {
      cursor = dealRoundRobin(byPosition.get(position), openTeams, cursor);
    });
  } else {
    dealRoundRobin(toDeal, openTeams, 0);
  }

  return { teams, unassignedIds: unassigned };
};

/**
 * Ecran 15 — la liste `POSTES RECHERCHES · N`. Une rangee par poste demande, avec de
 * quoi peindre `1 par equipe` (cyan) ou `N manquants` (jaune). Les joueurs qui n'ont
 * demande aucun poste ne font pas de rangee : le pack masque les compteurs a zero.
 */
export const countRequestedPositions = (players = [], teamCount = 1) => {
  const normalizedCount = clampTeamCount(teamCount);
  const counters = new Map();
  toOrderedUniquePlayers(players).forEach((player) => {
    const position = getRequestedPosition(player);
    if (!position) return;
    counters.set(position, (counters.get(position) || 0) + 1);
  });

  return [...counters.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'fr'))
    .map(([position, count]) => ({
      count,
      missing: Math.max(0, normalizedCount - count),
      onePerTeam: count >= normalizedCount,
      position,
    }));
};

/**
 * La charge `detectionSplit` envoyee a `POST /events/:id/composition/draft`.
 *
 * ⚠️ CONTRAT SERVEUR STRICT : `normalizeDetectionSplit` (admin `:472-500`) reconstruit
 * un objet a clefs FIXES. Toute clef inconnue est jetee EN SILENCE. On n'emet donc que
 * ce qu'il sait relire — et `presentIds` n'en fait partie qu'a partir du lot C-D cote
 * admin. Tant que ce serveur-la n'est pas deploye, le pointage retombe simplement en
 * transitoire : rien ne casse, rien ne ment.
 */
export const buildDetectionSplitPayload = ({
  checkInFirst = false,
  excludedIds = [],
  memberMode = MEMBER_MODES.GROUPED,
  players = [],
  presentIds = [],
  rounds = [],
  splitBy = SPLIT_BY.NONE,
  teamCount = 2,
  teamNames = [],
  teams: precomputedTeams = null,
} = {}) => {
  const split = precomputedTeams
    ? { teams: precomputedTeams }
    : splitIntoTeams({ checkInFirst, excludedIds, memberMode, players, presentIds, splitBy, teamCount });

  return {
    checkInFirst: Boolean(checkInFirst),
    memberMode,
    presentIds: [...toIdSet(presentIds)],
    rounds: Array.isArray(rounds) ? rounds : [],
    splitBy,
    teamCount: split.teams.length,
    teams: split.teams.map((team, index) => ({
      bibColor: BIB_COLORS[index] || null,
      // Defaut aligne a l'octet sur celui du serveur (`Equipe ${index + 1}`, `:493`) :
      // un ecart ici ferait diverger le nom selon qui a ecrit en dernier.
      name: teamNames[index] || `Equipe ${index + 1}`,
      players: [...team.playerIds],
      rotation: [],
      terrain: null,
    })),
  };
};
