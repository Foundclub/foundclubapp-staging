/**
 * Generates initials from a club name by taking the first letter of each significant word.
 * Excludes common French connecting words like "de", "du", "d'", "la", etc.
 * @param {string} clubName - The full name of the club
 * @returns {string} The initials of the club name in uppercase
 */
export function getClubInitials(clubName) {
  if (!clubName || typeof clubName !== 'string') {
    return '';
  }

  // List of French connecting words to exclude
  const excludedWords = ['de', 'du', 'des', 'le', 'la', 'les', 'et', 'a', 'à', 'au', 'aux', 'en', 'l', 'd'];

  // Split the club name into words and filter out empty strings
  const words = clubName
    .split(/[\s']+/)
    .filter((word) => word.length > 0);

  // Get the initial of each word that's not in the excluded list
  const initials = words
    .filter((word) => {
      // Remove any apostrophes and trailing characters for comparison
      const cleanWord = word.toLowerCase().replace(/^(l'|d')/i, '');
      const wordToCheck = word.toLowerCase().replace(/^(l'|d')/i, '');

      // Check if this word should be excluded
      return !excludedWords.includes(wordToCheck) && !excludedWords.includes(cleanWord);
    })
    .map((word) => word.charAt(0).toUpperCase());

  // Join the initials and return
  return initials.join('');
}

/**
 * Counts the number of filters applied to the club filters object.
 * @param {ClubFilters} [filters] - The filters object
 * @returns {number} The number of filters applied
 */
export const getClubFiltersNumber = (filters) => {
  let number = 0;
  // if (filters?.name) {
  //   number += 1;
  // }
  if (filters?.geohash?.length) {
    number += 1;
  }
  if (filters?.activity) {
    number += 1;
  }
  return number;
};
