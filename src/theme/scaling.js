import { Dimensions } from 'react-native';

const { height, width } = Dimensions.get('window');

// Dimensions de référence (iPhone 14 Pro Max)
const GUIDELINE_BASE_WIDTH = 430;
const GUIDELINE_BASE_HEIGHT = 932;

/**
 * Fonction pour mettre à l'échelle la largeur
 * Utiliser pour : width, marginHorizontal, paddingHorizontal, etc.
 * @param {number} size - Taille en pixels sur la maquette Figma
 * @returns {number} - Taille adaptée à l'écran actuel
 */
const horizontalScale = (size) => (width / GUIDELINE_BASE_WIDTH) * size;

/**
 * Fonction pour mettre à l'échelle la hauteur
 * Utiliser pour : height, marginVertical, paddingVertical, etc.
 * @param {number} size - Taille en pixels sur la maquette Figma
 * @returns {number} - Taille adaptée à l'écran actuel
 */
const verticalScale = (size) => (height / GUIDELINE_BASE_HEIGHT) * size;

/**
 * Fonction pour mettre à l'échelle modérément (recommandé pour les polices et les tailles globales)
 * Permet de redimensionner mais avec une limite pour ne pas être trop petit sur les petits écrans
 * @param {number} size - Taille en pixels sur la maquette Figma
 * @param {number} [factor] - Facteur de modération (0.5 = 50% de redimensionnement)
 * @returns {number} - Taille adaptée
 */
const moderateScale = (size, factor = 0.5) => size + (horizontalScale(size) - size) * factor;

export { horizontalScale, moderateScale, verticalScale };
