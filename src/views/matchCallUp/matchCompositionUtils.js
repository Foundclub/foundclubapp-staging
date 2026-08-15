/**
 * D79 — outils du parcours MATCH « Placer, puis publier » (ecrans 4 a 6 du pack
 * composition). Tout ce qui se calcule sans rendu vit ici : les formations de
 * depart, les 3 points de depart de l'ecran 4, l'aimantation aux postes, et les
 * compteurs des ecrans 5 et 6.
 *
 * ⛔ Aucun mecanisme neuf cote serveur : la charge produite reste celle que
 * `buildDraftPayloadFromPack` fabrique deja (`teams[].placements`,
 * `reservePlayerIds`, `selectedPlayerIds`, `manualPlayers`). Les 2 seuls champs
 * ajoutes — `requireResponse` et `visibility` — sont ceux que le lot serveur D73
 * lit deja a la RACINE du pack.
 */

import { getCompositionPlayerId } from '@/utils/compositionPlayer';
import { getTacticalSportKey } from '@/utils/tacticalField';

import { getMatchSquadSizes } from './matchCallUpUtils';

/**
 * Positions de depart en pourcentage `[x, y]`, reprises TELLES QUELLES de
 * `design_reference/fields.jsx` (`FORMATIONS`). Ce sont des pourcentages du
 * terrain, donc elles ne dependent pas de sa hauteur.
 * @type {Record<string, Array<[number, number]>>}
 */
export const MATCH_FORMATIONS = {
  basketball: [[50, 76], [19, 60], [81, 60], [30, 32], [66, 27]],
  football: [
    [50, 93], [86, 76], [62, 79], [38, 79], [14, 76], [72, 57],
    [50, 61], [28, 57], [82, 30], [50, 20], [18, 30],
  ],
  handball: [[50, 92], [27, 62], [50, 66], [73, 62], [50, 30], [10, 45], [90, 45]],
  rugby: [
    [50, 92], [10, 74], [88, 82], [50, 68], [66, 76], [34, 60], [50, 52], [34, 16],
    [50, 16], [66, 16], [42, 28], [58, 28], [20, 28], [80, 28], [50, 41],
  ],
  volleyball: [[22, 28], [50, 22], [78, 28], [22, 66], [50, 76], [78, 66]],
};

/**
 * Libelles de poste par sport, dans l'ordre de `MATCH_FORMATIONS` — repris tels
 * quels de `design_reference/fields.jsx` (`POSTES`).
 * @type {Record<string, string[]>}
 */
export const MATCH_POSITION_LABELS = {
  basketball: ['MEN', 'ARR', 'AIL', 'AF', 'PIV'],
  football: ['GB', 'DD', 'DC', 'DC', 'DG', 'MD', 'MC', 'MG', 'AD', 'BU', 'AG'],
  handball: ['GB', 'ARG', 'ARC', 'ARD', 'PIV', 'AIG', 'AID'],
  rugby: [
    'ARR', 'AI G', 'AI D', 'CE 1', 'CE 2', 'OUV', 'MÊL', 'PIL G',
    'TAL', 'PIL D', '2L G', '2L D', '3L G', '3L D', 'N°8',
  ],
  volleyball: ['P4', 'P3', 'P2', 'P5', 'P6', 'P1'],
};

/**
 * Rayon d'accroche de l'aimantation, en pourcentage de terrain. Meme valeur que
 * le board existant (`SNAP_RADIUS`) : deux ecrans qui aimantent differemment
 * seraient deux comportements a expliquer.
 */
export const MAGNET_RADIUS = 14;

/** Les 3 points de depart de l'ecran 4, dans l'ordre du pack. */
export const START_FROM_EMPTY = 'empty';
export const START_FROM_DEFAULT = 'default_composition';
export const START_FROM_LAST_MATCH = 'last_match';

const clampPercent = (/** @type {any} */ value) => Math.max(0, Math.min(100, Number(value) || 0));

const normalizeLabel = (/** @type {any} */ value) => String(value ?? '').trim();

