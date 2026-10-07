/**
 * MSG1A — LA TYPOGRAPHIE DU FIL « MODELE WHATSAPP » (SPECS.md §1).
 *
 * Montserrat seule, en 400 et 700 : le pack dessine aussi en 500, 600 et 800, qui
 * retombent ici sur 400 ou 700 (consigne de SPECS.md, en tete). Les tailles du pack
 * (15, 13, 12,5, 11...) n'existent pas dans la rampe `Fonts` : elles sont ecrites
 * une fois, ICI, et nulle part ailleurs.
 */
const REGULIER = 'Montserrat-Regular';
const GRAS = 'Montserrat-Bold';

/** Texte d'un message : 15/20. */
export const TEXTE_DU_MESSAGE = { fontFamily: REGULIER, fontSize: 15, lineHeight: 20 };

/** Nom de l'auteur, sur la 1re bulle d'un groupe : 13/700. */
export const NOM_DE_L_AUTEUR = { fontFamily: GRAS, fontSize: 13, lineHeight: 18 };

/** Role du staff a droite du nom : 11,5. */
export const ROLE_DE_L_AUTEUR = { fontFamily: REGULIER, fontSize: 11.5, lineHeight: 16 };

/** Heure dans la bulle : 11. */
export const HEURE = { fontFamily: REGULIER, fontSize: 11, lineHeight: 14 };

/** Puce de date : 12/700. */
export const PUCE_DE_DATE = { fontFamily: GRAS, fontSize: 12, lineHeight: 16 };

/** Notice systeme, discrete : 11,5/15. */
export const NOTICE = { fontFamily: REGULIER, fontSize: 11.5, lineHeight: 15 };

/** Titre de l'en-tete du fil : 16/700. */
export const TITRE_DU_FIL = { fontFamily: GRAS, fontSize: 16, lineHeight: 20 };

/** Sous-titre de l'en-tete : 12,5. */
export const SOUS_TITRE_DU_FIL = { fontFamily: REGULIER, fontSize: 12.5, lineHeight: 17 };

/** Citation : nom 12,5/700 et extrait 13/18. */
export const NOM_CITE = { fontFamily: GRAS, fontSize: 12.5, lineHeight: 17 };
export const EXTRAIT_CITE = { fontFamily: REGULIER, fontSize: 13, lineHeight: 18 };

/** Total d'une pilule de reactions : 12/700. */
export const TOTAL_DES_REACTIONS = { fontFamily: GRAS, fontSize: 12, lineHeight: 16 };

/** Libelles de menu (appui long, ⋮) : 15,5. */
export const LIGNE_DE_MENU = { fontFamily: REGULIER, fontSize: 15.5, lineHeight: 20 };

/** Gras generique, pour les etiquettes des cartes riches. */
export const GRAS_FAMILLE = GRAS;
export const REGULIER_FAMILLE = REGULIER;
