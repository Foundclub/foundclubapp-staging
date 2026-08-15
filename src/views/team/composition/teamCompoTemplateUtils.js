/**
 * C-C — ECRAN 11 du pack composition : la compo type d'une equipe.
 *
 * ⚠️ CET ECRAN REMPLACE UNE FONCTION VIVANTE. La porte `Équipe → « Avec l'offre
 * Équipe » → Composition type` existe et sert : elle ouvrait jusqu'ici l'ANCIEN
 * parcours (`TacticalSelectionV2` → terrain historique). Ce qui change, c'est la
 * DESTINATION de la porte, jamais ses conditions d'affichage.
 *
 * ⛔ Aucun mecanisme neuf cote serveur : la compo type se lit et s'ecrit par
 * `GET`/`PUT /teams/:id/default-composition`, qui existent deja et rangent la
 * composition en FORME ANCIENNE (`placements` a la racine).
 */

import {
  buildFormationPlacements,
  buildFormationSlots,
  getMatchPositionLabels,
  keepPlacementsOfCalledUpPlayers,
  readPlacementsFromPack,
} from '@/views/matchCallUp/matchCompositionUtils';
import { getCompositionPlayerId } from '@/utils/compositionPlayer';

import { RouteNames } from '@/navigation/routeNames';

import { getTacticalSportKey } from '@/utils/tacticalField';

const ensureList = (/** @type {any} */ value) => (Array.isArray(value) ? value : []);

/**
 * TEMOIN 2 — ou mene la porte « Composition type » d'une fiche equipe.
 *
 * 🔒 POURQUOI CETTE DECISION VIT ICI ET PAS DANS L'ECRAN : `TeamDetails.js` fait
 * **5 484 lignes et n'a aucun test** (E6). Sortir la decision et la tester est
 * l'idiome que le depot emploie deja pour exactement ce cas —
 * `views/event/ownAnswerAction.js` le dit mot pour mot (« extrait de
 * `handleDeleteParticipation`, qui n'avait aucun filet sur 6 000 lignes »).
 *
 * ⚠️ CE QUI NE CHANGE PAS : les conditions d'affichage de la porte
 * (`canManageTeam`, `isTeamOfferUnlocked`, son libelle, son cadenas) restent
 * exactement ou elles etaient. Seule la DESTINATION bouge — l'ancien parcours
 * ouvrait `TacticalSelectionV2` en mode `team-default`.
 * @param {object} input
 * @param {any[]} [input.players] L'effectif deja filtre par la fiche equipe.
 * @param {any} [input.team]
 * @returns {{ params: any, screen: string } | null} `null` quand l'equipe est inconnue.
 */
export const buildCompoTemplateDestination = ({ players = [], team = null } = {}) => {
  const teamId = String(team?.documentId || '').trim();
  if (!teamId) return null;

  return {
    params: {
      players: ensureList(players),
      sport: team?.activities?.[0]?.name || 'football',
      teamId,
      teamName: team?.name || 'Equipe',
    },
    screen: RouteNames.TeamCompoTemplate,
  };
};

/** Les 3 segments du pack, dans son ordre. */
export const COMPO_SOURCE_TEMPLATE = 'template';
export const COMPO_SOURCE_LAST = 'last';
export const COMPO_SOURCE_NEW = 'new';

/**
 * Les 3 sources du `SegmentedControl`, avec — pour chacune — ses placements de
 * depart et, quand elle n'en a pas, la RAISON qui l'explique.
 *
 * 🧾 CE QUE LA MESURE A CONTREDIT DANS LE PACK : le segment « Dernier » n'a
 * AUCUNE source au niveau d'une equipe. La reprise en cascade du serveur
 * (`getBootstrapComposition`) est attachee a un EVENEMENT ; les seules routes
 * d'equipe sont `GET/PUT/DELETE /teams/:id/default-composition`
 * (mesure du 2026-08-15 sur `admin/src/api/team/routes/team-custom.ts`).
 * Le segment existe donc — le pack l'exige — mais il dit pourquoi il est vide,
 * au lieu de faire croire a une compo qu'on n'a pas.
 * @param {object} input
 * @param {any} [input.defaultComposition] Charge de `GET /teams/:id/default-composition`.
 * @param {any} [input.lastComposition] Reserve : aucune route ne la fournit aujourd'hui.
 * @param {any[]} [input.players] L'effectif de l'equipe.
 * @param {string} [input.sport]
 * @returns {Array<{
 *   available: boolean, key: string, placements: any[], unavailableReason: string | null,
 * }>}
 */