/**
 * La formation de depart de ce sport.
 * @param {string} [sport]
 * @returns {Array<[number, number]>} Vide si le sport n'a pas de formation connue.
 */
export const getMatchFormation = (sport) => MATCH_FORMATIONS[getTacticalSportKey(sport)] || [];

/**
 * Les postes de ce sport, dans l'ordre de sa formation.
 * @param {string} [sport]
 * @returns {string[]}
 */
export const getMatchPositionLabels = (sport) => MATCH_POSITION_LABELS[getTacticalSportKey(sport)] || [];

/**
 * Les reperes de poste du terrain — ce sont les cibles de l'aimantation.
 * @param {string} [sport]
 * @param {string} [teamEntryId]
 * @returns {Array<{ label: string, positionX: number, positionY: number, slotId: string }>}
 */
export const buildFormationSlots = (sport, teamEntryId = 'team_1') => {
  const labels = getMatchPositionLabels(sport);
  return getMatchFormation(sport).map(([x, y], index) => ({
    label: labels[index] || `Poste ${index + 1}`,
    positionX: clampPercent(x),
    positionY: clampPercent(y),
    slotId: `${teamEntryId}:slot_${index + 1}`,
  }));
};

/**
 * Place les joueurs sur la formation de depart, dans l'ordre ou ils arrivent.
 *
 * ⚠️ On ne place QUE ce que la formation prevoit : les convoques en trop restent
 * au banc. Placer un 12e joueur au football fabriquerait un titulaire de plus
 * que le sport n'en autorise.
 * @param {object} input
 * @param {any[]} [input.players] Les convoques, dans l'ordre d'affichage.
 * @param {string} [input.sport]
 * @param {string} [input.teamEntryId]
 * @returns {Array<{ playerId: string, positionX: number, positionY: number, slotId: string }>}
 */
export const buildFormationPlacements = ({ players = [], sport, teamEntryId = 'team_1' }) => {
  const slots = buildFormationSlots(sport, teamEntryId);
  return (Array.isArray(players) ? players : [])
    .map((player, index) => {
      const slot = slots[index];
      const playerId = getCompositionPlayerId(player);
      if (!slot || !playerId) return null;
      return {
        playerId,
        positionX: slot.positionX,
        positionY: slot.positionY,
        slotId: slot.slotId,
      };
    })
    .filter(Boolean);
};

/**
 * Les placements que porte un pack, quelle que soit sa forme : pack v3 (`teams`)
 * ou composition ancienne (`placements` a la racine).
 *
 * 🧨 Les 2 formes circulent vraiment : la compo type d'equipe est rangee en
 * forme ancienne, le brouillon d'evenement en forme v3.
 * @param {any} [pack]
 * @returns {Array<{ playerId: string, positionX: number, positionY: number, slotId: string | null }>}
 */
export const readPlacementsFromPack = (pack) => {
  if (!pack || typeof pack !== 'object') return [];

  /** @type {any[]} */
  const raw = Array.isArray(pack?.placements)
    ? pack.placements
    : (Array.isArray(pack?.teams) ? pack.teams : [])
      .flatMap((/** @type {any} */ team) => (Array.isArray(team?.placements) ? team.placements : []));

  return raw
    .map((/** @type {any} */ placement) => {
      const playerId = String(placement?.playerId || '').trim();
      if (!playerId) return null;
      return {
        playerId,
        positionX: clampPercent(placement?.positionX),
        positionY: clampPercent(placement?.positionY),
        slotId: placement?.slotId ? String(placement.slotId) : null,
      };
    })
    .filter(Boolean);
};

/**
 * Ne garde que les placements dont le joueur est bien convoque. Un joueur
 * present dans la compo type mais PAS coche a l'ecran 1 ne doit pas reapparaitre
 * sur le terrain : il n'est pas convoque.
 * @param {any[]} placements
 * @param {any[]} [players] Les convoques.
 * @returns {any[]}
 */
