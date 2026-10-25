// Calendrier federal de la fiche equipe : regles pures, testees a part (BH12).

const DATE_SANS_HEURE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * P12-04 : une date sans heure vaut jusqu'a la fin de SA journee locale.
 * @param {unknown} rawDate
 * @param {number|null} dateTs
 * @returns {number|null} instant a comparer a « maintenant »
 */
export function federalMatchDeadlineTs(rawDate, dateTs) {
  if (dateTs === null) return null;
  if (typeof rawDate === 'string' && DATE_SANS_HEURE.test(rawDate)) {
    const [y, m, d] = rawDate.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
  return dateTs;
}

/**
 * P12-03 : un score absent (null, '') ne vaut pas 0.
 * @param {unknown} mine
 * @param {unknown} other
 * @returns {'V'|'N'|'D'|''}
 */
export function federalMatchResult(mine, other) {
  const absent = (/** @type {unknown} */ score) => score === null || score === undefined || score === '';
  if (absent(mine) || absent(other)) return '';
  const a = Number(mine);
  const b = Number(other);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  if (a > b) return 'V';
  if (a < b) return 'D';
  return 'N';
}
