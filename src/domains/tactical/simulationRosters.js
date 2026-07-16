import { getTacticalSportKey } from '@/utils/tacticalField';

/**
 * Generateur de rosters fictifs pour le MODE SIMULATION du board de composition.
 *
 * Ces joueurs servent uniquement d'apercu (tour guide du coach) : ils ne sont
 * jamais persistes, ne consomment aucun quota et ne declenchent aucune
 * notification. La structure est volontairement compatible avec ce que
 * TacticalBoard attend en `params.players` (matching via `id || documentId`,
 * affichage via `firstname`/`lastname`).
 */

/**
 * @typedef {object} SimulationPlayer
 * @property {string} documentId - Identifiant fictif stable (`sim-<sport>-<n>`).
 * @property {string} firstname
 * @property {string} lastname
 * @property {string} position - Intitule du poste fictif.
 * @property {true} isSimulation - Marqueur d'apercu (jamais persiste).
 */

// Prenoms/noms fictifs sans accents (textes affiches par les tokens du board).
const SIM_FIRST_NAMES = [
  'Lucas', 'Hugo', 'Nathan', 'Enzo', 'Louis', 'Gabriel',
  'Raphael', 'Arthur', 'Jules', 'Adam', 'Noah', 'Ethan',
  'Tom', 'Nolan', 'Sacha', 'Theo', 'Maxime', 'Antoine',
];
const SIM_LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Robert', 'Richard', 'Petit',
  'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Michel',
  'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
];

// Postes fictifs par sport (nombre + intitules coherents, sans accents).
const SIM_POSITIONS_BY_SPORT = {
  basketball: [
    'Meneur', 'Meneur', 'Arriere', 'Arriere',
    'Ailier', 'Ailier', 'Pivot', 'Pivot',
  ],
  football: [
    'Gardien',
    'Defenseur', 'Defenseur', 'Defenseur', 'Defenseur', 'Defenseur',
    'Milieu', 'Milieu', 'Milieu', 'Milieu', 'Milieu',
    'Attaquant', 'Attaquant', 'Attaquant',
  ],
  handball: [
    'Gardien', 'Gardien',
    'Arriere', 'Arriere', 'Arriere',
    'Demi-centre',
    'Ailier', 'Ailier',
    'Pivot', 'Pivot',
  ],
  rugby: [
    'Pilier', 'Pilier', 'Pilier',
    'Talonneur', 'Talonneur',
    'Deuxieme ligne', 'Deuxieme ligne',
    'Troisieme ligne', 'Troisieme ligne', 'Troisieme ligne',
    'Demi de melee',
    "Demi d'ouverture",
    'Centre', 'Centre',
    'Ailier', 'Ailier',
    'Arriere', 'Arriere',
  ],
  volleyball: [
    'Passeur', 'Passeur',
    'Central', 'Central',
    'Pointu',
    'Receptionneur', 'Receptionneur', 'Receptionneur',
    'Libero',
  ],
};

const GENERIC_ROSTER_SIZE = 10;

/**
 * Construit un joueur fictif compatible avec les tokens du TacticalBoard.
 * @param {string} sportKey - Cle de sport normalisee (ex: 'football').
 * @param {number} index - Rang 1-base du joueur dans le roster.
 * @param {string} position - Intitule du poste fictif.
 * @returns {SimulationPlayer}
 */
const buildSimulationPlayer = (sportKey, index, position) => {
  const slot = index - 1;
  return {
    documentId: `sim-${sportKey}-${index}`,
    firstname: SIM_FIRST_NAMES[slot % SIM_FIRST_NAMES.length],
    isSimulation: true,
    lastname: SIM_LAST_NAMES[slot % SIM_LAST_NAMES.length],
    position,
  };
};

/**
 * Retourne un roster fictif coherent avec le sport pour alimenter le board en
 * MODE SIMULATION (aucune ecriture serveur). Le sport est normalise (minuscule,
 * sans accents) via `getTacticalSportKey`; tout sport inconnu retombe sur un
 * roster generique de 10 joueurs.
 * @param {string | null | undefined} sport - Libelle de sport (accents/casse tolerees).
 * @returns {SimulationPlayer[]}
 */
export const getSimulationRoster = (sport) => {
  const sportKey = getTacticalSportKey(sport);
  const positions = /** @type {Record<string, string[]>} */ (SIM_POSITIONS_BY_SPORT)[sportKey];

  if (positions) {
    return positions.map((/** @type {string} */ position, /** @type {number} */ i) => (
      buildSimulationPlayer(sportKey, i + 1, position)
    ));
  }

  // Fallback generique : 'Joueur 1'..'Joueur 10'.
  return Array.from({ length: GENERIC_ROSTER_SIZE }, (_, i) => {
    const index = i + 1;
    return {
      documentId: `sim-${sportKey}-${index}`,
      firstname: 'Joueur',
      isSimulation: true,
      lastname: String(index),
      position: `Joueur ${index}`,
    };
  });
};

export default getSimulationRoster;
