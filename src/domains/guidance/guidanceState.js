/* eslint-disable max-len */
// @ts-nocheck
export const DEFAULT_GUIDANCE_PROGRAM_VERSION = 1;

export const DEFAULT_GUIDANCE_CONFIG = Object.freeze({
  enabled: true,
  overrides: {
    disabledMissionIds: [],
    programOrder: ['player', 'coach', 'president', 'league_intro'],
  },
  programVersion: DEFAULT_GUIDANCE_PROGRAM_VERSION,
});

const normalizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeIsoDate = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const parsedDate = new Date(normalized);
  if (!Number.isFinite(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};

const normalizeNumber = (value, fallbackValue = DEFAULT_GUIDANCE_PROGRAM_VERSION) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return Math.max(1, Math.round(numericValue));
};

const uniqueStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((entry) => normalizeString(entry))
      .filter(Boolean),
  ));
};

const normalizeSignalMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, rawTimestamp]) => {
    const normalizedKey = normalizeString(key);
    const normalizedTimestamp = normalizeIsoDate(rawTimestamp);
    if (!normalizedKey || !normalizedTimestamp) {
      return accumulator;
    }
    accumulator[normalizedKey] = normalizedTimestamp;
    return accumulator;
  }, {});
};

export const createEmptyGuidanceState = (programVersion = DEFAULT_GUIDANCE_PROGRAM_VERSION) => ({
  actionSignals: {},
  completedMissionIds: [],
  completedPackIds: [],
  dismissedDockUntil: null,
  dismissedDockUpdatedAt: null,
  interactionSignals: {},
  lastViewedMissionAt: null,
  lastViewedMissionId: null,
  manuallyConfirmedMissionIds: [],
  programVersionSeen: normalizeNumber(programVersion, DEFAULT_GUIDANCE_PROGRAM_VERSION),
  programVersionSeenAt: null,
  routeVisits: {},
  updatedAt: null,
});

export const normalizeGuidanceState = (value, programVersion = DEFAULT_GUIDANCE_PROGRAM_VERSION) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalizedProgramVersion = normalizeNumber(
    source.programVersionSeen,
    programVersion,
  );

  return {
    actionSignals: normalizeSignalMap(source.actionSignals),
    completedMissionIds: uniqueStringArray(source.completedMissionIds),
    completedPackIds: uniqueStringArray(source.completedPackIds),
    dismissedDockUntil: normalizeIsoDate(source.dismissedDockUntil),
    dismissedDockUpdatedAt: normalizeIsoDate(source.dismissedDockUpdatedAt),
    interactionSignals: normalizeSignalMap(source.interactionSignals),
    lastViewedMissionAt: normalizeIsoDate(source.lastViewedMissionAt),
    lastViewedMissionId: normalizeString(source.lastViewedMissionId),
    manuallyConfirmedMissionIds: uniqueStringArray(source.manuallyConfirmedMissionIds),
    programVersionSeen: normalizedProgramVersion,
    programVersionSeenAt: normalizeIsoDate(source.programVersionSeenAt),
    routeVisits: normalizeSignalMap(source.routeVisits),
    updatedAt: normalizeIsoDate(source.updatedAt),
  };
};

export const normalizeGuidanceConfig = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const overridesSource = source.overrides && typeof source.overrides === 'object'
    ? source.overrides
    : {};

  return {
    enabled: source.enabled !== false,
    overrides: {
      disabledMissionIds: uniqueStringArray(overridesSource.disabledMissionIds),
      programOrder: uniqueStringArray(overridesSource.programOrder).length
        ? uniqueStringArray(overridesSource.programOrder)
        : [...DEFAULT_GUIDANCE_CONFIG.overrides.programOrder],
    },
    programVersion: normalizeNumber(source.programVersion, DEFAULT_GUIDANCE_PROGRAM_VERSION),
  };
};

export const pickLatestIsoDate = (left, right) => {
  const normalizedLeft = normalizeIsoDate(left);
  const normalizedRight = normalizeIsoDate(right);

  if (!normalizedLeft) return normalizedRight;
  if (!normalizedRight) return normalizedLeft;

  return new Date(normalizedRight).getTime() >= new Date(normalizedLeft).getTime()
    ? normalizedRight
    : normalizedLeft;
};