export const keepPlacementsOfCalledUpPlayers = (placements, players = []) => {
  const calledUpIds = new Set(
    (Array.isArray(players) ? players : []).map(getCompositionPlayerId).filter(Boolean),
  );
  return (Array.isArray(placements) ? placements : [])
    .filter((placement) => calledUpIds.has(String(placement?.playerId || '')));
};

/**
 * Les 3 rangees de l'ecran 4, avec — pour chacune — ses placements de depart et,
 * quand elle n'a pas de source, la RAISON qui la grise.
 *
 * 🔒 Regle du pack tenue ici : une option sans source ne s'affiche JAMAIS comme
 * choisissable a vide. « Compo type » n'apparait que si l'equipe en a une ;
 * « Dernier match » que si le serveur en a vraiment renvoye une.
 *
 * ⚠️ MESURE (2026-08-12, `admin/src/api/event/services/event-composition.ts`,
 * `getBootstrapComposition`) : le serveur ne rend qu'UNE source, en cascade
 * ① brouillon ② compo type ③ derniere publiee ④ vide. « Dernier match » n'est
 * donc atteignable que si l'equipe n'a NI brouillon NI compo type — il n'existe
 * aucune route qui la donne separement.
 * @param {object} input
 * @param {any} [input.bootstrap] `bootstrap` de `GET /events/:id/composition`.
 * @param {any} [input.defaultComposition] Charge de `GET /teams/:id/default-composition`.
 * @param {any[]} [input.players] Les convoques de l'ecran 1.
 * @returns {Array<{ available: boolean, key: string, placements: any[], unavailableReason: string | null }>}
 */
export const buildStartFromOptions = ({
  bootstrap = null,
  defaultComposition = null,
  players = [],
}) => {
  const defaultPlacements = keepPlacementsOfCalledUpPlayers(
    readPlacementsFromPack(defaultComposition?.composition || defaultComposition),
    players,
  );

  const bootstrapSource = String(bootstrap?.source || '').trim();
  const lastMatchPlacements = bootstrapSource === START_FROM_LAST_MATCH
    ? keepPlacementsOfCalledUpPlayers(readPlacementsFromPack(bootstrap?.composition), players)
    : [];

  // Le pack ecrit « Compo type · 4-3-3 » et « La compo de samedi dernier » : ces
  // deux precisions sont des DONNEES, pas du decor. Le schema vient du pack
  // enregistre, la date de l'evenement que le serveur joint a sa reprise. Quand
  // l'une manque, l'ecran retombe sur le libelle general — jamais sur un trou.
  const defaultPack = defaultComposition?.composition || defaultComposition;
  const presetLabel = normalizeLabel(
    defaultPack?.teams?.[0]?.presetLabel || defaultPack?.presetLabel,
  );
  const lastMatchDate = bootstrapSource === START_FROM_LAST_MATCH
    ? normalizeLabel(bootstrap?.event?.date)
    : '';

  // Terrain vide : le seul point de depart qui n'a besoin d'aucune donnee, donc
  // le seul qui ne peut jamais etre grise.
  return [
    {
      available: true,
      detail: '',
      key: START_FROM_EMPTY,
      placements: [],
      unavailableReason: null,
    },
    {
      available: defaultPlacements.length > 0,
      detail: presetLabel,
      key: START_FROM_DEFAULT,
      placements: defaultPlacements,
      unavailableReason: defaultPlacements.length > 0 ? null : 'noDefaultComposition',
    },
    {
      available: lastMatchPlacements.length > 0,
      detail: lastMatchDate,
      key: START_FROM_LAST_MATCH,
      placements: lastMatchPlacements,
      unavailableReason: lastMatchPlacements.length > 0 ? null : 'noLastMatch',
    },
  ];
};

/**
 * Le point de depart coche a l'ouverture : « Compo type » quand elle existe
 * (c'est le defaut du pack), sinon la premiere option disponible.
 * @param {ReturnType<typeof buildStartFromOptions>} options
 * @returns {string}
 */
