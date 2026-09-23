import { Easing, withSpring, withTiming } from 'react-native-reanimated';

// VOCAL — LES JETONS DE MOUVEMENT DE LA MAQUETTE (section « Mouvement »).
//
// Cinq jetons, pas un de plus : chaque animation du vocal en prend un, avec la
// durée que la planche lui donne. « Réduire les animations » (réglage du
// téléphone) remplace les ressorts par 160 ms easeOut — c'est la consigne de
// la section « Accessibilité ».

/** Départ vif, arrivée douce : apparitions, entrée des bulles. */
export const VOICE_EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
/** Départ doux, sortie nette : disparitions. */
export const VOICE_EASE_IN = Easing.bezier(0.4, 0, 1, 1);
/** Sinusoïdal : les boucles (point, indice, chevron). */
export const VOICE_EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1);
/** Le ressort `snappy` : ≈ 300 ms, dépassement ≈ 6 %. */
export const VOICE_SNAPPY = { damping: 22, mass: 1, stiffness: 280 };

/**
 * Le ressort `snappy` — ou 160 ms easeOut si le téléphone réduit les animations.
 * @param {number} cible - La valeur visée.
 * @param {boolean} [reduire] - Le réglage « réduire les animations ».
 * @returns {any} L'animation.
 */
export const snappy = (cible, reduire = false) => {
  'worklet';

  return reduire
    ? withTiming(cible, { duration: 160, easing: VOICE_EASE_OUT })
    : withSpring(cible, VOICE_SNAPPY);
};

/**
 * Une apparition : `easeOut` sur la durée donnée.
 * @param {number} cible - La valeur visée.
 * @param {number} duree - La durée, en millisecondes.
 * @returns {any} L'animation.
 */
export const easeOut = (cible, duree) => {
  'worklet';

  return withTiming(cible, { duration: duree, easing: VOICE_EASE_OUT });
};

/**
 * Une disparition : `easeIn` sur la durée donnée.
 * @param {number} cible - La valeur visée.
 * @param {number} duree - La durée, en millisecondes.
 * @returns {any} L'animation.
 */
export const easeIn = (cible, duree) => {
  'worklet';

  return withTiming(cible, { duration: duree, easing: VOICE_EASE_IN });
};
