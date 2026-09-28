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

import localeDesFormats from '@/theme/strings/localeDesFormats';

import {
  getMatchPositionLabels,
} from '@/views/matchCallUp/matchCompositionUtils';

import { isCompositionPerson } from '@/utils/compositionPlayer';
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
 *
 * ♻️ EXPORTE PAR R6 (vague R), pas reecrit : la liste des convoques de la page
 * d'evenement et la carte de compo du tchat ecrivent les MEMES noms, a partir
 * de la MEME charge. Deux recettes du nom divergeraient des la premiere charge
 * ou `lastname` manque — l'une rendrait « Karim », l'autre « Karim undefined ».
 * @param {any} person
 * @returns {string}
 */
export const getPersonName = (person) => [person?.firstname, person?.lastname]
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
    // COMPODBL — ni identifiant texte ni nom : pas une personne (voir
    // `isCompositionPerson`), donc pas de ligne sur le banc.
    .filter((/** @type {any} */ entry) => Boolean(entry.id && isCompositionPerson(entry.player)));
};

/**
 * COACH1 (decision d Adel du 2026-09-21) — L'ENCADREMENT de la convocation.
 *
 * 🎁 Aucun calcul ici : le serveur range dans `branch.staff` les entraineurs de
 * l'equipe qui ont repondu PRESENT (`event-composition.ts`,
 * `buildConvocationStaff`). Ils ne sont ni sur le terrain ni sur le banc : c'est
 * une liste a part, que l'ecran du joueur et l'onglet de la fiche lisent tous
 * les deux ici — une seule facon de la lire.
 * ⛔ Une personne sans identifiant ni nom n'ecrit pas de ligne vide.
 * @param {any} branch Une branche de `GET /events/:id/convocation`.
 * @returns {Array<{ id: string, person: any }>}
 */
