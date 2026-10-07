/**
 * MESSAGERIE-1C — LA CONVOCATION DEPUIS LE GROUPE D'EQUIPE (pack messagerie, §3.5 et §3.12).
 *
 * Tout ce qui se calcule sans rendu vit ici : qui voit l'entree « Convocation », les
 * evenements de l'equipe, l'effectif a cocher, les joueurs a la main REPROPOSES, le 4-3-3 de
 * depart, le pack a publier, les reponses deja donnees, et la notice « Composition modifiee ».
 *
 * ⛔ AUCUN MECANISME NEUF COTE SERVEUR. Publier, c'est les 2 appels du plateau existant
 * (`MatchCompositionBoard`, `handlePublish`) : le brouillon d'abord, puis la publication. Le pack
 * est fabrique par `buildMatchCompositionPack`, le meme que le plateau : le serveur ne voit AUCUNE
 * difference entre une convocation faite dans le fil et une convocation faite depuis le match.
 *
 * 🔒 « manuels B » (Adel, 07/10) — LES JOUEURS AJOUTES A LA MAIN SONT REPROPOSES DEPUIS LA
 * DERNIERE CONVOCATION PUBLIEE DE L'EQUIPE, DECOCHES. Contrainte mesuree au serveur, et c'est elle
 * qui dicte la forme du pack : tout joueur range dans `manualPlayers` y est CONVOQUE D'OFFICE
 * (`buildConvocationFilter`, `admin/src/api/event/services/event-composition.ts:750`), et pose au
 * banc s'il n'est pas sur le terrain (`buildPackState`). Un joueur a la main DECOCHE ne doit donc
 * JAMAIS partir dans le pack : il apparaitrait « Sur le banc » chez toute l'equipe.
 */

import { getUserRoleKey } from '@/domains/auth/authUseCases';

import { isManualCallUpPlayer } from '@/views/matchCallUp/matchCallUpUtils';
import {
  buildMatchCompositionPack,
  readCalledUpIdsFromPack,
  readPlacementsFromPack,
} from '@/views/matchCallUp/matchCompositionUtils';
import {
  buildConvocationRoster,
  buildPlayerIndex,
} from '@/views/matchCallUp/matchConvocationUtils';
import { getMatchFormations } from '@/views/matchCallUp/matchFormationCatalog';
import {
  formatConvocationDay,
  formatConvocationTime,
} from '@/views/playerConvocation/playerConvocationUtils';

import {
  getCompositionPlayerId,
  getCompositionPlayerLabel,
  isCompositionPerson,
} from '@/utils/compositionPlayer';
import { getShortAddress } from '@/utils/location';

/** Les 4 etapes de l'assistant, dans l'ordre du pack. */
export const CONVOCATION_STEPS = ['event', 'players', 'placement', 'details'];

/** Le joueur coche joue sur le terrain. */
export const SIDE_PITCH = 'pitch';
/** Le joueur coche est convoque au banc. */
export const SIDE_BENCH = 'bench';

/** Le message du fil qui porte une composition publiee. */
export const LINEUP_SHARE_TYPE = 'lineup_share';

/** Le rendez-vous propose par defaut (pack §3.12, etape Details). */
export const DEFAULT_MEETING_POINT = '13h30 au club';

/** Une pastille ne sort jamais du terrain : 5 % de marge de chaque cote (pack §5). */
export const PITCH_MIN_PERCENT = 5;
export const PITCH_MAX_PERCENT = 95;

const asArray = (/** @type {any} */ value) => (Array.isArray(value) ? value : []);

const toId = (/** @type {any} */ value) => String(value ?? '').trim();

/**
 * Une position de pastille, ramenee dans le terrain.
 * @param {any} value Pourcentage brut.
 * @returns {number}
 */
export const clampPitchPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(PITCH_MAX_PERCENT, Math.max(PITCH_MIN_PERCENT, Math.round(number * 10) / 10));
};

/**
 * L'equipe d'un fil, quand c'est un fil d'EQUIPE.
 * @param {any} chat La fiche du fil (`useGetChatById`).
 * @returns {string} Vide pour tout autre fil (prive, groupe, club, Ville).
 */
