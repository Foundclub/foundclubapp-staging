const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

/**
 * BH03 · P11-11 — une demande en attente vise-t-elle CE club ? Le nom ne sert que si la
 * demande n'a pas d'identifiant : sinon deux clubs homonymes se bloquaient l'un l'autre.
 * @param {any} requestItem
 * @param {string | undefined} clubId
 * @param {string | undefined} clubName
 * @returns {boolean}
 */
export const isPendingRequestForClub = (requestItem, clubId, clubName) => {
  const currentClubId = String(clubId || '').trim();
  const requestClubId = String(requestItem?.searchContext?.clubId || '').trim();
  if (requestClubId) return Boolean(currentClubId && currentClubId === requestClubId);
  const currentClubName = normalizeComparableValue(clubName);
  return Boolean(currentClubName && normalizeComparableValue(requestItem?.clubName) === currentClubName);
};

export default isPendingRequestForClub;
