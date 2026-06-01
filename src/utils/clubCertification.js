export const isPartnerClub = (club) => club?.isCustomer === true;

export const getClubCertificationLabel = (club) => (
  isPartnerClub(club) ? 'Verifie' : 'Non certifiee'
);

export const getClubCertificationPalette = (club, Colors = {}) => {
  if (isPartnerClub(club)) {
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
