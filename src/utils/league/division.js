export const MIN_LEAGUE_DIVISION = 1;
export const MAX_LEAGUE_DIVISION = 5;

const DIVISION_PROMOTION_TARGETS = {
  5: 1300,
  4: 1500,
  3: 1700,
  2: 1900,
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