export const getDefaultStartFromKey = (options) => {
  const preferred = (Array.isArray(options) ? options : [])
    .find((option) => option?.key === START_FROM_DEFAULT && option?.available);
  if (preferred) return START_FROM_DEFAULT;
  return START_FROM_EMPTY;
};

/**
 * Le poste libre le plus proche du point lache, dans le rayon d'aimantation.
 * @param {object} input
 * @param {Set<string> | string[]} [input.occupiedSlotIds]
 * @param {any[]} [input.slots]
 * @param {number} input.x Pourcentage horizontal.
 * @param {number} input.y Pourcentage vertical.
 * @returns {any} Le poste, ou `null` si aucun n'est assez proche.
 */
export const snapToNearestSlot = ({
  occupiedSlotIds = [], slots = [], x, y,
}) => {
  const occupied = occupiedSlotIds instanceof Set ? occupiedSlotIds : new Set(occupiedSlotIds);
  let best = null;
  let bestDistance = Infinity;

  (Array.isArray(slots) ? slots : []).forEach((slot) => {
    if (!slot || occupied.has(slot.slotId)) return;
    const dx = clampPercent(slot.positionX) - Number(x);
    const dy = clampPercent(slot.positionY) - Number(y);
    const distance = Math.sqrt((dx * dx) + (dy * dy));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  });

  return bestDistance <= MAGNET_RADIUS ? best : null;
};

/**
 * Pose un joueur sur le terrain : il quitte d'abord toute position qu'il
 * occupait, puis il est place — aimante au poste libre le plus proche si
 * l'aimantation est allumee, a l'endroit exact du doigt sinon.
 * @param {object} input
 * @param {boolean} [input.magnetEnabled]
 * @param {any[]} [input.placements]
 * @param {string} input.playerId
 * @param {any[]} [input.slots]
 * @param {number} input.x
 * @param {number} input.y
 * @returns {any[]} Les placements apres depot.
 */
export const placePlayerAt = ({
  magnetEnabled = false, placements = [], playerId, slots = [], x, y,
}) => {
  const id = String(playerId || '');
  if (!id) return Array.isArray(placements) ? placements : [];

  const others = (Array.isArray(placements) ? placements : [])
    .filter((placement) => String(placement?.playerId || '') !== id);
  const snapped = magnetEnabled
    ? snapToNearestSlot({
      occupiedSlotIds: others.map((placement) => placement?.slotId).filter(Boolean),
      slots,
      x,
      y,
    })
    : null;

  return [...others, snapped
    ? {
      playerId: id,
      positionX: clampPercent(snapped.positionX),
      positionY: clampPercent(snapped.positionY),
      slotId: snapped.slotId,
    }
    : {
      playerId: id,
      positionX: clampPercent(x),
      positionY: clampPercent(y),
      slotId: null,
    }];
};

/**
 * Sort un joueur du terrain — il revient au banc.
 * @param {any[]} [placements]
 * @param {string} playerId
 * @returns {any[]}
 */
export const removePlayerFromField = (placements, playerId) => {
  const id = String(playerId || '');
  return (Array.isArray(placements) ? placements : [])
    .filter((placement) => String(placement?.playerId || '') !== id);
};

/**
 * Les joueurs restes au banc : les convoques que le terrain ne porte pas.
 * @param {any[]} [players] Les convoques.
 * @param {any[]} [placements]
 * @returns {any[]}
 */
export const getBenchPlayers = (players = [], placements = []) => {
  const placedIds = new Set(
    (Array.isArray(placements) ? placements : [])
      .map((placement) => String(placement?.playerId || ''))
      .filter(Boolean),
  );
  return (Array.isArray(players) ? players : [])
    .filter((player) => !placedIds.has(getCompositionPlayerId(player)));
};

/**
 * Les chiffres de la ligne de pastilles de l'ecran 5 et du recapitulatif de
 * l'ecran 6. Branches sur les VRAIES donnees : `placed` compte le terrain,
 * jamais l'effectif theorique du sport.
 * @param {object} input
 * @param {any[]} [input.manualPlayers]
 * @param {any[]} [input.placements]
 * @param {any[]} [input.players] Les convoques.
 * @param {string} [input.sport]
 * @returns {{ bench: number, calledUp: number, offApp: number, placed: number, starters: number }}
 */
