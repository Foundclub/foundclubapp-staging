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
import {
  buildAutoPlacementsByDeclaredPosition,
  buildLegacyFormationTables,
  getMatchFormations,
} from './matchFormationCatalog';

/**
 * 🔒 LOT TERRAIN (2026-09-05) — CES DEUX TABLES SONT DESORMAIS DERIVEES.
 *
 * Elles etaient ecrites en dur ici, et elles restent lues par 4 autres ecrans
 * (`teamCompoTemplateUtils`, `playerConvocationUtils`, les 2 plateaux de
 * detection). Elles valent maintenant la PREMIERE compo type de chaque sport
 * dans `matchFormationCatalog` — une seule source de verite, jamais deux tables
 * qui se ressemblent et finissent par diverger.
 *
 * ✅ Le contenu ne bouge pas d'un pixel pour les 5 sports existants (un temoin
 * le fige) ; s'y AJOUTENT `futsal` et `rugby13`, qui n'avaient rien.
 */
const LEGACY_TABLES = buildLegacyFormationTables();

/**
 * Positions de depart en pourcentage `[x, y]`, reprises TELLES QUELLES de
 * `design_reference/fields.jsx` (`FORMATIONS`). Ce sont des pourcentages du
 * terrain, donc elles ne dependent pas de sa hauteur.
 * @type {Record<string, Array<[number, number]>>}
 */
export const MATCH_FORMATIONS = LEGACY_TABLES.formations;

/**
 * Libelles de poste par sport, dans l'ordre de `MATCH_FORMATIONS` — repris tels
 * quels de `design_reference/fields.jsx` (`POSTES`).
 * @type {Record<string, string[]>}
 */
export const MATCH_POSITION_LABELS = LEGACY_TABLES.labels;

/**
 * Rayon d'accroche de l'aimantation, en pourcentage de terrain. Meme valeur que
 * le board existant (`SNAP_RADIUS`) : deux ecrans qui aimantent differemment
 * seraient deux comportements a expliquer.
 */
export const MAGNET_RADIUS = 14;

/**
 * Une rangee de l'ecran « Partir de… ».
 *
 * Les 3 premieres decrivent une SOURCE (terrain vide, compo type, dernier
 * match) ; celles que le lot TERRAIN ajoute decrivent une COMPO TYPE et
 * portent en plus `formationKey`, leur nom propre et leur nombre de postes.
 * @typedef {object} StartFromOption
 * @property {boolean} available
 * @property {string} [detail] Precision affichee apres un « · ».
 * @property {string | null} [formationKey] La compo type a ouvrir, s'il y en a une.
 * @property {string} key
 * @property {any[]} placements
 * @property {string} [subtitleKey] Cle de traduction du sous-titre.
 * @property {any} [subtitleParams]
 * @property {string} [title] Nom propre affiche tel quel (« 4-3-3 »).
 * @property {any} [unavailableParams] De quoi ecrire la raison du grisage.
 * @property {string | null} unavailableReason
 */

/** Les 3 points de depart de l'ecran 4, dans l'ordre du pack. */
export const START_FROM_EMPTY = 'empty';
export const START_FROM_DEFAULT = 'default_composition';
export const START_FROM_LAST_MATCH = 'last_match';
/** Prefixe des rangees « compo type » ajoutees par le lot TERRAIN. */
export const START_FROM_FORMATION = 'formation';

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
 * Les reperes de poste d'une compo type CHOISIE (lot TERRAIN).
 *
 * ♻️ Meme forme de sortie que `buildFormationSlots`, et surtout **le meme
 * `slotId`** : un jeton pose par le placement automatique se deplace, s'echange
 * et s'enregistre exactement comme un jeton pose a la main.
 * @param {any} [formation] Une entree de `matchFormationCatalog`.
 * @param {string} [teamEntryId]
 * @returns {Array<{ label: string, positionX: number, positionY: number, slotId: string }>}
 */
