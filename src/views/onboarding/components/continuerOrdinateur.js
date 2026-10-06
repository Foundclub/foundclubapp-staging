import { Platform } from 'react-native';

/**
 * FINITIONS16 21 puis FINITIONS18 11 (planche 8, P1-inscription-ordi) — SUR LE SITE, sur
 * ordinateur, le bouton qui fait avancer une inscription (« Continuer ») se pose A DROITE, 200 px
 * au moins ; au telephone, il garde toute la largeur. Une seule regle pour les ecrans
 * d'inscription : FINITIONS16 l'avait posee sur « Quel est ton statut ? » seulement, et la T16 a
 * mesure « Qui es-tu ? » et l'inscription d'une collectivite pleine largeur.
 */
export const STYLE_CONTINUER_ORDINATEUR = /** @type {import('react-native').ViewStyle} */ ({
  alignSelf: 'flex-end',
  minWidth: 200,
});

/**
 * Le site, sur un ecran d'ordinateur ?
 * @param {boolean} isDesktop - `useIsDesktop()`.
 * @returns {boolean} Vrai sur le site a la largeur d'un ordinateur.
 */
export const continuerSurOrdinateur = (isDesktop) => Platform.OS === 'web' && Boolean(isDesktop);