export const getBoardCounters = ({
  manualPlayers = [], placements = [], players = [], sport,
}) => {
  const calledUpList = Array.isArray(players) ? players : [];
  const calledUpIds = new Set(calledUpList.map(getCompositionPlayerId).filter(Boolean));
  const bench = getBenchPlayers(calledUpList, placements).length;
  const placed = calledUpList.length - bench;
  const sizes = getMatchSquadSizes(getTacticalSportKey(sport));

  // Seuls les joueurs hors app REELLEMENT convoques comptent : la liste des
  // joueurs saisis a la main peut en contenir que le coach a decoche.
  const offApp = (Array.isArray(manualPlayers) ? manualPlayers : [])
    .filter((player) => calledUpIds.has(getCompositionPlayerId(player)))
    .length;

  return {
    bench,
    calledUp: calledUpList.length,
    offApp,
    placed,
    // Le denominateur de la pastille « N/M places ». Sport inconnu = pas de
    // theorie : on ne montre que ce qui est vraiment sur le terrain.
    starters: sizes ? sizes.starters : placed,
  };
};

/**
 * Range les placements dans la forme de pack que
 * `buildDraftPayloadFromPack` sait deja envoyer, et y ajoute les 2 reglages de
 * publication de l'ecran 6.
 *
 * 🔑 `requireResponse` et `visibility` vivent a la RACINE du pack : c'est
 * exactement la que le serveur (D73, `event-composition.ts`) les lit.
 * @param {object} input
 * @param {any} [input.basePack] Le pack a mettre a jour (garde son identite d'equipe).
 * @param {any[]} [input.manualPlayers]
 * @param {any[]} [input.placements]
 * @param {any[]} [input.players] Les convoques.
 * @param {boolean} [input.requireResponse]
 * @param {string} [input.sport]
 * @param {string} [input.teamName]
 * @param {string} [input.visibility]
 * @returns {any}
 */
export const buildMatchCompositionPack = ({
  basePack = null,
  manualPlayers = [],
  placements = [],
  players = [],
  requireResponse = true,
  sport,
  teamName = '',
  visibility = 'team',
}) => {
  const teamEntryId = String(basePack?.teams?.[0]?.id || 'team_1');
  const reservePlayerIds = getBenchPlayers(players, placements)
    .map(getCompositionPlayerId)
    .filter(Boolean);

  return {
    manualPlayers: Array.isArray(manualPlayers) ? manualPlayers : [],
    mode: 'manual',
    // Placement libre : c'est le defaut du pack, et l'aimantation de l'ecran 4
    // n'est qu'une aide de saisie — elle a deja fait son travail au moment ou le
    // jeton s'est pose, elle n'a rien a dire au serveur.
    placementMode: 'free',
    requireResponse: requireResponse !== false,
    reservePlayerIds,
    schemaVersion: 3,
    selectedPlayerIds: (Array.isArray(players) ? players : [])
      .map(getCompositionPlayerId)
      .filter(Boolean),
    sportContext: getTacticalSportKey(sport),
    teams: [{
      id: teamEntryId,
      name: String(teamName || basePack?.teams?.[0]?.name || 'Équipe'),
      placements: (Array.isArray(placements) ? placements : []).map((placement) => ({
        playerId: String(placement?.playerId || ''),
        positionX: clampPercent(placement?.positionX),
        positionY: clampPercent(placement?.positionY),
        slotId: placement?.slotId || null,
      })).filter((placement) => Boolean(placement.playerId)),
      presetKey: basePack?.teams?.[0]?.presetKey || null,
      presetLabel: basePack?.teams?.[0]?.presetLabel || null,
      slots: buildFormationSlots(sport, teamEntryId),
    }],
    visibility: visibility === 'called_only' ? 'called_only' : 'team',
  };
};
