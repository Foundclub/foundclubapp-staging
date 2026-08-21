/**
 * C-C — ECRAN 10 du pack composition : « Tu es convoqué », la vue du JOUEUR.
 *
 * Tout ce qui se DECIDE sans rendu vit ici, et une seule decision compte :
 * **est-ce que cette personne est convoquee, oui ou non ?** Le serveur envoie la
 * meme notification a toute l'equipe *(mesure : `notification.ts:2054-2062` ajoute
 * les entraineurs, l'organisateur et les absents en plus des convoques)* : l'ecran
 * ne peut donc PAS supposer que celui qui l'ouvre est convoque.
 *
 * ⛔ Aucun mecanisme neuf cote serveur. Tout ce qui suit se lit dans la charge que
 * `GET /events/:id/convocation` rend deja : `published.teams[].placements`,
 * `published.reservePlayerIds`, `published.snapshotPlayers`, `published.publishedBy`.
 */

import {
  getMatchPositionLabels,
} from '@/views/matchCallUp/matchCompositionUtils';

import { getTacticalSportKey } from '@/utils/tacticalField';

/** Le joueur est sur le terrain. */
export const CONVOCATION_ROLE_STARTER = 'starter';

/** Le joueur est convoque, mais il commence sur le banc. */
export const CONVOCATION_ROLE_SUBSTITUTE = 'substitute';

const toId = (/** @type {any} */ value) => String(value ?? '').trim();

const ensureList = (/** @type {any} */ value) => (Array.isArray(value) ? value : []);

/**
 * Tous les placements d'un pack publie, toutes equipes confondues.
 * @param {any} published
 * @returns {any[]}
 */
const getPackPlacements = (published) => ensureList(published?.teams)
  .flatMap((/** @type {any} */ teamEntry) => ensureList(teamEntry?.placements));

/**
 * Le lecteur figure-t-il dans CE pack — sur le terrain ou sur le banc ?
 * @param {any} published
 * @param {string} viewerId
 * @returns {boolean}
 */
const isViewerInPack = (published, viewerId) => {
  if (!published || typeof published !== 'object' || !viewerId) return false;
  const estPlace = getPackPlacements(published)
    .some((/** @type {any} */ placement) => toId(placement?.playerId) === viewerId);
  if (estPlace) return true;
  return ensureList(published?.reservePlayerIds)
    .some((/** @type {any} */ playerId) => toId(playerId) === viewerId);
};

/**
 * AC08 — LA BRANCHE QUI CONCERNE LE LECTEUR, dans la charge telle que le
 * serveur l'envoie VRAIMENT.
 *
 * 🧨 MESURE DU 2026-08-21, et c'est elle qui rendait l'ecran inatteignable meme
 * par la notification : `getPlayerConvocationView` (`event-composition.ts`,
 * forme `branches` depuis le 2026-07-07) rend
 * `{ branches: [{ published, responses, team, viewer }], event, ... }`.
 * Il n'y a **AUCUN `published` a la racine** — l'ecran, ecrit le 2026-08-15
 * contre l'ancienne forme, lisait donc toujours `undefined` et **reposait TOUT
 * LE MONDE sur la page de l'evenement**, convoques compris.
 *
 * ⚠️ La forme a plat (`convocation.published`) est conservee : c'est celle des
 * temoins deja ecrits, et celle que rend encore la carte de compo du tchat.
 * @param {any} convocation Charge de `GET /events/:id/convocation`.
 * @param {string} [userId] `documentId` de la personne connectee.
 * @returns {{ published: any, responses?: any, team?: any } | null}
 */
export const resolveViewerConvocationBranch = (convocation, userId = '') => {
  const viewerId = toId(userId);
  if (!viewerId) return null;

  const branches = ensureList(convocation?.branches);
  const candidates = branches.length
    ? branches
    : [{
      published: convocation?.published,
      responses: convocation?.responses,
      team: convocation?.team,
    }];

  return candidates
    .find((/** @type {any} */ branch) => isViewerInPack(branch?.published, viewerId)) || null;
};

/**
 * AC08 — la reponse a « suis-je convoque ? », sans rien rendre a l'ecran.
 *
 * 🎯 C'est ce que la page d'un evenement n'avait aucun moyen de dire : la
 * convocation vit dans une AUTRE requete que l'evenement
 * (`['eventConvocation', eventId, teamId]`). Un seul calcul, partage par
 * l'ecran du joueur, la page de l'evenement et la carte du tchat.
 * @param {any} convocation
 * @param {string} [userId]
 * @returns {'starter' | 'substitute' | null} `null` = pas convoque.
 */
