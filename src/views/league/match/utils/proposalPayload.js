const PROPOSAL_LABEL_KEYS = [
  'label',
  'address',
  'venue',
  'name',
  'description',
  'fallback_label',
  'formattedAddress',
  'formatted_address',
  'city',
];

const PROPOSAL_NESTED_LABEL_KEYS = [
  'address',
  'properties',
  'place',
  'details',
];

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
const isObjectRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const SAFE_LOCATION_SCALAR_KEYS = [
  'address',
  'addressCity',
  'city',
  'country',
  'fallback_label',
  'formattedAddress',
  'formatted_address',
  'label',
  'name',
  'postalCode',
  'postcode',
  'street',
  'venue',
];

const readFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readNestedNumber = (source, paths) => {
  if (!isObjectRecord(source)) return null;

  const path = paths.find((segments) => {
    const value = segments.reduce(
      (current, segment) => (isObjectRecord(current) ? current[segment] : undefined),
      source,
    );
    return readFiniteNumber(value) !== null;
  });

  if (!path) return null;

  const value = path.reduce(
    (current, segment) => (isObjectRecord(current) ? current[segment] : undefined),
    source,
  );
  return readFiniteNumber(value);
};

const buildSafeLocationObject = (source, label) => {
  const result = {};
  if (isObjectRecord(source)) {
    SAFE_LOCATION_SCALAR_KEYS.forEach((key) => {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        result[key] = value.trim();
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        result[key] = value;
      }
    });

    const latitude = readNestedNumber(source, [
      ['latitude'],
      ['lat'],
      ['geometry', 'latitude'],
      ['geometry', 'lat'],
      ['geometry', 'location', 'lat'],
      ['location', 'lat'],
      ['position', 'lat'],
    ]);
    const longitude = readNestedNumber(source, [
      ['longitude'],
      ['lon'],
      ['lng'],
      ['geometry', 'longitude'],
      ['geometry', 'lon'],
      ['geometry', 'lng'],
      ['geometry', 'location', 'lng'],
      ['geometry', 'location', 'lon'],
      ['location', 'lng'],
      ['location', 'lon'],
      ['position', 'lng'],
      ['position', 'lon'],
    ]);

    if (latitude !== null) result.latitude = latitude;
    if (longitude !== null) result.longitude = longitude;
  }

  if (label) {
    result.address = label;
    result.fallback_label = label;
    result.label = label;
  }

  return result;
};

/**
 * Extract a safe display label from address/autocomplete payloads.
 * Some providers return objects like { description, geometry }; these must never
 * be rendered directly in React Native Text or sent as venue labels.
 * @param {unknown} value
 * @param {Set<unknown>} [seen]
 * @returns {string}
 */
export const getProposalLocationLabel = (value, seen = new Set()) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (!isObjectRecord(value) || seen.has(value)) return '';

  seen.add(value);

  const directLabel = PROPOSAL_LABEL_KEYS
    .map((key) => value[key])
    .find((nestedValue) => typeof nestedValue === 'string' && nestedValue.trim());
  if (typeof directLabel === 'string') return directLabel.trim();

  return PROPOSAL_NESTED_LABEL_KEYS
    .map((key) => getProposalLocationLabel(value[key], seen))
    .find(Boolean) || '';
};

/**
 * @param {any} proposalData
 * @returns {Record<string, any>}
 */
const buildProposalAddressObject = (proposalData) => {
  let source = null;
  if (isObjectRecord(proposalData?.addressObject)) {
    source = proposalData.addressObject;
  } else if (isObjectRecord(proposalData?.address)) {
    source = proposalData.address;
  } else if (isObjectRecord(proposalData?.venue)) {
    source = proposalData.venue;
  }
  const label = getProposalLocationLabel(proposalData?.address)
    || getProposalLocationLabel(proposalData?.addressObject)
    || getProposalLocationLabel(proposalData?.venue);

  return buildSafeLocationObject(source, label);
};

/**
 * Build the canonical workflow API payload expected by /league-matches/:id/proposals.
 * @param {any} proposalData
 * @returns {{addressLabel: string, addressObject: Record<string, any>, startAt: string | undefined, venueLabel: string}}
 */
export const buildCanonicalLeagueProposalPayload = (proposalData) => {
  const venueLabel = getProposalLocationLabel(proposalData?.venue)
    || getProposalLocationLabel(proposalData?.address)
    || getProposalLocationLabel(proposalData?.addressObject);
  const addressLabel = getProposalLocationLabel(proposalData?.address)
    || getProposalLocationLabel(proposalData?.addressObject)
    || venueLabel;

  return {
    addressLabel,
    addressObject: buildProposalAddressObject(proposalData),
    startAt: proposalData?.date,
    venueLabel,
  };
};

/**
 * @param {string | null | undefined} matchId
 * @param {any} proposalData
 * @param {Record<string, any>} [existingLocation]
 * @returns {{
 *   matchUpdate: {
 *     location: Record<string, any>;
 *     proposed_time: string;
 *     proposed_venue: string;
 *   };
 *   message: {
 *     composition: Record<string, any>;
 *     message: string;
 *   };
 * }}
 */
export const buildLeagueProposalPayload = (matchId, proposalData, existingLocation = {}) => {
  const proposalStartDate = new Date(proposalData.date);
  const proposalEndDate = proposalData.endDate
    ? new Date(proposalData.endDate)
    : new Date(proposalStartDate.getTime() + (60 * 60 * 1000));
  const canonicalPayload = buildCanonicalLeagueProposalPayload(proposalData);
  const { addressLabel, venueLabel } = canonicalPayload;

  const nextLocation = {
    ...(existingLocation && typeof existingLocation === 'object' ? existingLocation : {}),
    ...canonicalPayload.addressObject,
    ...(addressLabel ? { address: addressLabel, label: addressLabel } : {}),
    proposed_end_time: proposalEndDate.toISOString(),
  };

  return {
    matchUpdate: {
      location: nextLocation,
      proposed_time: proposalStartDate.toISOString(),
      proposed_venue: venueLabel,
    },
    message: {
      composition: {
        address: addressLabel,
        addressObject: nextLocation,
        date: proposalStartDate.toISOString(),
        endDate: proposalEndDate.toISOString(),
        matchId: matchId || '',
        status: 'pending',
        type: 'proposal',
        venue: venueLabel,
      },
      message: 'Nouvelle proposition de match',
    },
  };
};
