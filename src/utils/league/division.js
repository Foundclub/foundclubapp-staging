export const MIN_LEAGUE_DIVISION = 1;
export const MAX_LEAGUE_DIVISION = 5;
export const LEAGUE_DIVISION_PROMOTION_POINTS = 100;

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export const clampLeagueDivision = (value, fallback = MAX_LEAGUE_DIVISION) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_LEAGUE_DIVISION, Math.min(MAX_LEAGUE_DIVISION, parsed));
};

/**
 * @param {unknown} division
 * @returns {number | null}
 */
export const getDivisionPromotionTargetPoints = (division) => {
  const normalized = clampLeagueDivision(division);
  return normalized === MIN_LEAGUE_DIVISION ? null : LEAGUE_DIVISION_PROMOTION_POINTS;
};

export const getNextDivisionTargetElo = getDivisionPromotionTargetPoints;

/**
 * @param {unknown} division
 * @returns {boolean}
 */
export const isMaxDivision = (division) => clampLeagueDivision(division) === MIN_LEAGUE_DIVISION;

/**
 * @param {unknown} value
 * @returns {number}
 */
const clampRatio = (value) => {
  const parsed = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(parsed) ? parsed : 0));
};

/**
 * @typedef {{targetElo?: number | null, targetPoints?: number | null}} DivisionProgressOptions
 */

/**
 * @param {unknown} points
 * @param {unknown} division
 * @param {DivisionProgressOptions} [options]
 * @returns {{
 *  division: number,
 *  elo: number,
 *  maxDivisionReached: boolean,
 *  minElo: number | null,
 *  nextDivision: number | null,
 *  points: number,
 *  pointsToPromotion: number,
 *  progressPercent: number,
 *  progressRatio: number,
 *  targetElo: number | null,
 *  targetPoints: number | null,
 * }}
 */
export const getDivisionProgressState = (points, division, options = {}) => {
  const normalizedDivision = clampLeagueDivision(division);
  const parsedPoints = Number(points);
  const normalizedPoints = Number.isFinite(parsedPoints) ? Math.max(parsedPoints, 0) : 0;
  const rawTargetOverride = options.targetPoints ?? options.targetElo;
  const hasTargetOverride = rawTargetOverride !== undefined && rawTargetOverride !== null;
  const targetOverride = Number(rawTargetOverride);
  const targetPoints = hasTargetOverride && Number.isFinite(targetOverride)
    ? targetOverride
    : getDivisionPromotionTargetPoints(normalizedDivision);
  const maxDivisionReached = isMaxDivision(normalizedDivision);

  if (maxDivisionReached || targetPoints === null || !Number.isFinite(targetPoints)) {
    return {
      division: normalizedDivision,
      elo: normalizedPoints,
      maxDivisionReached: true,
      minElo: null,
      nextDivision: null,
      points: normalizedPoints,
      pointsToPromotion: 0,
      progressPercent: 100,
      progressRatio: 1,
      targetElo: null,
      targetPoints: null,
    };
  }

  const minPoints = 0;
  const activeTargetPoints = Number(targetPoints);
  const progressRatio = clampRatio(normalizedPoints / activeTargetPoints);

  return {
    division: normalizedDivision,
    elo: normalizedPoints,
    maxDivisionReached: false,
    minElo: minPoints,
    nextDivision: Math.max(MIN_LEAGUE_DIVISION, normalizedDivision - 1),
    points: normalizedPoints,
    pointsToPromotion: Math.max(activeTargetPoints - normalizedPoints, 0),
    progressPercent: progressRatio * 100,
    progressRatio,
    targetElo: activeTargetPoints,
    targetPoints: activeTargetPoints,
  };
};

/**
 * @param {unknown} streak
 * @returns {number}
 */
export const getNextStreakBonus = (streak) => {
  const current = Math.max(0, Number.parseInt(String(streak || 0), 10) || 0);
  const next = current + 1;
  if (next >= 4) return 11;
  if (next === 3) return 6;
  if (next === 2) return 3;
  return 0;
};
