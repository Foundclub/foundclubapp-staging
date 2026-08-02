import { colors as themeColors } from '@/theme/colors';

/**
 * @param {any} club
 * @returns {boolean}
 */
export const isPartnerClub = (club) => (
  club?.clubPartner === true
);

/**
 * @param {any} club
 * @returns {boolean}
 */
export const isVerifiedClub = (club) => (
  typeof club?.clubVerified === 'boolean'
    ? club.clubVerified === true
    : false
);

/**
 * @param {any} club
 * @returns {string}
 */
// R10 — un seul mot pour une seule idee : CERTIFIE. L'ancien couple melangeait
// deux vocabulaires pour le meme etat, et son accord au feminin visait l'equipe
// alors que c'est le CLUB qui est certifie.
// Portee assumee (validee par Adel) : ce libelle s'affiche sur la fiche club
// ET sur les pages evenements du site web.
export const getClubCertificationLabel = (club) => (
  isVerifiedClub(club) ? 'Certifié' : 'Non certifié'
);

/**
 * @param {any} club
 * @param {Record<string, string>} [Colors] - Theme colors, defaults to the static token map.
 * @returns {{
 *   backgroundColor: string;
 *   borderColor: string;
 *   textColor: string;
 * }}
 */
export const getClubCertificationPalette = (club, Colors = {}) => {
  if (isVerifiedClub(club)) {
    const verifiedInk = Colors.success500 || themeColors.success500;
    return {
      backgroundColor: `${verifiedInk}18`,
      borderColor: `${verifiedInk}44`,
      textColor: verifiedInk,
    };
  }

  const neutralSurface = Colors.neutral300 || themeColors.neutral300;
  return {
    backgroundColor: `${neutralSurface}18`,
    borderColor: `${neutralSurface}44`,
    textColor: Colors.neutral100 || themeColors.neutral100,
  };
};
