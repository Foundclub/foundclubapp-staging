/**
 * C-E — Faire TOURNER les equipes d'une DETECTION (ecrans 16 et 17 du pack).
 *
 * POURQUOI CE MODULE EXISTE, ET POURQUOI IL EST PUR
 * -------------------------------------------------
 * Le serveur sait deja RANGER une rotation et un temps de jeu — mesure du
 * 2026-08-15 sur `normalizeDetectionSplit` (admin `event-composition.ts:486-492`
 * et `:501`) : `rounds[]` porte `{ index, playtimeByPlayer, startedAt }`, et
 * chaque equipe porte `rotation[]`. ⇒ **Aucune migration n'est necessaire** : la
 * repartition entiere vit dans le champ `composition` (jsonb), et le lot C-D a
 * deja prouve l'aller-retour. Ce qu'il ne fait pas, c'est CALCULER le temps de
 * jeu. Le calcul vit donc ici, et son resultat est range.
 *
 * ⛔ LE RISQUE GRAVE DE CE LOT : perdre une affectation en changeant de manche.
 * Tout ce fichier est ecrit autour d'un seul invariant :
 *
 *   👉 changer de manche ne touche QUE `rounds`. Les equipes sont recopiees
 *      telles quelles, jamais recalculees.
 *
 * ⚠️ VOCABULAIRE — le mot « banc » est interdit en detection (regle du pack §6).
 * Reprise du mot tranche par C-D : un joueur sans equipe est **NON AFFECTE**
 * (`getUnassignedIds`). A l'interieur d'une equipe, celui qui attend son tour
 * est en **ROTATION** (`rotation[]`), jamais « remplacant ».
 *
 * 🧾 LE CONTRAT DE LECTURE, en une phrase : `players[]` est l'effectif COMPLET
 * de l'equipe, `rotation[]` en est le sous-ensemble qui attend. Sur le terrain =
 * `players` moins `rotation`, dans l'ordre de `players`. Rien d'autre n'est
 * range, donc rien ne peut diverger.
 */

import { BIB_COLORS } from './detectionSplit';

/**
 * Le plancher du pack : sous 5 minutes cumulees, le jeton passe au rouge. C'est
 * la raison d'etre d'une detection — chaque joueur doit avoir eu sa chance.
 */
export const PLAYTIME_FLOOR_MINUTES = 5;

const toIdList = (/** @type {any} */ value) => {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || ''))
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
};