export const buildConvocationStaffList = (branch) => ensureList(branch?.staff)
  .map((/** @type {any} */ person) => ({ id: getConvocationPersonId(person), person }))
  .filter((/** @type {any} */ entry) => Boolean(entry.id && getPersonName(entry.person)));

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
 *   published: any,
 *   publishedByName: string,
 *   reservePlayers: any[],
 *   responsesByPlayerId: Record<string, string>,
 *   role: string,
 *   snapshotPlayers: any[],
 *   sport: string,
 *   staff: Array<{ id: string, person: any }>,
 *   teamId: string,
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

  // CONVOC (26/09) — les reponses de TOUS les convoques, telles que le serveur les
  // range dans la branche (`buildConvocationResponses`). Deja dans la charge,
  // jamais affichees jusqu'ici. Forme a plat : a la racine, comme la reponse du
  // lecteur (`getPlayerConvocationResponse`).
  const byPlayerId = branch?.responses?.byPlayerId ?? convocation?.responses?.byPlayerId;

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
    // COMPOMSG — le pack lui-meme : c'est lui que le terrain de l'ecran confie
    // au plein ecran (`buildPublishedBoardTarget`), photos comprises.
    published,
    publishedByName: getPersonName(published?.publishedBy),
    reservePlayers: buildConvocationReserveList(published),
    responsesByPlayerId: byPlayerId && typeof byPlayerId === 'object' ? byPlayerId : {},
    role: myPlacement ? CONVOCATION_ROLE_STARTER : CONVOCATION_ROLE_SUBSTITUTE,
    snapshotPlayers: ensureList(published?.snapshotPlayers),
    sport,
    staff: buildConvocationStaffList(branch),
    teamId: toId(branch?.team?.documentId || convocation?.team?.documentId),
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
    // COMPODBL — LE JETON « ? » NAIT ICI, et c'est ICI qu'il meurt : tous les
    // terrains de l'app passent par cet assembleur (fiche, bulle du tchat,
    // « Tu es convoque », plein ecran, « Modifier »). Un instantane sans
    // identifiant texte ni nom n'est pas une personne.
    .filter((/** @type {any} */ entry) => isCompositionPerson(entry.player));
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
 * CONVOC (demande d'Adel du 26/09) — LA REPONSE D'UN CONVOQUE, pour la marque
 * posee sur son jeton ou sa ligne du banc.
 *
 * 🧮 Calculee par le SERVEUR, jamais ici. Un joueur hors app n'est pas dans sa
 * liste : il n'a AUCUNE reponse, pas meme « sans reponse » — meme regle que
 * l'ecran du coach (`buildConvocationRoster`, matchConvocationUtils.js).
 * @param {{ responsesByPlayerId?: Record<string, string> } | null} view
 * @param {any} playerId
 * @returns {'present' | 'absent' | 'pending' | null}
 */
export const getConvocationPlayerResponse = (view, playerId) => {
  const response = view?.responsesByPlayerId?.[toId(playerId)];
  return response === 'present' || response === 'absent' || response === 'pending'
    ? response
    : null;
};

/**
 * COMPOMSG — LA BRANCHE PUBLIEE D'UNE EQUIPE, dans la charge de
 * `GET /events/:id/convocation` (forme `branches`, ou forme a plat).
 *
 * ⚠️ A la difference de `resolveViewerConvocationBranch`, elle ne cherche PAS
 * le lecteur : le plein ecran se lit aussi par un entraineur ou un dirigeant,
 * qui ne figurent dans aucun pack.
 * @param {any} convocation
 * @param {string} [teamId] `documentId` de l'equipe voulue.
 * @returns {any | null} La branche, ou `null` si on ne sait pas laquelle.
 */
export const findPublishedBranchForTeam = (convocation, teamId = '') => {
  const branches = ensureList(convocation?.branches);
  const candidates = (branches.length
    ? branches
    : [{ published: convocation?.published, team: convocation?.team }])
    .filter((/** @type {any} */ branch) => (
      branch?.published && typeof branch.published === 'object'
    ));
  const wanted = toId(teamId);
  return candidates
    .find((/** @type {any} */ branch) => wanted && toId(branch?.team?.documentId) === wanted)
    || (candidates.length === 1 ? candidates[0] : null);
};

/**
 * COMPOMSG — CE QU'IL FAUT POUR OUVRIR LE PLEIN ECRAN EN LECTURE, depuis UN pack
 * publie. Une seule recette pour les trois portes : la carte du fil, le terrain
 * de « Tu es convoque », et la relecture du plateau lui-meme.
 *
 * ⛔ Elle rend `null` dans les deux cas ou le plateau mentirait (memes gardes
 * que D6) : aucun joueur place — un terrain vide ferait croire a une compo
 * perdue — et plusieurs equipes — le plateau n'en dessine qu'une et cacherait
 * les autres sans rien dire.
 * @param {any} published Pack publie (`teams`, `snapshotPlayers`, banc...).
 * @param {object} [options]
 * @param {string} [options.sport] Sport de repli si le pack ne le porte pas.
 * @param {string} [options.teamName]
 * @returns {{
 *   existingComposition: any,
 *   publishedVersion: number | null,
 *   selectedPlayers: any[],
 *   sport: string,
 *   startPlacements: any[],
 *   teamName: string,
 * } | null}
 */
export const buildPublishedBoardTarget = (published, { sport = '', teamName = '' } = {}) => {
  if (!published || typeof published !== 'object') return null;
  if (ensureList(published.teams).length > 1) return null;

  // Les joueurs ajoutes a la main sont places comme les autres : on les cherche
  // aussi, sans quoi leur jeton disparaitrait du plein ecran.
  const starters = buildConvocationFieldTokens({
    placements: getPackPlacements(published),
    snapshotPlayers: [
      ...ensureList(published.manualPlayers),
      ...ensureList(published.snapshotPlayers),
    ],
  });
  if (!starters.length) return null;

  return {
    existingComposition: published,
    publishedVersion: Number(published.version) || null,
    // Titulaires PUIS remplacants : le plateau retrouve le banc tout seul en
    // retirant de cette liste ceux que les placements portent.
    selectedPlayers: [
      ...starters.map((/** @type {any} */ token) => token.player),
      ...buildConvocationReserveList(published).map((/** @type {any} */ entry) => entry.player),
    ],
    sport: String(published.sportContext || sport || ''),
    startPlacements: starters.map((/** @type {any} */ token) => token.placement),
    teamName: String(teamName || '').trim(),
  };
};

/**
 * COMPOMSG — LE TEXTE LIBRE DE L'EVENEMENT, la ou l'entraineur ecrit son RDV.
 *
 * 🧨 Le serveur n'a AUCUN champ d'heure de rendez-vous (`event/schema.json`,
 * remesure le 2026-09-23). Ce que la carte du fil affichait comme
 * « RDV 19h30 au stade de Pelisanne » est le texte que l'entraineur a tape dans
 * l'evenement ; « Tu es convoque » ne le montrait nulle part et ecrivait
 * « Non precise » a la place. On l'affiche tel quel, on n'en extrait rien.
 * @param {any} event
 * @param {string[]} [alreadyShown] Textes deja a l'ecran (le nom du match...) :
 *   un texte identique n'est pas repete.
 * @returns {string} Le texte, ou '' s'il n'y en a pas.
 */
export const resolveConvocationNote = (event, alreadyShown = []) => {
  const note = String(event?.description ?? '').trim();
  if (!note) return '';
  const comparable = (/** @type {any} */ value) => String(value ?? '').trim().toLowerCase();
  return alreadyShown.map(comparable).includes(comparable(note)) ? '' : note;
};

/**
 * COMPOMSG — le JOUR d'un horodatage, au format du telephone (`lun. 28/09/2026`).
 * « Tu es convoque » n'ecrivait que l'heure : un joueur ne savait pas QUEL jour
 * il etait attendu. Chaine vide quand la donnee manque.
 * @param {any} value
 * @returns {string}
 */
export const formatConvocationDay = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(localeDesFormats(), {
    day: '2-digit', month: '2-digit', weekday: 'short', year: 'numeric',
  });
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