export const buildSlotsFromFormation = (formation, teamEntryId = 'team_1') => (
  (Array.isArray(formation?.slots) ? formation.slots : [])
    .map((/** @type {any} */ entry, /** @type {number} */ index) => ({
      label: normalizeLabel(entry?.label) || `Poste ${index + 1}`,
      positionX: clampPercent(entry?.positionX),
      positionY: clampPercent(entry?.positionY),
      slotId: `${teamEntryId}:slot_${index + 1}`,
    }))
);

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
 * 🎁 LOT TERRAIN — LES RANGEES « COMPO TYPE » de l'ecran « Partir de… ».
 *
 * Une rangee par compo type du sport, dans l'ordre du catalogue. Ce qu'elles
 * apportent par rapport a l'ancien ecran :
 *   · le terrain s'ouvre AVEC SES POSTES, donc l'aimantation s'allume ;
 *   · quand `autoPlaceByPosition` est vrai, les convoques sont DEJA poses sur
 *     leur poste declare ;
 *   · une formation trop grande est **grisee ET expliquee** — « le 4-3-3
 *     demande 11 joueurs, tu en as convoque 3 » — au lieu du « 0/11 places »
 *     muet mesure le 05/09 sur le banc d'essai.
 * @param {object} input
 * @param {boolean} [input.autoPlaceByPosition]
 * @param {string} [input.category]
 * @param {any[]} [input.players]
 * @param {string} [input.sport]
 * @returns {any[]}
 */
