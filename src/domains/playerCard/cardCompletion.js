// @ts-nocheck
/**
 * CARTECODE-PARCOURS (planche v2, partie 8) — « Compléter ma carte » : ce qui manque à la
 * carte, dans l'ordre des écrans. Logique PURE : l'écran pose les questions, ce module dit
 * lesquelles. Une question par écran, chacune se passe : personne n'est bloqué.
 */
import { CARD_SPORTS_WITH_POSITIONS, extractCity } from '@/domains/playerCard/cardModel';

export const CARD_COMPLETION_STEP = Object.freeze({
  BIRTHDATE: 'birthdate',
  CITY: 'city',
  NUMBER: 'number',
  PHYSIQUE: 'physique',
  POSITION: 'position',
});

const vide = (value) => value === null || value === undefined || String(value).trim() === '';

const estNumero = (value) => {
  if (vide(value)) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99;
};

// La date EN PREMIER (registre des mineurs, ligne 43), puis poste, taille et poids, ville, numéro.
const ETAPES = [
  [CARD_COMPLETION_STEP.BIRTHDATE, (user) => !user.birthdate],
  // Un sport sans poste (tennis…), ou aucun sport : l'étape saute.
  [CARD_COMPLETION_STEP.POSITION, (user) => CARD_SPORTS_WITH_POSITIONS
    .includes(String(user.preferredSport || '').toLowerCase()) && vide(user.position)],
  [CARD_COMPLETION_STEP.PHYSIQUE, (user) => vide(user.height) || vide(user.weight)],
  [CARD_COMPLETION_STEP.CITY, (user) => !extractCity(user.address)],
  [CARD_COMPLETION_STEP.NUMBER, (user) => !estNumero(user.jerseyNumber)],
];

/**
 * Les étapes du parcours qui manquent à ce profil, dans l'ordre des écrans.
 * @param {object} [user] userData
 * @returns {string[]}
 */
export const listMissingCardSteps = (user = {}) => ETAPES
  .filter(([, manque]) => manque(user || {}))
  .map(([etape]) => etape);

export default listMissingCardSteps;