export const getTeamIdOfChat = (chat) => {
  if (toId(chat?.type) !== 'team') return '';
  return toId(chat?.team?.documentId || chat?.team?.id);
};

/**
 * 🔒 « convoquer entraineurs » (Adel, 07/10) — QUI VOIT L'ENTREE « CONVOCATION ».
 *
 * La regle est celle du serveur, recopiee sans rien y ajouter : `is-event-trainer` laisse passer
 * le super-admin, et `ensureCanManageTeam` un ENTRAINEUR de l'equipe (`team.trainers`, que l'app
 * lit dans `trainedTeams`). Un dirigeant qui n'entraine pas cette equipe ne la voit pas : le
 * serveur le refuserait.
 * @param {object} input
 * @param {any} input.chat La fiche du fil.
 * @param {any} input.user L'utilisateur connecte (`userData`).
 * @returns {boolean}
 */
export const canConvokeFromChat = ({ chat, user }) => {
  const teamId = getTeamIdOfChat(chat);
  if (!teamId || !user) return false;
  if (getUserRoleKey(user?.role?.type || user?.role?.name) === 'superAdmin') return true;
  return asArray(user?.trainedTeams).some((team) => toId(team?.documentId || team?.id) === teamId);
};

/**
 * L'evenement concerne-t-il cette equipe (organisatrice OU invitee) ?
 * @param {any} event
 * @param {string} teamId
 * @returns {boolean}
 */
export const isEventOfTeam = (event, teamId) => {
  const id = toId(teamId);
  if (!id || !event) return false;
  if (toId(event?.team?.documentId || event?.team?.id) === id) return true;
  return asArray(event?.invitedTeams)
    .some((team) => toId(team?.documentId || team?.id) === id);
};

/**
 * Les evenements a venir de l'equipe, sans doublon, du plus proche au plus lointain.
 * @param {any[]} events
 * @param {string} teamId
 * @returns {any[]}
 */
export const filterTeamEvents = (events, teamId) => {
  const seen = new Set();
  return asArray(events)
    .filter((event) => {
      const eventId = toId(event?.documentId || event?.id);
      if (!eventId || seen.has(eventId) || !isEventOfTeam(event, teamId)) return false;
      seen.add(eventId);
      return true;
    })
    .sort((left, right) => (Date.parse(left?.date) || 0) - (Date.parse(right?.date) || 0));
};