const buildFormationOptions = ({
  autoPlaceByPosition = true, category = '', players = [], sport,
}) => {
  const calledUp = (Array.isArray(players) ? players : []).length;

  return getMatchFormations(sport, category).map((formation) => {
    // 🔓 ASSOUPLI le 2026-09-07 (decision d'Adel). AVANT : `calledUp >= starters`,
    // donc un coach a 10 convoques pour un match a 11 n'avait AUCUNE formation
    // proposable et retombait sur le terrain vide — l'ecran meme que ce lot
    // devait remplacer. Les reponses arrivent au compte-gouttes jusqu'au dernier
    // moment : on ouvre la formation des la MOITIE de l'effectif, et le coach
    // complete ensuite.
    //
    // ⚠️ La moitie ARRONDIE AU SUPERIEUR, parce qu'elle doit valoir pour toutes
    // les tailles du catalogue : 5, 6, 7, 8, 11, 13 et 15 postes.
    const minimumStarters = Math.ceil(formation.starters / 2);
    const available = calledUp >= minimumStarters;
    const missing = Math.max(0, formation.starters - calledUp);
    const { placements } = autoPlaceByPosition && available
      ? buildAutoPlacementsByDeclaredPosition({ formation, players })
      : { placements: [] };

    return {
      available,
      detail: '',
      formationKey: formation.key,
      key: `${START_FROM_FORMATION}:${formation.key}`,
      placements,
      // Le nom d'une compo type est un nom propre du sport (« 4-3-3 »,
      // « 2-3 zone », « Réception en W ») : il vit dans le catalogue, comme
      // les libelles de poste, et ne se traduit pas.
      //
      // 🕳️ LA CONDITION FERME DE L'ASSOUPLISSEMENT : quand on ouvre une
      // formation incomplete, l'ecran DIT combien de postes resteront vides.
      // Sans ca on remplacerait un blocage par un oubli silencieux — et l'oubli
      // est pire, parce que le coach croit sa compo faite.
      subtitleKey: available && missing > 0
        ? 'matchComposition.start.formationPartial'
        : 'matchComposition.start.formationSlots',
      subtitleParams: { count: available && missing > 0 ? missing : formation.starters },
      title: formation.label,
      // ⚠️ `needed` et non `count` : i18next traite `count` comme un selecteur
      // de pluriel et irait chercher une cle `…_one` / `…_other` qui n'existe
      // pas. Le nombre de postes n'est pas un pluriel, c'est une donnee.
      unavailableParams: {
        label: formation.label,
        minimum: minimumStarters,
        needed: formation.starters,
        selected: calledUp,
      },
      unavailableReason: available ? null : 'notEnoughPlayers',
    };
  });
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
 * @param {boolean} [input.autoPlaceByPosition] Placer les convoques sur leur poste declare.
 * @param {any} [input.bootstrap] `bootstrap` de `GET /events/:id/composition`.
 * @param {string} [input.category] La categorie de l'equipe — elle decide du FORMAT au football.
 * @param {any} [input.defaultComposition] Charge de `GET /teams/:id/default-composition`.
 * @param {any[]} [input.players] Les convoques de l'ecran 1.
 * @param {string} [input.sport]
 * @returns {StartFromOption[]}
 */
export const buildStartFromOptions = ({
  autoPlaceByPosition = true,
  bootstrap = null,
  category = '',
  defaultComposition = null,
  players = [],
  sport,
}) => {
  const calledUpPlayers = Array.isArray(players) ? players : [];
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
    ...buildFormationOptions({
      autoPlaceByPosition, category, players: calledUpPlayers, sport,
    }),
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
 * Le poste le plus proche du point lache, dans le rayon d'aimantation. Les
 * postes nommes dans `occupiedSlotIds` sont ECARTES de la recherche.
 *
 * ⚠️ MISE A JOUR HONNETE (lot COMPO, 2026-09-05) : depuis que `placePlayerAt`
 * traite un poste tenu comme une CIBLE, plus personne en production ne passe
 * `occupiedSlotIds`. Le parametre reste — il repond a une VRAIE question
 * (« quel poste est encore libre ? ») et son temoin le fige — mais il n'a plus
 * d'appelant. Le prochain qui lit ceci sait donc que cette branche n'est
 * exercee que par le temoin, et pas par l'ecran.
 * @param {object} input
 * @param {Set<string> | string[]} [input.occupiedSlotIds] Postes a ne pas viser.
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
 * occupait, puis il est place — aimante au poste le plus proche si l'aimantation
 * est allumee, a l'endroit exact du doigt sinon.
 *
 * 👻 LOT COMPO (2026-09-05) — POSER SUR UN POSTE OCCUPE NE PERD PLUS PERSONNE.
 *
 * 🚨 CE QUI SE PASSAIT AVANT : l'aimantation ne visait que les postes LIBRES.
 * Lacher quelqu'un sur un poste deja tenu ne trouvait donc rien dans le rayon,
 * et fabriquait un placement SANS POSTE, pose au pixel du doigt — donc DESSINE
 * PAR-DESSUS l'occupant. A l'ecran : le nouveau venu a quitte le banc, ne tient
 * aucun poste, et son jeton est cache sous l'autre. Le coach le voit disparaitre,
 * et le pack part tel quel au serveur.
 *
 * ✅ CE QUI SE PASSE MAINTENANT : le nouveau venu PREND le poste ; l'ancien
 * occupant reprend la place que le nouveau vient de quitter (les deux ECHANGENT)
 * ou, s'il venait du banc, y RETOURNE. Personne ne disparait, dans aucun des
 * deux cas.
 *
 * ⚠️ Le placement libre n'a pas bouge : aimantation eteinte, ou lacher hors du
 * rayon de tout poste, le jeton reste exactement ou le doigt l'a laisse.
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

  const current = Array.isArray(placements) ? placements : [];
  // D'ou vient le jeton, lu AVANT de le decrocher : c'est cette place-la que
  // l'ancien occupant reprendra en cas d'echange.
  const previous = current.find((placement) => String(placement?.playerId || '') === id) || null;
  const others = current.filter((placement) => String(placement?.playerId || '') !== id);
  // ⚠️ Aucun `occupiedSlotIds` ici, et c'est LA correction : un poste tenu est
  // une cible, plus un obstacle qu'on contourne en silence.
  const snapped = magnetEnabled ? snapToNearestSlot({ slots, x, y }) : null;

  if (!snapped) {
    return [...others, {
      playerId: id,
      positionX: clampPercent(x),
      positionY: clampPercent(y),
      slotId: null,
    }];
  }

  const displaced = others.find((placement) => placement?.slotId === snapped.slotId) || null;
  const kept = others.filter((placement) => placement !== displaced);
  const arrival = {
    playerId: id,
    positionX: clampPercent(snapped.positionX),
    positionY: clampPercent(snapped.positionY),
    slotId: snapped.slotId,
  };
  const swapped = displaced && previous
    ? [{ ...previous, playerId: String(displaced.playerId) }]
    : [];

  return [...kept, arrival, ...swapped];
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
 * S04 — LE TERRAIN A REPRENDRE quand le coach revient sur sa selection.
 *
 * 🎯 CE QUE ÇA REPARE, EN UNE PHRASE : retirer un convoque doit JUSTE retirer ce
 * joueur — les autres jetons ne bougent pas d'un pixel.
 *
 * 🚨 LE DEFAUT MESURE (2026-08-16) : `keepPlacementsOfCalledUpPlayers` n'etait
 * appelee qu'au DEMARRAGE d'une compo (`buildStartFromOptions`), pour choisir un
 * point de depart. Des que la liste des convoques changeait, l'ecran 4 refaisait
 * son calcul depuis une RANGEE DE DEPART (terrain vide ou compo type) : les
 * 11 jetons poses a la main etaient remplaces. Et le pack deja publie, lui,
 * voyageait pourtant jusque-la dans `params.existingComposition` — il etait
 * transmis, mais jamais relu.
 *
 * ♻️ Rien de neuf ici : c'est l'assemblage des deux fonctions qui existaient
 * deja — `readPlacementsFromPack` pour la forme, `keepPlacementsOfCalledUpPlayers`
 * pour le tri (§1 bis, barreau 2).
 *
 * 🔒 `startPlacements` est prioritaire sur le pack DES QU'IL EST UN TABLEAU,
 * meme vide : un coach qui vide son terrain a la main l'a fait expres, et
 * retomber sur le pack publie le lui ressusciterait sous les doigts.
 * @param {object} input
 * @param {any} [input.existingComposition] Le pack deja publie ou enregistre.
 * @param {any[]} [input.players] Les convoques APRES modification de la liste.
 * @param {any[] | null} [input.startPlacements] Le terrain en cours, rendu par
 *   l'ecran 5 quand le coach remonte a la selection. `null` = on n'en vient pas.
 * @returns {{ placements: any[], shouldResume: boolean }} `shouldResume` dit s'il
 *   y a un terrain a rouvrir — sinon l'ecran 4 « Partir de… » garde son role.
 */
export const resumeFieldForSelection = ({
  existingComposition = null, players = [], startPlacements = null,
}) => {
  const comesFromField = Array.isArray(startPlacements);
  const placements = keepPlacementsOfCalledUpPlayers(
    comesFromField ? startPlacements : readPlacementsFromPack(existingComposition),
    players,
  );
  return { placements, shouldResume: comesFromField || placements.length > 0 };
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
 * @param {number} [input.starters] Le nombre de postes de la compo type CHOISIE.
 *   Il l'emporte sur l'effectif theorique du sport : un 3-1-3 a 8 doit afficher
 *   « N/8 », pas « N/11 » (lot TERRAIN).
 * @returns {{ bench: number, calledUp: number, offApp: number, placed: number, starters: number }}
 */
export const getBoardCounters = ({
  manualPlayers = [], placements = [], players = [], sport, starters: chosenStarters,
}) => {
  const calledUpList = Array.isArray(players) ? players : [];
  const calledUpIds = new Set(calledUpList.map(getCompositionPlayerId).filter(Boolean));
  const bench = getBenchPlayers(calledUpList, placements).length;
  const placed = calledUpList.length - bench;
  const sizes = getMatchSquadSizes(getTacticalSportKey(sport));
  const sportStarters = sizes ? sizes.starters : placed;

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
    // Le denominateur de la pastille « N/M places ». La compo type choisie
    // l'emporte ; sinon l'effectif du sport ; sport inconnu = pas de theorie,
    // on ne montre que ce qui est vraiment sur le terrain.
    starters: Number(chosenStarters) > 0 ? Number(chosenStarters) : sportStarters,
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
