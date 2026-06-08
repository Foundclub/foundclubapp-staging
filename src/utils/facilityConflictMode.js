export const FACILITY_CONFLICT_MODES = Object.freeze({
  ALLOW_AND_NOTIFY: 'allow_and_notify',
  PENDING_VALIDATION: 'pending_validation',
});

/** @type {Set<string>} */
const KNOWN_CONFLICT_MODES = new Set(
  /** @type {string[]} */ (Object.values(FACILITY_CONFLICT_MODES)),
);

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export const normalizeFacilityConflictMode = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return KNOWN_CONFLICT_MODES.has(normalizedValue) ? normalizedValue : null;
};

/**
 * @param {any} facility
 * @returns {string}
 */
export const getFacilityConflictMode = (facility) => (
  normalizeFacilityConflictMode(facility?.capacityConflictMode)
  || FACILITY_CONFLICT_MODES.PENDING_VALIDATION
);

/**
 * @param {any} facility
 * @returns {boolean}
 */
export const facilityConflictRequiresApproval = (facility) => (
  getFacilityConflictMode(facility) === FACILITY_CONFLICT_MODES.PENDING_VALIDATION
);

/**
 * @param {any} facility
 * @returns {boolean}
 */
export const facilityConflictAllowsImmediateConfirmation = (facility) => (
  getFacilityConflictMode(facility) === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY
);
