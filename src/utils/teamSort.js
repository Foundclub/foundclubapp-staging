/**
 * @param {string | undefined | null} value
 * @returns {string}
 */
function normalizeSortText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Keep section grouping stable while preserving age sorting inside each section.
 *
 * @param {string | undefined | null} sectionLabel
 * @returns {number}
 */
function getSectionSortScore(sectionLabel) {
  const normalized = normalizeSortText(sectionLabel);

  if (!normalized) return 99;
  if (normalized.includes('masculine')) return 0;
  if (normalized.includes('feminine')) return 1;
  if (normalized.includes('mixte')) return 2;

  return 3;
}

/**
 * Higher score = older category.
 *
 * @param {string | undefined | null} categoryLabel
 * @returns {number}
 */
function getCategoryAgeScore(categoryLabel) {
  const normalized = normalizeSortText(categoryLabel);

  if (!normalized) return -1;
  if (normalized.includes('veteran')) return 260;
  if (normalized.includes('senior')) return 240;
  if (normalized.includes('espoir')) return 220;

  const underMatch = normalized.match(/\bu\s*[- ]?(\d{1,2})\b/);
  if (underMatch) return 100 + Number.parseInt(underMatch[1], 10);

  if (normalized.includes('junior')) return 118;
  if (normalized.includes('cadet')) return 116;
  if (normalized.includes('minime')) return 114;
  if (normalized.includes('benjamin')) return 112;
  if (normalized.includes('poussin')) return 110;
  if (normalized.includes('baby')) return 108;
  if (normalized.includes('debutant') || normalized.includes('ecole')) return 106;

  return 0;
}

/**
 * @param {any[]} list
 * @returns {any[]}
 */
function sortTeamsForDisplay(list = []) {
  return [...list].sort((teamA, teamB) => {
    const sectionA = normalizeSortText(teamA?.section?.name);
    const sectionB = normalizeSortText(teamB?.section?.name);
    const sectionScore = getSectionSortScore(teamA?.section?.name) - getSectionSortScore(teamB?.section?.name);

    if (sectionScore !== 0) return sectionScore;
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB, 'fr');

    const categoryA = teamA?.category?.name || teamA?.category;
    const categoryB = teamB?.category?.name || teamB?.category;
    const ageScore = getCategoryAgeScore(categoryB) - getCategoryAgeScore(categoryA);

    if (ageScore !== 0) return ageScore;

    const levelA = normalizeSortText(teamA?.level?.name || teamA?.level);
    const levelB = normalizeSortText(teamB?.level?.name || teamB?.level);
    if (levelA !== levelB) return levelA.localeCompare(levelB, 'fr');

    return normalizeSortText(teamA?.name).localeCompare(normalizeSortText(teamB?.name), 'fr');
  });
}

export {
  getCategoryAgeScore,
  getSectionSortScore,
  normalizeSortText,
  sortTeamsForDisplay,
};