const toPositiveNumber = (/** @type {any} */ value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Separe l'effectif d'une equipe entre le terrain et la rotation.
 *
 * 🧨 Ce lecteur est ecrit pour SURVIVRE a un brouillon incoherent : un joueur en
 * double dans `players`, ou une `rotation` qui nomme quelqu'un d'absent de
 * l'effectif. Les deux formes existent vraiment — un brouillon ecrit par une
 * version anterieure du parcours n'a aucune raison d'etre propre. Dans tous les
 * cas, chaque joueur de l'effectif ressort EXACTEMENT UNE FOIS.
 * @param {any} team L equipe telle que le serveur la range.
 * @param {number} slotCount Le nombre de places du terrain, pour ce sport.
 * @returns {{ placedIds: string[], rotationIds: string[] }}
 */
export const readTeamLineup = (team, slotCount = 0) => {
  const squad = toIdList(team?.players);
  const waiting = new Set(toIdList(team?.rotation).filter((playerId) => squad.includes(playerId)));

  /** @type {string[]} */
  const placedIds = [];
  /** @type {string[]} */
  const rotationIds = [];
  const capacity = Math.max(0, Math.floor(Number(slotCount) || 0));

  squad.forEach((playerId) => {
    // Le terrain a un nombre de places fixe : le 12e joueur d'un football passe
    // en rotation, meme si personne ne l'y a mis. Placer un titulaire de plus
    // que le sport n'en autorise fabriquerait une equipe impossible.
    if (waiting.has(playerId) || placedIds.length >= capacity) rotationIds.push(playerId);
    else placedIds.push(playerId);
  });

  return { placedIds, rotationIds };
};

/**
 * Les joueurs actuellement sur le terrain d'une equipe.
 * @param {any[]} teams
 * @param {number} teamIndex
 * @param {number} slotCount
 * @returns {string[]}
 */
export const getOnFieldIds = (teams, teamIndex, slotCount = 0) => {
  const team = (Array.isArray(teams) ? teams : [])[teamIndex];
  if (!team) return [];
  return readTeamLineup(team, slotCount).placedIds;
};

/**
 * Ecran 16 — le bandeau `NON AFFECTES · N`. Ce sont les presents qu'aucune
 * equipe ne reclame : ils sont comptes, pas ranges, donc ils ne peuvent pas
 * diverger de la repartition.
 * @param {string[]} presentIds
 * @param {any[]} teams
 * @returns {string[]}
 */
export const getUnassignedIds = (presentIds, teams) => {
  const taken = new Set(
    (Array.isArray(teams) ? teams : []).flatMap((team) => toIdList(team?.players)),
  );
  return toIdList(presentIds).filter((playerId) => !taken.has(playerId));
};

/**
 * Ecran 16 — deplacer un joueur d'une equipe a l'autre, ou le rendre aux non
 * affectes (`targetIndex` a `null`).
 *
 * 🔒 Le retrait porte sur TOUTES les equipes avant l'ajout, et sur `rotation`
 * autant que sur `players` : c'est ce qui rend le doublon impossible, y compris
 * quand un brouillon abime en portait deja un.
 * @param {any[]} teams
 * @param {string} playerId
 * @param {number|null} targetIndex
 * @returns {any[]} une NOUVELLE liste d equipes.
 */
export const movePlayerToTeam = (teams, playerId, targetIndex) => {
  const identifier = String(playerId || '');
  const source = Array.isArray(teams) ? teams : [];
  if (!identifier) return source.map((team) => ({ ...team }));

  const stripped = source.map((team) => ({
    ...team,
    players: toIdList(team?.players).filter((entry) => entry !== identifier),
    rotation: toIdList(team?.rotation).filter((entry) => entry !== identifier),
  }));

  if (targetIndex === null || targetIndex === undefined) return stripped;
  const target = stripped[targetIndex];
  if (!target) return stripped;

  target.players = [...target.players, identifier];
  return stripped;
};

/**
 * Ecran 16 — la pilule pointillee `+ Equipe`. La nouvelle equipe arrive VIDE :
 * une repartition deja faite ne se recalcule pas parce qu'on ouvre un terrain de
 * plus. C'est au coach de la remplir en glissant.
 * @param {any[]} teams
 * @returns {any[]} une NOUVELLE liste d equipes.
 */
export const addTeam = (teams) => {
  const source = (Array.isArray(teams) ? teams : []).map((team) => ({ ...team }));
  const index = source.length;

  return [...source, {
    bibColor: BIB_COLORS[index] || null,
    // Defaut aligne a l'octet sur celui du serveur (`Equipe ${index + 1}`,
    // admin `event-composition.ts:499`) : un ecart ferait diverger le nom selon
    // qui a ecrit en dernier.
    name: `Equipe ${index + 1}`,
    players: /** @type {string[]} */ ([]),
    rotation: /** @type {string[]} */ ([]),
    terrain: null,
  }];
};

/**
 * Ecran 17 — le temps de jeu CUMULE, toutes manches confondues.
 * @param {any[]} rounds
 * @returns {Record<string, number>} minutes par joueur.
 */
export const getCumulativePlaytime = (rounds) => (Array.isArray(rounds) ? rounds : [])
  .reduce((accumulator, round) => {
    const entries = round?.playtimeByPlayer;
    if (!entries || typeof entries !== 'object') return accumulator;
    Object.entries(entries).forEach(([playerId, minutes]) => {
      accumulator[playerId] = (accumulator[playerId] || 0) + toPositiveNumber(minutes);
    });
    return accumulator;
  }, /** @type {Record<string, number>} */ ({}));

/**
 * Ecran 17 — « rouge sous 5 min ». Ceux qu'on a oublies.
 * @param {number} minutes
 * @returns {boolean}
 */
export const isUnderPlaytimeFloor = (minutes) => toPositiveNumber(minutes) < PLAYTIME_FLOOR_MINUTES;

/**
 * Ferme une manche : les joueurs qui etaient sur le terrain encaissent les
 * minutes ecoulees. On AJOUTE, on ne remplace jamais — refermer deux fois la
 * meme manche ne doit pas effacer ce qui etait deja acquis.
 * @param {any} round
 * @param {string[]} onFieldIds
 * @param {number} elapsedMinutes
 * @returns {{ index: number, playtimeByPlayer: Record<string, number>, startedAt: string|null }}
 */
export const closeRound = (round, onFieldIds = [], elapsedMinutes = 0) => {
  const previous = round?.playtimeByPlayer && typeof round.playtimeByPlayer === 'object'
    ? round.playtimeByPlayer
    : {};
  const playtimeByPlayer = { ...previous };
  const minutes = toPositiveNumber(elapsedMinutes);

  toIdList(onFieldIds).forEach((playerId) => {
    playtimeByPlayer[playerId] = toPositiveNumber(playtimeByPlayer[playerId]) + minutes;
  });

  return {
    index: Number(round?.index) || 1,
    playtimeByPlayer,
    startedAt: round?.startedAt || null,
  };
};

/**
 * Ecran 17 — « Lancer la manche N+1 ».
 *
 * 🔒 L'INVARIANT DU LOT EST ICI : on referme la manche en cours, on en ouvre une
 * neuve, et on recopie TOUT LE RESTE tel quel. `teams` n'est jamais recalcule —
 * la seule facon de perdre une affectation serait de la regenerer.
 * @param {any} split La repartition (`detectionSplit`) telle qu'elle est rangee.
 * @param {object} options
 * @param {number} [options.elapsedMinutes] Minutes ecoulees depuis le debut de la manche.
 * @param {string[]} [options.onFieldIds] Qui etait sur le terrain pendant cette manche.
 * @param {string|null} [options.startedAt] Horodatage d ouverture de la manche neuve.
 * @returns {any} une NOUVELLE repartition.
 */
export const startNextRound = (split, {
  elapsedMinutes = 0,
  onFieldIds = [],
  startedAt = null,
} = {}) => {
  const rounds = Array.isArray(split?.rounds) ? split.rounds : [];
  const closed = rounds.map((/** @type {any} */ round, /** @type {number} */ index) => (
    index === rounds.length - 1 ? closeRound(round, onFieldIds, elapsedMinutes) : round
  ));

  return {
    ...split,
    rounds: [...closed, {
      index: closed.length + 1,
      playtimeByPlayer: /** @type {Record<string, number>} */ ({}),
      startedAt,
    }],
  };
};
