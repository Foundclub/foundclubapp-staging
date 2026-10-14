import { withAlpha } from '@/theme/colors';

/** @typedef {'app' | 'attente' | 'bloque' | 'exterieur' | 'ferme' | 'libre'} EtatDuCreneau */

/**
 * L'ALLURE D'UN CRÉNEAU — sortie de `FriseDuJour` (RESA-L5A1) par RESA-L5A2 (14/10/2026) pour
 * que la frise de l'accueil (E-G02) et la grille du planning (E-G03) dessinent les 6 états de la
 * même façon
 * (planche P00 : libre, réservé dans l'app, réservé à l'extérieur, en attente, bloqué, fermé).
 */

/** Les 6 états, dans l'ordre de la légende. */
export const ETATS_DU_CRENEAU = /** @type {ReadonlyArray<EtatDuCreneau>} */ (Object.freeze([
  'libre', 'app', 'exterieur', 'attente', 'bloque', 'ferme',
]));

/**
 * Le libellé d'un état (la légende, la lecture d'écran).
 * @param {(cle: string, defaut: string) => string} t - Traduction.
 * @param {EtatDuCreneau} etat - L'état.
 * @returns {string} Le libellé.
 */
export const libelleDeLEtat = (t, etat) => {
  switch (etat) {
    case 'app':
      return t('complexeGerant.frise.app', 'Réservé dans l’app');
    case 'attente':
      return t('complexeGerant.frise.attente', 'En attente');
    case 'bloque':
      return t('complexeGerant.frise.bloque', 'Bloqué');
    case 'exterieur':
      return t('complexeGerant.frise.exterieur', 'Réservé à l’extérieur');
    case 'ferme':
      return t('complexeGerant.frise.ferme', 'Fermé');
    default:
      return t('complexeGerant.frise.libre', 'Libre');
  }
};

/**
 * Le style d'un créneau selon son état.
 * @param {Record<string, string>} Colors - Les couleurs du thème.
 * @param {EtatDuCreneau} etat - L'état.
 * @param {string} couleur - La couleur du sport.
 * @returns {import('react-native').ViewStyle} Le style.
 */
export const styleDuCreneau = (Colors, etat, couleur) => {
  switch (etat) {
    case 'app':
      return { backgroundColor: withAlpha(couleur, 0.85), borderColor: couleur };
    case 'attente':
      return {
        backgroundColor: 'transparent',
        borderColor: Colors.warning500,
        borderStyle: 'dashed',
      };
    case 'bloque':
      return {
        backgroundColor: withAlpha(Colors.primary200, 0.14),
        borderColor: withAlpha(Colors.primary200, 0.4),
      };
    case 'exterieur':
      return { backgroundColor: withAlpha(couleur, 0.3), borderColor: couleur };
    case 'ferme':
      return {
        backgroundColor: withAlpha(Colors.warning500, 0.2),
        borderColor: Colors.warning500,
      };
    default:
      return {
        backgroundColor: 'transparent',
        borderColor: withAlpha(Colors.primary500, 0.6),
        borderStyle: 'dashed',
      };
  }
};