export const buildCompoTemplateSources = ({
  defaultComposition = null,
  lastComposition = null,
  players = [],
  sport,
} = {}) => {
  const templatePlacements = keepPlacementsOfCalledUpPlayers(
    readPlacementsFromPack(defaultComposition?.composition || defaultComposition),
    players,
  );
  const lastPlacements = keepPlacementsOfCalledUpPlayers(
    readPlacementsFromPack(lastComposition?.composition || lastComposition),
    players,
  );

  return [
    {
      available: templatePlacements.length > 0,
      key: COMPO_SOURCE_TEMPLATE,
      placements: templatePlacements,
      unavailableReason: templatePlacements.length > 0 ? null : 'noTemplate',
    },
    {
      available: lastPlacements.length > 0,
      key: COMPO_SOURCE_LAST,
      placements: lastPlacements,
      unavailableReason: lastPlacements.length > 0 ? null : 'noLastMatch',
    },
    {
      // « Nouvelle compo » ne depend d'aucune donnee : c'est la formation de
      // depart du sport, posee sur l'effectif de l'equipe. Elle ne peut donc
      // jamais etre vide tant que l'equipe a des joueurs.
      available: true,
      key: COMPO_SOURCE_NEW,
      placements: buildFormationPlacements({ players, sport }),
      unavailableReason: null,
    },
  ];
};

/**
 * Le segment coche a l'ouverture : la compo type quand elle existe, une
 * formation neuve sinon.
 * @param {ReturnType<typeof buildCompoTemplateSources>} sources
 * @returns {string}
 */
export const getDefaultCompoSourceKey = (sources) => (
  ensureList(sources).some((source) => source?.key === COMPO_SOURCE_TEMPLATE && source?.available)
    ? COMPO_SOURCE_TEMPLATE
    : COMPO_SOURCE_NEW
);

/**
 * Le libelle de poste porte par un placement — c'est la pastille de poste que le
 * pack demande sur les jetons de la compo type (et nulle part sur le terrain
 * match : « le coach connait ses joueurs »).
 * @param {any} placement
 * @param {string} [sport]
 * @returns {string} Vide quand le jeton n'est pose sur aucun repere.
 */
export const getPlacementPositionLabel = (placement, sport) => {
  const matched = String(placement?.slotId || '').match(/slot_(\d+)$/);
  if (!matched) return '';
  return String(getMatchPositionLabels(sport)[Number(matched[1]) - 1] || '');
};

/**
 * Range les placements dans la FORME que `PUT /teams/:id/default-composition`
 * sait deja recevoir — la forme ancienne, `placements` a la racine.
 *
 * 🔒 On n'invente aucun champ : le controleur serveur normalise cette charge
 * telle quelle (`normalizeDefaultCompositionPayload`). Y ajouter un champ neuf
 * serait un mecanisme serveur, ce que ce lot s'interdit.
 * @param {object} input
 * @param {any[]} [input.placements]
 * @param {any[]} [input.players]
 * @param {string} [input.sport]
 * @returns {any}
 */
export const buildTeamDefaultCompositionPayload = ({
  placements = [],
  players = [],
  sport,
} = {}) => {
  const knownIds = new Set(ensureList(players).map(getCompositionPlayerId).filter(Boolean));
  return {
    placements: ensureList(placements)
      .map((/** @type {any} */ placement) => ({
        playerId: String(placement?.playerId || ''),
        positionX: Number(placement?.positionX) || 0,
        positionY: Number(placement?.positionY) || 0,
        slotId: placement?.slotId || null,
      }))
      // Un joueur qui a quitte l'equipe depuis le dernier enregistrement ne doit
      // pas etre reecrit dans le modele : il n'y a plus personne derriere son
      // identifiant.
      .filter((/** @type {any} */ placement) => knownIds.has(placement.playerId)),
    slots: buildFormationSlots(sport),
    sportContext: getTacticalSportKey(sport),
  };
};