const normalizeTypeName = (/** @type {any} */ value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/**
 * L'evenement peut-il recevoir une convocation depuis le groupe ?
 *
 * ⛔ Une detection n'a pas de carte dans le fil d'equipe (le serveur ne la poste pas,
 * `publishLineupShareToTeamChat`), une reservation ou un tournoi n'ont pas de composition
 * d'equipe, et un stage se convoque jour par jour.
 * @param {any} event
 * @returns {boolean}
 */
export const isConvocableEvent = (event) => {
  const typeName = normalizeTypeName(event?.type?.name || event?.type);
  if (['detection', 'reservation', 'tournoi'].some((word) => typeName.includes(word))) return false;
  return normalizeTypeName(event?.eventFormat) !== 'stage_parent';
};

/**
 * Le rappel de l'evenement en tete des etapes 2 a 4 : son type, son titre, quand et ou.
 * Il se lit sur une carte d'evenement (`useGetEvents`) comme sur la carte d'une convocation
 * deja publiee (`eventDisplayName`, `eventDate`, `eventAddress`).
 * @param {any} event
 * @returns {{ place: string, title: string, typeKey: 'match' | 'training' | 'other',
 *   typeLabel: string, when: string }}
 */
export const buildEventSummary = (event) => {
  const typeLabel = String(event?.type?.name || event?.typeName || '').trim();
  const normalized = normalizeTypeName(typeLabel);
  let typeKey = /** @type {'match' | 'training' | 'other'} */ ('other');
  if (normalized.includes('match')) typeKey = 'match';
  else if (normalized.includes('entrainement') || normalized.includes('training')) {
    typeKey = 'training';
  }
  const date = event?.date || event?.eventDate || '';
  return {
    place: String(
      event?.facility?.name
      || getShortAddress(event?.locationDetails)
      || getShortAddress(event?.location)
      || event?.eventAddress
      || '',
    ).trim(),
    title: String(
      event?.displayName || event?.eventDisplayName || event?.name || event?.eventName || typeLabel,
    ).trim(),
    typeKey,
    typeLabel,
    when: [formatConvocationDay(date), formatConvocationTime(date)].filter(Boolean).join(' · '),
  };
};

/**
 * Une composition portee par un message du fil, ramenee a la forme d'un pack.
 * @param {any} composition Le `composition` d'un message `lineup_share`.
 * @returns {any}
 */
export const readPackFromLineupMessage = (composition) => ({
  manualPlayers: asArray(composition?.manualPlayers),
  reservePlayerIds: asArray(composition?.reservePlayers)
    .map(getCompositionPlayerId)
    .filter(Boolean),
  snapshotPlayers: [
    ...asArray(composition?.snapshotPlayers),
    ...asArray(composition?.reservePlayers),
  ],
  teams: asArray(composition?.teams).length
    ? asArray(composition?.teams)
    : [{ placements: asArray(composition?.placements) }],
});

/**
 * Les messages `lineup_share` d'une equipe (et d'un evenement, si on le donne).
 * @param {any[]} messages Les messages bruts du fil (cache react-query, `.composition`).
 * @param {{ eventId?: string, teamId?: string }} [filter]
 * @returns {any[]} Les compositions, sans le message autour.
 */
const readLineupCompositions = (messages, { eventId = '', teamId = '' } = {}) => asArray(messages)
  .map((message) => message?.composition)
  .filter((composition) => toId(composition?.type) === LINEUP_SHARE_TYPE)
  .filter((composition) => !teamId || !toId(composition?.teamId)
    || toId(composition?.teamId) === toId(teamId))
  .filter((composition) => !eventId || toId(composition?.eventId) === toId(eventId));

const publicationStamp = (/** @type {any} */ composition) => (
  Date.parse(String(composition?.publishedAt || '')) || 0
);

/**
 * Ne garde que des joueurs a la main, une seule fois chacun.
 * @param {any[]} players
 * @returns {any[]}
 */
const keepManualPlayers = (players) => {
  const seen = new Set();
  return asArray(players).filter((player) => {
    const playerId = getCompositionPlayerId(player);
    if (!playerId || seen.has(playerId) || !isManualCallUpPlayer(player)) return false;
    seen.add(playerId);
    return true;
  });
};

/**
 * 🔒 « manuels B » — LES JOUEURS A LA MAIN DE LA DERNIERE CONVOCATION PUBLIEE DE L'EQUIPE.
 *
 * Aucune route ne la donne seule (`matchCompositionUtils.js:300`). Deux sources, dans cet ordre :
 *   ① le dernier message `lineup_share` DEJA charge dans ce fil d'equipe — c'est la que chaque
 *     publication de l'equipe arrive, et le lire ne coute aucune requete ;
 *   ② a defaut, le « dernier match » que le serveur joint deja a `GET /events/:id/composition`
 *     (`bootstrap.source === 'last_match'`, ou `bootstrap.lastMatch`).
 * @param {object} input
 * @param {any} [input.bootstrap] `bootstrap` de `GET /events/:id/composition`.
 * @param {any[]} [input.messages] Les messages bruts deja charges du fil.
 * @param {string} [input.teamId]
 * @returns {any[]} Les joueurs a la main, sans doublon.
 */
export const findLastPublishedManualPlayers = ({
  bootstrap = null, messages = [], teamId = '',
} = {}) => {
  const lastShared = readLineupCompositions(messages, { teamId })
    .sort((left, right) => publicationStamp(right) - publicationStamp(left)
      || (Number(right?.publishedVersion) || 0) - (Number(left?.publishedVersion) || 0))[0];
  if (lastShared) return keepManualPlayers(lastShared?.manualPlayers);

  const lastMatch = toId(bootstrap?.source) === 'last_match' ? bootstrap : bootstrap?.lastMatch;
  return keepManualPlayers(lastMatch?.composition?.manualPlayers);
};

/**
 * Qui est deja convoque, et ou, dans un pack publie.
 * @param {any} [pack]
 * @returns {Record<string, string>} identifiant -> `pitch` | `bench`.
 */
export const buildSelectionFromPack = (pack) => {
  /** @type {Record<string, string>} */
  const selection = {};
  if (!pack || typeof pack !== 'object') return selection;

  const calledUp = new Set(readCalledUpIdsFromPack(pack));
  readPlacementsFromPack(pack).forEach((placement) => {
    if (calledUp.has(placement.playerId)) selection[placement.playerId] = SIDE_PITCH;
  });
  calledUp.forEach((playerId) => {
    if (!selection[playerId]) selection[playerId] = SIDE_BENCH;
  });
  return selection;
};

/**
 * La liste de l'etape Joueurs : l'effectif, puis les convoques d'un pack publie que l'effectif ne
 * connait plus (un renfort, un joueur parti), puis les joueurs a la main.
 *
 * ⛔ Un convoque que la liste oublierait serait RETIRE de la convocation a la republication sans
 * que personne l'ait decide : c'est pourquoi le pack publie y verse ses propres joueurs.
 * @param {object} input
 * @param {any[]} [input.addedManualPlayers] Saisis pendant cette convocation.
 * @param {any[]} [input.eligiblePlayers] L'effectif que le serveur rend pour cet evenement.
 * @param {any} [input.publishedPack] La convocation deja publiee de cet evenement.
 * @param {any[]} [input.reinforcementPlayers]
 * @param {string[]} [input.removedIds] Les joueurs a la main « retires de la liste ».
 * @param {any[]} [input.reproposedManualPlayers] Ceux de la derniere convocation de l'equipe.
 * @returns {Array<{ id: string, isManual: boolean, player: any }>}
 */
export const buildConvocationRows = ({
  addedManualPlayers = [],
  eligiblePlayers = [],
  publishedPack = null,
  reinforcementPlayers = [],
  removedIds = [],
  reproposedManualPlayers = [],
}) => {
  const removed = new Set(asArray(removedIds).map(toId));
  const seen = new Set();
  /** @type {Array<{ id: string, isManual: boolean, player: any }>} */
  const rows = [];
  const push = (/** @type {any} */ player) => {
    const id = getCompositionPlayerId(player);
    if (!id || seen.has(id) || !isCompositionPerson(player)) return;
    const isManual = isManualCallUpPlayer(player);
    if (isManual && removed.has(id)) return;
    seen.add(id);
    rows.push({ id, isManual, player });
  };

  asArray(eligiblePlayers).forEach(push);

  const calledUp = new Set(readCalledUpIdsFromPack(publishedPack));
  const index = new Map();
  [
    ...asArray(reinforcementPlayers),
    ...asArray(publishedPack?.snapshotPlayers),
    ...asArray(publishedPack?.reserveSnapshotPlayers),
  ].forEach((player) => {
    const id = getCompositionPlayerId(player);
    if (id && !index.has(id)) index.set(id, player);
  });
  calledUp.forEach((playerId) => {
    const player = index.get(playerId);
    if (player && !isManualCallUpPlayer(player)) push(player);
  });

  keepManualPlayers([
    ...asArray(publishedPack?.manualPlayers),
    ...asArray(reproposedManualPlayers),
    ...asArray(addedManualPlayers),
  ]).forEach(push);

  return rows;
};

/**
 * Coche ou decoche un joueur. Coche, il part sur le terrain (pack §5).
 * @param {Record<string, string>} selection
 * @param {string} playerId
 * @returns {Record<string, string>}
 */
export const toggleConvocationSelection = (selection, playerId) => {
  const next = { ...(selection || {}) };
  if (next[playerId]) delete next[playerId];
  else next[playerId] = SIDE_PITCH;
  return next;
};

/**
 * « Tout l'effectif » : coche chaque joueur de l'effectif qui ne l'est pas encore. Les joueurs a la
 * main restent tels quels (pack : ils sont reproposes DECOCHES, c'est a l'entraineur de choisir).
 * @param {Record<string, string>} selection
 * @param {Array<{ id: string, isManual: boolean }>} rows
 * @returns {Record<string, string>}
 */
export const selectWholeSquad = (selection, rows) => {
  const next = { ...(selection || {}) };
  asArray(rows).forEach((row) => {
    if (!row?.isManual && row?.id && !next[row.id]) next[row.id] = SIDE_PITCH;
  });
  return next;
};

/**
 * Les postes de depart : la PREMIERE compo type du sport (4-3-3 au football a 11), la meme que
 * tous les ecrans de composition (`matchFormationCatalog`).
 * @param {string} [sport]
 * @param {string} [category]
 * @returns {Array<{ positionX: number, positionY: number }>}
 */
export const getDefaultFormationSlots = (sport, category) => {
  const [first] = getMatchFormations(sport, category);
  return asArray(first?.slots).map((slot) => ({
    positionX: Number(slot?.positionX) || 50,
    positionY: Number(slot?.positionY) || 50,
  }));
};

/**
 * La place d'un titulaire que la compo type ne prevoit pas (sport sans terrain a postes, ou plus
 * de titulaires que de postes) : une rangee au milieu du terrain, puis la suivante.
 * @param {number} index Rang du joueur parmi ceux qui n'ont pas de poste.
 * @returns {{ positionX: number, positionY: number }}
 */
const overflowPosition = (index) => ({
  positionX: clampPitchPercent(14 + (index % 5) * 18),
  positionY: clampPitchPercent(44 + Math.floor(index / 5) * 12),
});

/**
 * Les placements du terrain : ceux deja poses sont gardes, les nouveaux titulaires prennent les
 * postes libres de la compo type, dans l'ordre.
 * @param {object} input
 * @param {string} [input.category]
 * @param {any[]} [input.placements] Les placements deja poses.
 * @param {string} [input.sport]
 * @param {string[]} [input.starterIds] Les titulaires, dans l'ordre de la liste.
 * @returns {Array<{ playerId: string, positionX: number, positionY: number, slotId: null }>}
 */
export const buildPitchPlacements = ({
  category = '', placements = [], sport = '', starterIds = [],
}) => {
  const starters = asArray(starterIds).map(toId).filter(Boolean);
  const kept = new Map();
  asArray(placements).forEach((placement) => {
    const playerId = toId(placement?.playerId);
    if (!playerId || !starters.includes(playerId) || kept.has(playerId)) return;
    kept.set(playerId, {
      playerId,
      positionX: clampPitchPercent(placement?.positionX),
      positionY: clampPitchPercent(placement?.positionY),
      slotId: null,
    });
  });

  // Un poste est pris si une pastille deja posee est a moins de 6 % de lui.
  const isTaken = (/** @type {any} */ slot) => Array.from(kept.values()).some((placement) => (
    Math.abs(placement.positionX - slot.positionX) < 6
    && Math.abs(placement.positionY - slot.positionY) < 6
  ));
  const freeSlots = getDefaultFormationSlots(sport, category).filter((slot) => !isTaken(slot));
  let overflow = 0;

  return starters.map((playerId) => {
    if (kept.has(playerId)) return kept.get(playerId);
    const slot = freeSlots.shift();
    const position = slot || overflowPosition(overflow);
    if (!slot) overflow += 1;
    return {
      playerId,
      positionX: clampPitchPercent(position.positionX),
      positionY: clampPitchPercent(position.positionY),
      slotId: null,
    };
  });
};

/**
 * Deplace une pastille, en la gardant dans le terrain.
 * @param {any[]} placements
 * @param {string} playerId
 * @param {number} positionX
 * @param {number} positionY
 * @returns {any[]}
 */
export const movePlacement = (placements, playerId, positionX, positionY) => asArray(placements)
  .map((placement) => (toId(placement?.playerId) === toId(playerId)
    ? {
      ...placement,
      positionX: clampPitchPercent(positionX),
      positionY: clampPitchPercent(positionY),
    }
    : placement));

/**
 * Les convoques, terrain d'abord, banc ensuite, dans l'ordre de la liste.
 * @param {Array<{ id: string, isManual: boolean, player: any }>} rows
 * @param {Record<string, string>} selection
 * @returns {{ bench: any[], pitch: any[] }} Les LIGNES de la liste.
 */
export const splitSelection = (rows, selection) => ({
  bench: asArray(rows).filter((row) => selection?.[row.id] === SIDE_BENCH),
  pitch: asArray(rows).filter((row) => selection?.[row.id] === SIDE_PITCH),
});

/**
 * LE PACK QUI PART AU SERVEUR — la forme exacte du plateau (`buildMatchCompositionPack`).
 *
 * 🔒 Deux regles, et ce sont elles que les temoins figent :
 *   · les positions envoyees sont celles du terrain de l'assistant (`positionX` / `positionY`) ;
 *   · seuls les joueurs a la main COCHES partent dans `manualPlayers` (voir l'en-tete du fichier).
 * ⚠️ Un titulaire SANS placement serait range au banc par `buildMatchCompositionPack` : les
 * placements sont donc completes ici (poste libre de la compo type) avant de partir.
 * @param {object} input
 * @param {any} [input.basePack] Le pack deja publie (il garde l'identite de son equipe).
 * @param {string} [input.category] La categorie de l'equipe (format du football).
 * @param {any[]} [input.placements] Les placements du terrain.
 * @param {boolean} [input.requireResponse] « Demander Present / Absent ».
 * @param {Array<{ id: string, isManual: boolean, player: any }>} [input.rows]
 * @param {Record<string, string>} [input.selection]
 * @param {string} [input.sport]
 * @param {string} [input.teamName]
 * @returns {any}
 */
export const buildConvocationPack = ({
  basePack = null,
  category = '',
  placements = [],
  requireResponse = true,
  rows = [],
  selection = {},
  sport = '',
  teamName = '',
}) => {
  const { bench, pitch } = splitSelection(rows, selection);
  const convoked = [...pitch, ...bench];

  return buildMatchCompositionPack({
    basePack,
    manualPlayers: convoked.filter((row) => row.isManual).map((row) => row.player),
    placements: buildPitchPlacements({
      category, placements, sport, starterIds: pitch.map((row) => row.id),
    }),
    players: convoked.map((row) => row.player),
    requireResponse,
    sport,
    teamName,
    visibility: 'team',
  });
};

/**
 * La reponse deja donnee par un joueur, pour l'etape Joueurs en modification.
 * @param {any} responses `{ byPlayerId }` de `GET /events/:id/composition`.
 * @param {{ id: string, isManual: boolean }} row
 * @returns {'present' | 'absent' | 'manual' | null}
 */
export const getRowAnswer = (responses, row) => {
  if (row?.isManual) return 'manual';
  const answer = responses?.byPlayerId?.[row?.id];
  if (answer === 'present' || answer === 'absent') return answer;
  return null;
};

/**
 * 🔒 LA REGLE D'AFFICHAGE « JOUEURS A LA MAIN COMPTES PRESENTS D'OFFICE » (prompt 1C, point 4).
 *
 * Le serveur les EXCLUT des reponses (ils n'ont pas de compte, `buildConvocationResponses`) et
 * ne doit pas changer. C'est donc ICI, a l'affichage seulement, qu'ils rejoignent les presents.
 * @param {object} input
 * @param {any} [input.published] Le pack publie (`GET /events/:id/convocation`).
 * @param {any} [input.responses] `{ byPlayerId, counts }` du serveur.
 * @returns {{ absent: string[], pending: string[], present: string[] }} Les NOMS, dans l'ordre
 *   du pack (terrain puis banc).
 */
export const buildAnswerGroups = ({ published = null, responses = null } = {}) => {
  /** @type {{ absent: string[], pending: string[], present: string[] }} */
  const groups = { absent: [], pending: [], present: [] };
  buildConvocationRoster({ published, responses }).forEach((row) => {
    const name = getCompositionPlayerLabel(row?.player);
    if (row?.isManual || row?.response === 'present') groups.present.push(name);
    else if (row?.response === 'absent') groups.absent.push(name);
    else groups.pending.push(name);
  });
  return groups;
};

/**
 * Les convoques (terrain et banc) d'une composition de message, ranges par identifiant.
 * @param {any} composition
 * @returns {string[]}
 */
const readConvokedIds = (composition) => readCalledUpIdsFromPack(
  readPackFromLineupMessage(composition),
);

/**
 * 📣 LA NOTICE « COMPOSITION MODIFIEE (v3) : X REMPLACE Y » — deduite des messages du fil.
 *
 * Chaque publication poste un NOUVEAU message `lineup_share` (version + 1) : la version d'avant
 * est donc dans le fil, et la difference se lit sans serveur. Une seule notice par composition :
 * seule la DERNIERE version chargee la porte.
 * @param {object} input
 * @param {any} input.composition La composition du message a annoter.
 * @param {any[]} [input.messages] Les messages bruts deja charges du fil.
 * @returns {null | {
 *   added: number,
 *   entering: string,
 *   kind: 'replaced' | 'changed' | 'updated',
 *   leaving: string,
 *   removed: number,
 *   version: number,
 * }} `null` = pas de notice (premiere version, ou une version plus recente existe).
 */
export const buildLineupUpdateNotice = ({ composition, messages = [] }) => {
  const version = Number(composition?.publishedVersion) || 0;
  if (toId(composition?.type) !== LINEUP_SHARE_TYPE || version <= 1) return null;

  const siblings = readLineupCompositions(messages, {
    eventId: toId(composition?.eventId),
    teamId: toId(composition?.teamId),
  });
  if (siblings.some((other) => (Number(other?.publishedVersion) || 0) > version)) return null;

  const previous = siblings
    .filter((other) => (Number(other?.publishedVersion) || 0) < version)
    .sort((left, right) => (Number(right?.publishedVersion) || 0)
      - (Number(left?.publishedVersion) || 0))[0];
  const empty = {
    added: 0,
    entering: '',
    kind: /** @type {'updated'} */ ('updated'),
    leaving: '',
    removed: 0,
    version,
  };
  if (!previous) return empty;

  const before = readConvokedIds(previous);
  const after = readConvokedIds(composition);
  const leavingIds = before.filter((playerId) => !after.includes(playerId));
  const enteringIds = after.filter((playerId) => !before.includes(playerId));
  if (!leavingIds.length && !enteringIds.length) return empty;

  const index = new Map([
    ...buildPlayerIndex(readPackFromLineupMessage(previous)),
    ...buildPlayerIndex(readPackFromLineupMessage(composition)),
  ]);
  const nameOf = (/** @type {string} */ playerId) => getCompositionPlayerLabel(index.get(playerId));

  if (leavingIds.length === 1 && enteringIds.length === 1) {
    return {
      added: 1,
      entering: nameOf(enteringIds[0]),
      kind: 'replaced',
      leaving: nameOf(leavingIds[0]),
      removed: 1,
      version,
    };
  }
  return {
    added: enteringIds.length,
    entering: '',
    kind: 'changed',
    leaving: '',
    removed: leavingIds.length,
    version,
  };
};

/**
 * La composition affichee par ce message est-elle la plus recente de son evenement dans le fil ?
 * Le bloc « Reponses » ne se pose que sur elle : une seule fois par composition.
 * @param {object} input
 * @param {any} input.composition
 * @param {any[]} [input.messages]
 * @returns {boolean}
 */
export const isLatestLineupComposition = ({ composition, messages = [] }) => {
  const version = Number(composition?.publishedVersion) || 0;
  return !readLineupCompositions(messages, {
    eventId: toId(composition?.eventId),
    teamId: toId(composition?.teamId),
  }).some((other) => (Number(other?.publishedVersion) || 0) > version);
};

/**
 * Le message texte qui suit la convocation : « Rendez-vous » et « Infos » n'ont AUCUN champ dans
 * la composition ni dans sa carte (l'« Infos » de la carte est la description de l'evenement,
 * `event-composition.ts:2344`). Ils partent donc dans le fil, comme un message de l'entraineur.
 * @param {object} input
 * @param {string} [input.infos]
 * @param {string} [input.infosLabel]
 * @param {string} [input.meetingLabel]
 * @param {string} [input.meetingPoint]
 * @returns {string} Vide quand il n'y a rien a dire.
 */
export const buildDetailsMessageText = ({
  infos = '', infosLabel = 'Infos', meetingLabel = 'Rendez-vous', meetingPoint = '',
}) => [
  String(meetingPoint || '').trim() ? `${meetingLabel} : ${String(meetingPoint).trim()}` : '',
  String(infos || '').trim() ? `${infosLabel} : ${String(infos).trim()}` : '',
].filter(Boolean).join('\n');
