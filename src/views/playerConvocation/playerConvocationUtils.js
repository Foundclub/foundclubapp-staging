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
 *   role: string,
 *   sport: string,
 *   teamName: string,
 *   viewerPlayer: any,
 * } | null}
 */
export const buildPlayerConvocationView = ({ convocation = null, userId = '' } = {}) => {
  const viewerId = toId(userId);
  if (!viewerId) return null;

  const published = convocation?.published;
  if (!published || typeof published !== 'object') return null;

  const placements = ensureList(published?.teams)
    .flatMap((/** @type {any} */ teamEntry) => ensureList(teamEntry?.placements));

  const myPlacement = placements
    .find((/** @type {any} */ placement) => toId(placement?.playerId) === viewerId) || null;

  const isSubstitute = ensureList(published?.reservePlayerIds)
    .some((/** @type {any} */ playerId) => toId(playerId) === viewerId);

  if (!myPlacement && !isSubstitute) return null;

  const viewerPlayer = ensureList(published?.snapshotPlayers)
    .find((/** @type {any} */ player) => getConvocationPersonId(player) === viewerId) || null;

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
    role: myPlacement ? CONVOCATION_ROLE_STARTER : CONVOCATION_ROLE_SUBSTITUTE,
    sport,
    teamName: String(convocation?.team?.name || published?.teams?.[0]?.name || '').trim(),
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
  const answer = convocation?.responses?.byPlayerId?.[toId(userId)];
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
