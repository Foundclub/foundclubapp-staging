/**
 * C-B — outils du parcours MATCH « Apres la publication » (ecrans 7 et 8 du pack
 * composition). Tout ce qui se calcule sans rendu vit ici, comme pour les ecrans
 * 4 a 6 (`matchCompositionUtils.js`).
 *
 * ⛔ AUCUN mecanisme neuf cote serveur. Les 2 ecrans ne lisent que ce que
 * `GET /events/:id/composition` renvoie DEJA :
 *   · `published`  — le pack publie (`teams[].placements`, `reservePlayerIds`,
 *                    `snapshotPlayers`, `manualPlayers`, `version`, `publishedAt`)
 *   · `responses`  — `{ byPlayerId, counts }`, calcule par `buildConvocationResponses`
 *                    (`admin/src/api/event/services/event-composition.ts:1263-1296`).
 *
 * 🚨 CE QUE LA MESURE A TROUVE, ET QUI FAIT TOUT L'INTERET DE CE LOT : ces
 * `responses` sont calcules, envoyes a l'app, et lus par PERSONNE. L'ecran 7 ne
 * demande donc rien de neuf — il branche ce qui etait deja jete.
 *
 * 🔒 LA REGLE LA PLUS DANGEREUSE DU LOT, et pourquoi elle tient : republier ne
 * doit JAMAIS effacer une reponse deja donnee. Elle est tenue PAR CONSTRUCTION
 * cote serveur — la reponse n'est pas rangee dans le pack, elle vit dans
 * `event.participations` / `event.missings`, et publier n'ecrit que
 * `event.composition`. Ce fichier ne peut donc pas la casser : il LIT les
 * reponses, il n'en fabrique jamais. Le temoin qui le prouve est dans
 * `__tests__/matchConvocationUtils.test.js`.
 */

import { getCompositionPlayerId } from '@/utils/compositionPlayer';

/** Le joueur est sur le terrain de la compo. */
export const CONVOCATION_ROLE_STARTER = 'starter';
/** Le joueur est convoque, mais au banc. */
export const CONVOCATION_ROLE_SUBSTITUTE = 'substitute';
/** Le joueur n'est pas convoque. */
export const CONVOCATION_ROLE_NONE = 'none';

/** Les 3 reponses possibles, telles que le serveur les nomme. */
export const CONVOCATION_RESPONSE_PRESENT = 'present';
export const CONVOCATION_RESPONSE_ABSENT = 'absent';
export const CONVOCATION_RESPONSE_PENDING = 'pending';

const toId = (/** @type {any} */ value) => String(value ?? '').trim();

const asArray = (/** @type {any} */ value) => (Array.isArray(value) ? value : []);

/**
 * Les identifiants des joueurs poses sur le terrain d'un pack.
 * @param {any} [pack]
 * @returns {string[]}
 */
const readStarterIds = (pack) => asArray(pack?.teams)
  .flatMap((/** @type {any} */ team) => asArray(team?.placements))
  .map((/** @type {any} */ placement) => toId(placement?.playerId))
  .filter(Boolean);

/**
 * Les identifiants des joueurs restes au banc d'un pack.
 * @param {any} [pack]
 * @returns {string[]}
 */
const readSubstituteIds = (pack) => asArray(pack?.reservePlayerIds).map(toId).filter(Boolean);

/**
 * Le role d'un joueur dans un pack : sur le terrain, au banc, ou pas convoque.
 * @param {any} pack
 * @param {string} playerId
 * @returns {'starter' | 'substitute' | 'none'}
 */
export const getPlayerRoleInPack = (pack, playerId) => {
  const id = toId(playerId);
  if (!id) return CONVOCATION_ROLE_NONE;
  if (readStarterIds(pack).includes(id)) return CONVOCATION_ROLE_STARTER;
  if (readSubstituteIds(pack).includes(id)) return CONVOCATION_ROLE_SUBSTITUTE;
  return CONVOCATION_ROLE_NONE;
};

/**
 * Les joueurs que le pack connait, ranges par identifiant. `snapshotPlayers`
 * porte le nom, le numero et l'avatar au moment de la publication — c'est une
 * PHOTO, et c'est voulu : un joueur qui quitte le club apres la publication doit
 * rester lisible sur la convocation qu'il a recue.
 * @param {any} [pack]
 * @returns {Map<string, any>}
 */
export const buildPlayerIndex = (pack) => {
  const index = new Map();
  [...asArray(pack?.snapshotPlayers), ...asArray(pack?.manualPlayers)].forEach((player) => {
    const id = getCompositionPlayerId(player);
    if (id && !index.has(id)) index.set(id, player);
  });
  return index;
};