const pickLatestValueByTimestamp = (leftValue, leftTimestamp, rightValue, rightTimestamp) => {
  const normalizedLeftTimestamp = normalizeIsoDate(leftTimestamp);
  const normalizedRightTimestamp = normalizeIsoDate(rightTimestamp);

  if (!normalizedRightTimestamp) return leftValue;
  if (!normalizedLeftTimestamp) return rightValue;

  return new Date(normalizedRightTimestamp).getTime() >= new Date(normalizedLeftTimestamp).getTime()
    ? rightValue
    : leftValue;
};

const mergeSignalMaps = (currentSignals, incomingSignals) => {
  const mergedKeys = new Set([
    ...Object.keys(currentSignals || {}),
    ...Object.keys(incomingSignals || {}),
  ]);

  return Array.from(mergedKeys).reduce((accumulator, key) => {
    const nextTimestamp = pickLatestIsoDate(currentSignals?.[key], incomingSignals?.[key]);
    if (nextTimestamp) {
      accumulator[key] = nextTimestamp;
    }
    return accumulator;
  }, {});
};

export const mergeGuidanceState = (currentState, incomingState, programVersion = DEFAULT_GUIDANCE_PROGRAM_VERSION) => {
  const safeCurrentState = normalizeGuidanceState(currentState, programVersion);
  const safeIncomingState = normalizeGuidanceState(incomingState, programVersion);

  const dismissedDockUpdatedAt = pickLatestIsoDate(
    safeCurrentState.dismissedDockUpdatedAt,
    safeIncomingState.dismissedDockUpdatedAt,
  );
  const lastViewedMissionAt = pickLatestIsoDate(
    safeCurrentState.lastViewedMissionAt,
    safeIncomingState.lastViewedMissionAt,
  );
  const programVersionSeenAt = pickLatestIsoDate(
    safeCurrentState.programVersionSeenAt,
    safeIncomingState.programVersionSeenAt,
  );

  return {
    actionSignals: mergeSignalMaps(safeCurrentState.actionSignals, safeIncomingState.actionSignals),
    completedMissionIds: Array.from(new Set([
      ...safeCurrentState.completedMissionIds,
      ...safeIncomingState.completedMissionIds,
    ])),
    completedPackIds: Array.from(new Set([
      ...safeCurrentState.completedPackIds,
      ...safeIncomingState.completedPackIds,
    ])),
    dismissedDockUntil: pickLatestValueByTimestamp(
      safeCurrentState.dismissedDockUntil,
      safeCurrentState.dismissedDockUpdatedAt,
      safeIncomingState.dismissedDockUntil,
      safeIncomingState.dismissedDockUpdatedAt,
    ),
    dismissedDockUpdatedAt,
    interactionSignals: mergeSignalMaps(
      safeCurrentState.interactionSignals,
      safeIncomingState.interactionSignals,
    ),
    lastViewedMissionAt,
    lastViewedMissionId: pickLatestValueByTimestamp(
      safeCurrentState.lastViewedMissionId,
      safeCurrentState.lastViewedMissionAt,
      safeIncomingState.lastViewedMissionId,
      safeIncomingState.lastViewedMissionAt,
    ),
    manuallyConfirmedMissionIds: Array.from(new Set([
      ...safeCurrentState.manuallyConfirmedMissionIds,
      ...safeIncomingState.manuallyConfirmedMissionIds,
    ])),
    programVersionSeen: Math.max(
      safeCurrentState.programVersionSeen,
      safeIncomingState.programVersionSeen,
      normalizeNumber(programVersion, DEFAULT_GUIDANCE_PROGRAM_VERSION),
    ),
    programVersionSeenAt,
    routeVisits: mergeSignalMaps(safeCurrentState.routeVisits, safeIncomingState.routeVisits),
    updatedAt: pickLatestIsoDate(safeCurrentState.updatedAt, safeIncomingState.updatedAt),
  };
};

export const serializeGuidanceState = (value, programVersion = DEFAULT_GUIDANCE_PROGRAM_VERSION) => JSON.stringify(
  normalizeGuidanceState(value, programVersion),
);
