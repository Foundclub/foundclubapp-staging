/**
 * Positions by Sport
 * ==================
 * Source de vérité unique pour les postes par sport.
 * Utilisé dans: UserPosition (onboarding), AdWizardPositions (création annonce)
 *
 * IMPORTANT: Ces données doivent correspondre aux sports de la collection
 * Activity dans Strapi (Football, Basketball, Handball, Volleyball, Rugby)
 */

// Sports qui ont des postes (les autres sports n'ont pas de postes)
export const SPORTS_WITH_POSITIONS = ['football', 'basketball', 'handball', 'volleyball', 'rugby'];

/**
 * Positions complètes par sport pour le profil utilisateur
 * Permet la sélection multiple
 */
export const POSITIONS_BY_SPORT = {
  basketball: [
    { label: 'Meneur', value: 'Meneur' },
    { label: 'Arrière', value: 'Arrière' },
    { label: 'Ailier', value: 'Ailier' },
    { label: 'Ailier fort', value: 'Ailier fort' },
    { label: 'Pivot', value: 'Pivot' },
  ],
  football: [
    { label: 'Gardien', value: 'Gardien' },
    { label: 'Défenseur central', value: 'Défenseur central' },
    { label: 'Latéral droit', value: 'Latéral droit' },
    { label: 'Latéral gauche', value: 'Latéral gauche' },
    { label: 'Milieu défensif', value: 'Milieu défensif' },
    { label: 'Milieu central', value: 'Milieu central' },
    { label: 'Milieu offensif', value: 'Milieu offensif' },
    { label: 'Ailier droit', value: 'Ailier droit' },
    { label: 'Ailier gauche', value: 'Ailier gauche' },
    { label: 'Attaquant', value: 'Attaquant' },
    { label: 'Avant-centre', value: 'Avant-centre' },
  ],
  handball: [
    { label: 'Gardien', value: 'Gardien' },
    { label: 'Arrière gauche', value: 'Arrière gauche' },
    { label: 'Arrière droit', value: 'Arrière droit' },
    { label: 'Demi-centre', value: 'Demi-centre' },
    { label: 'Ailier gauche', value: 'Ailier gauche' },
    { label: 'Ailier droit', value: 'Ailier droit' },
    { label: 'Pivot', value: 'Pivot' },
  ],
  rugby: [
    { label: 'Pilier', value: 'Pilier' },
    { label: 'Talonneur', value: 'Talonneur' },
    { label: 'Deuxième ligne', value: 'Deuxième ligne' },
    { label: 'Troisième ligne aile', value: 'Troisième ligne aile' },
    { label: 'Troisième ligne centre', value: 'Troisième ligne centre' },
    { label: 'Demi de mêlée', value: 'Demi de mêlée' },
    { label: 'Demi d\'ouverture', value: 'Demi d\'ouverture' },
    { label: 'Centre', value: 'Centre' },
    { label: 'Ailier', value: 'Ailier' },
    { label: 'Arrière', value: 'Arrière' },
  ],
  volleyball: [
    { label: 'Pointu (Opposite)', value: 'Pointu' },
    { label: 'Réceptionneur-attaquant', value: 'Réceptionneur-attaquant' },
    { label: 'Central', value: 'Central' },
    { label: 'Passeur (Setter)', value: 'Passeur' },
    { label: 'Libéro', value: 'Libéro' },
  ],
};

/**
 * Obtient les postes pour un sport donné
 * @param {string} sportName - Nom du sport (peut être capitalisé ou non)
 * @returns {Array<{label: string, value: string}>} Liste des postes
 */
export function getPositionsForSport(sportName) {
  if (!sportName) return [];
  const normalized = sportName.toLowerCase();
  return POSITIONS_BY_SPORT[normalized] || [];
}

/**
 * Vérifie si un sport a des postes définis
 * @param {string} sportName - Nom du sport
 * @returns {boolean}
 */
export function sportHasPositions(sportName) {
  if (!sportName) return false;
  return SPORTS_WITH_POSITIONS.includes(sportName.toLowerCase());
}

/**
 * Obtient juste les valeurs des postes (strings) pour un sport
 * @param {string} sportName - Nom du sport
 * @returns {string[]} Liste des noms de postes
 */
export function getPositionValuesForSport(sportName) {
  return getPositionsForSport(sportName).map((p) => p.value);
}
