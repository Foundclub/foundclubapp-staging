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
export const getClubCertificationLabel = (club) => (
  isVerifiedClub(club) ? 'Verifie' : 'Non certifiee'
);

/**
 * @param {any} club
 * @param {Record<string, string>} [Colors={}]
 * @returns {{
 *   backgroundColor: string;
 *   borderColor: string;
 *   textColor: string;
 * }}
 */
export const getClubCertificationPalette = (club, Colors = {}) => {
  if (isVerifiedClub(club)) {
    return {
      backgroundColor: `${Colors.success500 || '#22c55e'}18`,
      borderColor: `${Colors.success500 || '#22c55e'}44`,
      textColor: Colors.success500 || '#22c55e',
    };
  }

  return {
    backgroundColor: `${Colors.neutral300 || '#a3a3a3'}18`,
    borderColor: `${Colors.neutral300 || '#a3a3a3'}44`,
    textColor: Colors.neutral100 || Colors.neutral300 || '#d4d4d4',
  };
};
