/**
 * MSGIMG — LA REGLE DU « GLISSER VERS LE BAS POUR FERMER » une image ouverte en grand.
 *
 * Une seule regle pour le telephone (`ApercuDImage.js`, Gesture Handler) et pour le site
 * au toucher (`ApercuDImageDuSite.js`) : memes seuils, meme fond qui s'eclaircit.
 *
 * Les deux fonctions portent `'worklet'` : sur le telephone, Reanimated les appelle
 * depuis le fil d'animation (rappels du geste, style anime). Sur le site et dans Jest,
 * la directive n'est qu'une chaine sans effet.
 */

/** Part de la hauteur de l'ecran au-dela de laquelle un glissement ferme l'image. */
export const PART_DE_L_ECRAN_QUI_FERME = 0.18;

/** Un coup sec vers le bas (px/s) ferme meme court… */
export const VITESSE_QUI_FERME = 1000;

/** … pourvu que le doigt ait vraiment bouge (px) : un simple appui ne ferme rien. */
export const GLISSEMENT_MINIMAL_D_UN_COUP_SEC = 40;

/** Le fond ne descend jamais sous cette opacite : on devine encore le cadre. */
export const OPACITE_MINIMALE_DU_FOND = 0.2;

/**
 * Le doigt est lache : l'image se ferme-t-elle ?
 * @param {number} glissement Le deplacement vertical (positif = vers le bas).
 * @param {number} vitesse La vitesse verticale au lacher (px/s).
 * @param {number} hauteur La hauteur de l'ecran.
 * @returns {boolean} Vrai si l'image doit se fermer.
 */
export const doitFermer = (glissement, vitesse, hauteur) => {
  'worklet';

  if (!(glissement > 0)) return false;
  if (glissement >= hauteur * PART_DE_L_ECRAN_QUI_FERME) return true;
  return vitesse >= VITESSE_QUI_FERME && glissement >= GLISSEMENT_MINIMAL_D_UN_COUP_SEC;
};

/**
 * L'opacite du fond pendant le glissement : il s'eclaircit a mesure que l'image descend.
 * @param {number} glissement Le deplacement vertical (positif = vers le bas).
 * @param {number} hauteur La hauteur de l'ecran.
 * @returns {number} L'opacite, entre OPACITE_MINIMALE_DU_FOND et 1.
 */
export const opaciteDuFond = (glissement, hauteur) => {
  'worklet';

  if (!(glissement > 0) || !(hauteur > 0)) return 1;
  return Math.max(OPACITE_MINIMALE_DU_FOND, 1 - (glissement / (hauteur * 0.6)));
};