export const getViewerConvocationRole = (convocation, userId = '') => {
  const viewerId = toId(userId);
  const branch = resolveViewerConvocationBranch(convocation, viewerId);
  if (!branch) return null;

  const estPlace = getPackPlacements(branch.published)
    .some((/** @type {any} */ placement) => toId(placement?.playerId) === viewerId);
  return estPlace ? CONVOCATION_ROLE_STARTER : CONVOCATION_ROLE_SUBSTITUTE;
};

/**
 * L'identifiant qui sert de cle dans un pack de composition. Le serveur range les
 * joueurs par `documentId` quand il en a un, par `id` sinon
 * (`buildSnapshotPlayer`) : on lit les deux, dans le meme ordre que lui.
 * @param {any} entity
 * @returns {string}
 */
export const getConvocationPersonId = (entity) => (
  toId(entity?.documentId) || toId(entity?.id)
);

/**
 * Le numero du poste porte par un identifiant de repere (`team_1:slot_3` -> 3).
 * @param {any} slotId
 * @returns {number} 0 quand l'identifiant n'en porte aucun.
 */
const getSlotIndex = (slotId) => {
  const matched = toId(slotId).match(/slot_(\d+)$/);
  return matched ? Number(matched[1]) : 0;
};

/**
 * Le nom affichable d'une personne, sans jamais rendre « undefined ».
 * @param {any} person
 * @returns {string}
 */
const getPersonName = (person) => [person?.firstname, person?.lastname]
  .map((part) => String(part || '').trim())
  .filter(Boolean)
  .join(' ');

/**
 * AC08 — LE BANC, enfin montre a quelqu'un.
 *
 * 🎁 Aucune donnee neuve : `reservePlayerIds` porte l'ordre voulu par le coach et
 * `reserveSnapshotPlayers` porte les personnes, toutes deux DEJA dans la charge.
 * ⛔ Un identifiant dont on ne connait pas la personne n'est pas affiche : on ne
 * met pas une ligne vide a la place d'un nom qu'on n'a pas.
 * @param {any} published Pack publie d'une branche.
 * @returns {Array<{ id: string, player: any }>}
 */
export const buildConvocationReserveList = (published) => {
  const byId = new Map();
  ensureList(published?.snapshotPlayers)
    .forEach((/** @type {any} */ player) => byId.set(getConvocationPersonId(player), player));
  ensureList(published?.reserveSnapshotPlayers)
    .forEach((/** @type {any} */ player) => byId.set(getConvocationPersonId(player), player));

  return ensureList(published?.reservePlayerIds)
    .map((/** @type {any} */ playerId) => ({
      id: toId(playerId),
      player: byId.get(toId(playerId)) || null,
    }))
    .filter((/** @type {any} */ entry) => Boolean(entry.id && entry.player));
};

/**
 * La place du joueur dans la convocation publiee — ou `null` s'il n'y figure pas.
 *
 * 🔒 C'est LE garde-fou de l'ecran 10 : un entraineur, un organisateur ou un
 * joueur non retenu recoit la meme notification que les convoques. Rendre `null`
 * ici est ce qui les renvoie sur la page de l'evenement au lieu de leur montrer
 * une convocation qui n'est pas la leur.
 *
 * ⚠️ Un joueur saisi a la main (`manualPlayers`) n'a pas de compte : il ne peut
 * jamais etre le lecteur de cet ecran, et il n'est donc jamais cherche ici.
 * @param {object} input
 * @param {any} [input.convocation] Charge de `GET /events/:id/convocation`.
 * @param {string} [input.userId] `documentId` de la personne connectee.
 * @returns {{
 *   jerseyNumber: string,
 *   placements: any[],
 *   playerId: string,
 *   positionLabel: string,
 *   publishedByName: string,
 *   reservePlayers: any[],
 *   role: string,
 *   snapshotPlayers: any[],
 *   sport: string,
 *   teamName: string,
 *   viewerPlayer: any,
 * } | null}
 */
