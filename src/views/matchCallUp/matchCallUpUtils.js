/**
 * D77 — outils du parcours MATCH « Convoquer » (ecrans 1 a 3 du pack composition).
 *
 * Tout ce qui se calcule sans rendu vit ici : compteurs du bas d'ecran, motif
 * d'indisponibilite, promesse de notification d'un joueur hors app. Les ecrans
 * n'en gardent que l'affichage.
 *
 * ⛔ Aucun mecanisme neuf : l'identifiant `manual_<horodatage>`, le marqueur
 * `isManual` et le tableau `manualPlayers` sont ceux que `TacticalSelection` et
 * `MultiTeamCompositionBoard` fabriquent deja, et que le serveur lit deja.
 */

import { getCompositionPlayerId } from '@/views/tactical_v2/multiTeamCompositionUtils';

/**
 * Effectifs par sport, repris tels quels de `design_reference/fields.jsx` :
 * combien de joueurs sur le terrain, combien sur le banc.
 * @type {Record<string, { bench: number, starters: number }>}
 */
export const MATCH_SQUAD_SIZES = {
  basketball: { bench: 5, starters: 5 },
  football: { bench: 5, starters: 11 },
  handball: { bench: 5, starters: 7 },
  rugby: { bench: 5, starters: 15 },
  volleyball: { bench: 4, starters: 6 },
};

/**
 * Les 3 motifs d'indisponibilite que le pack nomme. Ils AVERTISSENT, ils ne
 * bloquent jamais : un joueur indisponible reste cochable (« le coach sait
 * mieux »).
 * @type {string[]}
 */
export const UNAVAILABILITY_REASONS = ['injury', 'licence', 'suspension'];

const normalizeText = (/** @type {any} */ value) => String(value ?? '').trim();

/**
 * Combien de titulaires et de remplacants ce sport prevoit-il.
 * @param {string} [sport]
 * @returns {{ bench: number, starters: number } | null} `null` si le sport est inconnu.
 */
export const getMatchSquadSizes = (sport) => {
  const key = normalizeText(sport).toLowerCase();
  return MATCH_SQUAD_SIZES[key] || null;
};

/**
 * Ce joueur a-t-il ete saisi a la main (il n'a pas l'app) ?
 * @param {any} [player]
 * @returns {boolean}
 */
export const isManualCallUpPlayer = (player) => Boolean(player?.isManual)
  || getCompositionPlayerId(player).startsWith('manual_');

/**
 * Le motif qui rend ce joueur indisponible, s'il y en a un.
 *
 * ⚠️ Aucun champ serveur ne porte cette information aujourd'hui : la fonction
 * rend donc `null` pour tous les joueurs reels, et l'ecran affiche la meta
 * habituelle. Le contrat est pose ici pour que le lot serveur n'ait qu'a
 * remplir `unavailabilityReason` (+ `suspensionMatches` pour une suspension).
 * @param {any} [player]
 * @returns {{ count: number, reason: string } | null}
 */
export const getPlayerUnavailability = (player) => {
  const reason = normalizeText(player?.unavailabilityReason).toLowerCase();
  if (!UNAVAILABILITY_REASONS.includes(reason)) return null;

  const rawCount = Number(player?.suspensionMatches);
  return {
    count: Number.isFinite(rawCount) && rawCount > 0 ? Math.round(rawCount) : 1,
    reason,
  };
};

/**
 * Ce joueur ne recevra AUCUNE notification : il n'a pas l'app, et soit il n'a
 * pas de telephone, soit le SMS a ete refuse.
 *
 * 🔒 Regle du pack : « le joueur hors app ne doit jamais recevoir une promesse
 * fausse ». Partout ou son nom apparait, il porte l'etiquette « Pas de SMS ».
 * @param {any} [player]
 * @returns {boolean}
 */
export const hasSilentCallUp = (player) => {
  if (!isManualCallUpPlayer(player)) return false;
  return !normalizeText(player?.phone) || player?.notifyBySms !== true;
};

/**
 * Fabrique un joueur hors app, dans la forme EXACTE que le board et le serveur
 * connaissent deja (`manual_<horodatage>` partage par `id` et `documentId`).
 * `phone` et `notifyBySms` sont les 2 champs neufs du lot serveur D73 ; ils
 * voyagent dans le meme objet, sans mecanisme a part.
 * @param {object} input
 * @param {string} input.firstname
 * @param {string} input.lastname
 * @param {string} [input.jerseyNumber]
 * @param {string} [input.phone]
 * @param {boolean} [input.notifyBySms]
 * @param {number} [input.now] Horodatage injectable, pour les tests.
 * @returns {any}
 */
export const buildManualCallUpPlayer = ({
  firstname,
  jerseyNumber,
  lastname,
  notifyBySms = false,
  now,
  phone,
}) => {
  const stamp = Number.isFinite(now) ? now : Date.now();
  const manualId = `manual_${stamp}`;
  const cleanPhone = normalizeText(phone);

  return {
    avatar: null,
    documentId: manualId,
    firstname: normalizeText(firstname),
    id: manualId,
    isManual: true,
    lastname: normalizeText(lastname),
    // Promettre un SMS sans numero serait la promesse fausse que le pack
    // interdit : sans telephone, l'interrupteur ne vaut rien.
    notifyBySms: Boolean(notifyBySms) && Boolean(cleanPhone),
    number: normalizeText(jerseyNumber) || undefined,
    phone: cleanPhone || undefined,
  };
};

/**
 * Les compteurs de la barre du bas, branches sur les VRAIES donnees.
 * `starters` ne depasse jamais le nombre de convoques : annoncer « 11
 * titulaires » quand 8 joueurs sont coches serait un chiffre faux.
 * @param {object} input
 * @param {Set<string> | string[]} [input.selectedIds]
 * @param {any[]} [input.reinforcementPlayers] Joueurs venus d'une autre equipe du club.
 * @param {any[]} [input.manualPlayers] Joueurs hors app.
 * @param {string} [input.sport]
 * @returns {{ bench: number, calledUp: number, offApp: number,
 *   reinforcements: number, starters: number }}
 */
export const getCallUpCounters = ({
  manualPlayers = [],
  reinforcementPlayers = [],
  selectedIds = [],
  sport,
}) => {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const calledUp = selected.size;
  const sizes = getMatchSquadSizes(sport);
  const starters = sizes ? Math.min(calledUp, sizes.starters) : 0;

  const countSelected = (/** @type {any[]} */ players) => (Array.isArray(players) ? players : [])
    .filter((player) => selected.has(getCompositionPlayerId(player)))
    .length;

  return {
    bench: Math.max(0, calledUp - starters),
    calledUp,
    offApp: countSelected(manualPlayers),
    reinforcements: countSelected(reinforcementPlayers),
    starters,
  };
};