/**
 * Les convoques d'une compo publiee, dans l'ordre du pack : le terrain d'abord,
 * le banc ensuite — c'est l'ordre que le pack dessine a l'ecran 7.
 *
 * 🔒 Un joueur hors app n'a AUCUNE reponse, pas meme « en attente ». Le serveur
 * l'exclut deja de `byPlayerId` : il n'a pas de compte, donc on n'attend rien de
 * lui, et afficher « en attente » laisserait croire le contraire.
 * @param {object} input
 * @param {any} [input.published] Le pack publie.
 * @param {any} [input.responses] `{ byPlayerId, counts }` du serveur.
 * @returns {Array<{
 *   isManual: boolean,
 *   player: any,
 *   playerId: string,
 *   response: 'present' | 'absent' | 'pending' | null,
 *   role: 'starter' | 'substitute',
 * }>}
 */
export const buildConvocationRoster = ({ published = null, responses = null } = {}) => {
  const index = buildPlayerIndex(published);
  const byPlayerId = responses?.byPlayerId && typeof responses.byPlayerId === 'object'
    ? responses.byPlayerId
    : {};
  const manualIds = new Set(
    asArray(published?.manualPlayers).map(getCompositionPlayerId).filter(Boolean),
  );

  const rows = [
    ...readStarterIds(published).map((playerId) => ({ playerId, role: CONVOCATION_ROLE_STARTER })),
    ...readSubstituteIds(published)
      .map((playerId) => ({ playerId, role: CONVOCATION_ROLE_SUBSTITUTE })),
  ];

  const seen = new Set();
  const rendu = rows
    .filter((/** @type {any} */ row) => {
      if (seen.has(row.playerId)) return false;
      seen.add(row.playerId);
      return true;
    })
    .map((/** @type {any} */ row) => {
      const isManual = manualIds.has(row.playerId);
      const response = byPlayerId[row.playerId];
      return {
        isManual,
        player: index.get(row.playerId) || null,
        playerId: row.playerId,
        // Le serveur est la seule autorite sur la reponse. Absent de sa liste =
        // pas de statut du tout, jamais un « en attente » fabrique ici.
        response: isManual || typeof response !== 'string' ? null : response,
        role: row.role,
      };
    });

  return /** @type {any} */ (rendu);
};

/**
 * Les chiffres de l'ecran 7 : le grand nombre et les 3 pastilles.
 *
 * ⚠️ Les 3 pastilles viennent des `counts` du SERVEUR quand il les envoie —
 * c'est lui qui tient les reponses, et les recompter ici fabriquerait une
 * deuxieme verite. Le repli ne sert qu'aux anciens paquets sans `counts`.
 * @param {object} input
 * @param {ReturnType<typeof buildConvocationRoster>} [input.roster]
 * @param {any} [input.responses]
 * @returns {{ absent: number, calledUp: number, pending: number, present: number }}
 */
export const getConvocationCounts = ({ responses = null, roster = [] } = {}) => {
  const rows = asArray(roster);
  const counts = responses?.counts;
  const hasServerCounts = counts && typeof counts === 'object';

  const readServer = (/** @type {string} */ key) => Number(counts?.[key]) || 0;
  const countLocal = (/** @type {string} */ value) => rows
    .filter((row) => row?.response === value).length;

  return {
    absent: hasServerCounts ? readServer('absent') : countLocal(CONVOCATION_RESPONSE_ABSENT),
    calledUp: rows.length,
    pending: hasServerCounts ? readServer('pending') : countLocal(CONVOCATION_RESPONSE_PENDING),
    present: hasServerCounts ? readServer('present') : countLocal(CONVOCATION_RESPONSE_PRESENT),
  };
};

/**
 * Les joueurs qui se sont declares ABSENTS alors qu'ils etaient sur le terrain.
 * C'est l'encart « Desistement » de l'ecran 8 : le pack le montre en tete, parce
 * que c'est la raison pour laquelle le coach rouvre sa compo.
 * @param {ReturnType<typeof buildConvocationRoster>} [roster]
 * @returns {ReturnType<typeof buildConvocationRoster>}
 */
export const getWithdrawnStarters = (roster = []) => asArray(roster)
  .filter((row) => row?.role === CONVOCATION_ROLE_STARTER
    && row?.response === CONVOCATION_RESPONSE_ABSENT);

/**
 * LE REMPLACEMENT PROPOSE de l'ecran 8 : « Le premier remplacant disponible est
 * propose. » Un titulaire qui se desiste laisse sa place VIDE — ce calcul prend
 * le premier joueur du banc qui n'a pas lui-meme dit non, et le pose SUR LA
 * MEME POSITION du terrain.
 *
 * 🔒 « Disponible » exclut deux cas, et l'ordre des deux compte :
 *   · celui qui s'est declare ABSENT — le proposer serait absurde ;
 *   · celui qui est HORS APP (`isManual`) — il ne peut pas repondre, donc on ne
 *     peut pas savoir s'il vient. Le pack le laisse au banc.
 * Un remplacant « en attente » reste proposable : ne pas avoir repondu n'est pas
 * un refus.
 *
 * ⚠️ Le calcul ne PUBLIE rien. Il rend une proposition que le coach voit avant
 * de trancher — c'est l'ecran 8 tout entier, et c'est pourquoi il est ici et
 * non dans le rendu.
 * @param {object} input
 * @param {ReturnType<typeof buildConvocationRoster>} [input.roster]
 * @returns {Array<{ inRow: any, outRow: any }>}
 */