export const buildPlayerConvocationView = ({ convocation = null, userId = '' } = {}) => {
  const viewerId = toId(userId);
  const branch = resolveViewerConvocationBranch(convocation, viewerId);
  if (!branch) return null;

  const { published } = branch;
  const placements = getPackPlacements(published);

  const myPlacement = placements
    .find((/** @type {any} */ placement) => toId(placement?.playerId) === viewerId) || null;

  // AD08 — UNE SEULE FACON DE RECONNAITRE UNE PERSONNE. `buildConvocationReserveList`
  // fusionne les deux listes 45 lignes plus haut ; ici on ne lisait que
  // `snapshotPlayers`. Sur une charge ou le remplacant n'est QUE dans
  // `reserveSnapshotPlayers` — la forme a plat de la carte de compo du tchat, et
  // toute charge partielle — il lisait son nom sur le banc mais sa PROPRE carte
  // ne le connaissait pas : ni avatar, ni poste, ni numero.
  const viewerPlayer = [
    ...ensureList(published?.snapshotPlayers),
    ...ensureList(published?.reserveSnapshotPlayers),
  ].find((/** @type {any} */ player) => getConvocationPersonId(player) === viewerId) || null;

  const sport = getTacticalSportKey(published?.sportContext);

  // Le poste vient d'abord du REPERE ou le jeton s'est pose — c'est la place que
  // le coach a choisie. Sans repere (placement libre), on retombe sur le poste
  // declare du joueur, jamais sur un poste invente.
  const slotIndex = getSlotIndex(myPlacement?.slotId);
  const positionLabel = String(
    getMatchPositionLabels(sport)[slotIndex - 1]
    || viewerPlayer?.position
    || '',
  ).trim();

  return {
    jerseyNumber: viewerPlayer?.number === 0 || viewerPlayer?.number
      ? String(viewerPlayer.number)
      : '',
    placements,
    playerId: viewerId,
    positionLabel,
    publishedByName: getPersonName(published?.publishedBy),
    reservePlayers: buildConvocationReserveList(published),
    role: myPlacement ? CONVOCATION_ROLE_STARTER : CONVOCATION_ROLE_SUBSTITUTE,
    snapshotPlayers: ensureList(published?.snapshotPlayers),
    sport,
    teamName: String(
      branch?.team?.name || convocation?.team?.name || published?.teams?.[0]?.name || '',
    ).trim(),
    viewerPlayer,
  };
};

/**
 * Les joueurs a dessiner sur le terrain, apparies a leur placement.
 * @param {object} input
 * @param {any[]} [input.placements]
 * @param {any[]} [input.snapshotPlayers]
 * @returns {Array<{ placement: any, player: any }>}
 */
export const buildConvocationFieldTokens = ({ placements = [], snapshotPlayers = [] } = {}) => {
  const byId = new Map(
    ensureList(snapshotPlayers)
      .map((/** @type {any} */ player) => [getConvocationPersonId(player), player]),
  );
  return ensureList(placements)
    .map((/** @type {any} */ placement) => ({
      placement,
      player: byId.get(toId(placement?.playerId)) || null,
    }))
    .filter((/** @type {any} */ entry) => Boolean(entry.player));
};

/**
 * La reponse deja donnee par le joueur — `present`, `absent` ou `pending`.
 *
 * 🧮 Elle est CALCULEE PAR LE SERVEUR (`buildConvocationResponses`) et renvoyee
 * dans `responses.byPlayerId`. L'app ne la recalcule pas : deux calculs de la
 * meme reponse finiraient par diverger.
 * @param {any} [convocation]
 * @param {string} [userId]
 * @returns {'present' | 'absent' | 'pending'}
 */
export const getPlayerConvocationResponse = (convocation, userId) => {
  // AC08 — la forme `branches` range les reponses PAR BRANCHE. On lit d'abord
  // celle du lecteur, et on retombe sur la racine (forme a plat) sans jamais
  // recalculer la reponse nous-memes.
  const branch = resolveViewerConvocationBranch(convocation, userId);
  const answer = branch?.responses?.byPlayerId?.[toId(userId)]
    ?? convocation?.responses?.byPlayerId?.[toId(userId)];
  return answer === 'present' || answer === 'absent' ? answer : 'pending';
};

/**
 * L'heure d'un horodatage, au format `15:00`. Rend une chaine vide quand la
 * donnee manque — on n'invente jamais une heure de rendez-vous.
 * @param {any} value
 * @returns {string}
 */
export const formatConvocationTime = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // `startTime` arrive en `HH:mm:ss.SSS` (champ `time` de Strapi), la date d'un
  // evenement en ISO complet. Les deux formes circulent vraiment.
  const timeOnly = raw.match(/^(\d{2}):(\d{2})/);
  if (timeOnly) return `${timeOnly[1]}:${timeOnly[2]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const heures = String(parsed.getHours()).padStart(2, '0');
  return `${heures}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};
