export const MIN_LEAGUE_DIVISION = 1;
export const MAX_LEAGUE_DIVISION = 5;
export const LEAGUE_DIVISION_ELO_RANGE = 200;

const DIVISION_PROMOTION_TARGETS = {
  2: 1900,
  3: 1700,
  4: 1500,
  5: 1300,
};

export const clampLeagueDivision = (value, fallback = MAX_LEAGUE_DIVISION) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_LEAGUE_DIVISION, Math.min(MAX_LEAGUE_DIVISION, parsed));
};

export const getNextDivisionTargetElo = (division) => {
  const normalized = clampLeagueDivision(division);
  return DIVISION_PROMOTION_TARGETS[normalized] || null;
};

export const isMaxDivision = (division) => clampLeagueDivision(division) === MIN_LEAGUE_DIVISION;

const clampRatio = (value) => Math.max(0, Math.min(1, value));

export const getDivisionProgressState = (elo, division, options = {}) => {
  const normalizedDivision = clampLeagueDivision(division);
  const parsedElo = Number(elo);
  const normalizedElo = Number.isFinite(parsedElo) ? parsedElo : 0;
  const hasTargetOverride = options.targetElo !== undefined && options.targetElo !== null;
  const targetOverride = Number(options.targetElo);
  const targetElo = hasTargetOverride && Number.isFinite(targetOverride)
    ? targetOverride
    : getNextDivisionTargetElo(normalizedDivision);
  const maxDivisionReached = isMaxDivision(normalizedDivision);

  if (maxDivisionReached || !Number.isFinite(targetElo)) {
    return {
      division: normalizedDivision,
      elo: normalizedElo,
      maxDivisionReached: true,
      minElo: null,
      nextDivision: null,
      pointsToPromotion: 0,
      progressPercent: 100,
      progressRatio: 1,
      targetElo: null,
    };
  }

  const rangeOverride = Number(options.range);
  const range = Number.isFinite(rangeOverride) && rangeOverride > 0
    ? rangeOverride
    : LEAGUE_DIVISION_ELO_RANGE;
  const minElo = normalizedDivision === MAX_LEAGUE_DIVISION ? 0 : targetElo - range;
  const progressRange = targetElo - minElo;
  const progressRatio = clampRatio((normalizedElo - minElo) / progressRange);

  return {
    division: normalizedDivision,
    elo: normalizedElo,
    maxDivisionReached: false,
    minElo,
    nextDivision: Math.max(MIN_LEAGUE_DIVISION, normalizedDivision - 1),
    pointsToPromotion: Math.max(targetElo - normalizedElo, 0),
    progressPercent: progressRatio * 100,
    progressRatio,
    targetElo,
  };
};