export const proposeReplacements = ({ roster = [] } = {}) => {
  // Le banc, dans l'ordre du pack. On y puise sans jamais reprendre le meme.
  const bench = asArray(roster).filter((row) => row?.role === CONVOCATION_ROLE_SUBSTITUTE
    && !row?.isManual
    && row?.response !== CONVOCATION_RESPONSE_ABSENT);

  const used = new Set();
  return getWithdrawnStarters(roster).map((outRow) => {
    const inRow = bench.find((row) => !used.has(row.playerId)) || null;
    if (inRow) used.add(inRow.playerId);
    return { inRow, outRow };
  }).filter((pair) => Boolean(pair.inRow));
};

/**
 * Les placements du pack REPUBLIE : chaque remplacant propose prend la position
 * exacte du titulaire qui se desiste.
 *
 * 🎯 Reprendre la position plutot que d'en inventer une est ce qui rend la
 * republication lisible pour le coach : son 4-3-3 reste un 4-3-3, une seule
 * tete change.
 * @param {object} input
 * @param {any} [input.published] Le pack publie.
 * @param {Array<{ inRow: any, outRow: any }>} [input.replacements]
 * @returns {Array<any>}
 */
export const buildAmendedPlacements = ({ published = null, replacements = [] } = {}) => {
  const swap = new Map(
    asArray(replacements)
      .map((pair) => [toId(pair?.outRow?.playerId), toId(pair?.inRow?.playerId)]),
  );

  return asArray(published?.teams)
    .flatMap((/** @type {any} */ team) => asArray(team?.placements))
    .map((/** @type {any} */ placement) => {
      const next = swap.get(toId(placement?.playerId));
      return next ? { ...placement, playerId: next } : placement;
    });
};

/**
 * CE QUI CHANGE entre la compo publiee et celle que le coach vient de modifier —
 * les 2 rangees de diff de l'ecran 8.
 *
 * 🧮 LA MESURE QUI REND CET ECRAN POSSIBLE SANS TOUCHER AU SERVEUR : les deux
 * termes de la comparaison sont deja dans l'app. `publishedPack` arrive de
 * `GET /events/:id/composition` (`published`), `nextPack` est celui que le
 * terrain vient de construire. Aucune route neuve n'est necessaire.
 *
 * `sort` = le joueur perd du terrain (titulaire → banc, ou convoque → plus
 * convoque). `entre` = il en gagne. Un joueur dont le role ne bouge pas
 * n'apparait pas : le pack ne montre QUE ce qui change.
 * @param {object} input
 * @param {any} [input.nextPack] Le pack sur le point d'etre republie.
 * @param {any} [input.publishedPack] Le pack actuellement publie.
 * @returns {{
 *   entering: Array<{ fromRole: string, player: any, playerId: string, toRole: string }>,
 *   leaving: Array<{ fromRole: string, player: any, playerId: string, toRole: string }>,
 * }}
 */
export const buildCompositionDiff = ({ nextPack = null, publishedPack = null } = {}) => {
  // L'index des deux packs : un joueur qui SORT n'est plus dans le pack neuf,
  // son nom ne peut donc venir que de l'ancien.
  const index = new Map([...buildPlayerIndex(publishedPack), ...buildPlayerIndex(nextPack)]);

  const rank = { none: 0, starter: 2, substitute: 1 };
  const playerIds = Array.from(new Set([
    ...readStarterIds(nextPack), ...readStarterIds(publishedPack),
    ...readSubstituteIds(nextPack), ...readSubstituteIds(publishedPack),
  ]));

  /** @type {Array<{ fromRole: string, player: any, playerId: string, toRole: string }>} */
  const entering = [];
  /** @type {Array<{ fromRole: string, player: any, playerId: string, toRole: string }>} */
  const leaving = [];

  playerIds.forEach((playerId) => {
    const fromRole = getPlayerRoleInPack(publishedPack, playerId);
    const toRole = getPlayerRoleInPack(nextPack, playerId);
    if (fromRole === toRole) return;

    const row = {
      fromRole, player: index.get(playerId) || null, playerId, toRole,
    };
    if (rank[toRole] > rank[fromRole]) entering.push(row);
    else leaving.push(row);
  });

  return { entering, leaving };
};
