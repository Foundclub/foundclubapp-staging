export const CLUB_UID = 'api::club.club';

export const CLUB_LIST_FIELDS = [
  'documentId',
  'name',
  'email',
  'phoneNumber',
  'address',
  'addressDetails',
  'clubPartner',
  'clubVerified',
  'geohash',
  'isReservationProvider',
  'createdAt',
  'updatedAt',
];

export const CLUB_DETAIL_POPULATE = [
  'logo',
  'activites',
  'parentMultisport',
  'members',
  'members.avatar',
  'teams',
  'clubMembershipRequests',
  'evenements',
  'facilities',
  'sponsor',
  'sponsor.logo',
];

export const CLUB_TABS = [
  { key: 'overview', label: 'Vue d\'ensemble' },
  { key: 'info', label: 'Informations' },
  { key: 'relations', label: 'Relations' },
  { key: 'media', label: 'M\u00E9dias' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'geo', label: 'G\u00E9olocalisation' },
  { key: 'requests', label: 'Demandes' },
  { key: 'history', label: 'Historique' },
  { key: 'danger', label: 'Danger zone' },
];

/** @typedef {Record<string, any>} AdminClubRecord */

export const normalizeText = (/** @type {any} */ value) => String(value || '').trim();

export const normalizeNumber = (/** @type {any} */ value, /** @type {number | null} */ fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeRelationArray = (/** @type {any} */ value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) {
    return value.data.map((/** @type {any} */ item) => item?.attributes || item).filter(Boolean);
  }
  return [];
};

export const normalizeSingleRelation = (/** @type {any} */ value) => {
  if (!value) return null;
  if (value?.data) return value.data?.attributes || value.data;
  return value;
};

export const getDocumentId = (/** @type {any} */ value) => normalizeText(value?.documentId || value?.id);

export const getAddressObject = (club = {}) => (
  /** @type {AdminClubRecord} */ (club)?.address
  && typeof /** @type {AdminClubRecord} */ (club).address === 'object'
  && !Array.isArray(/** @type {AdminClubRecord} */ (club).address)
    ? /** @type {AdminClubRecord} */ (club).address
    : {}
);

export const getClubCity = (club = {}) => {
  const typedClub = /** @type {AdminClubRecord} */ (club);
  const address = getAddressObject(club);
  return normalizeText(
    typedClub?.city
    || address?.city
    || address?.town
    || address?.locality
    || address?.municipality
    || address?.postcode,
  );
};

export const getClubAddressLabel = (club = {}) => {
  const typedClub = /** @type {AdminClubRecord} */ (club);
  const address = getAddressObject(club);
  return normalizeText(
    address?.label
    || address?.description
    || address?.address
    || address?.street
    || typedClub?.addressDetails,
  );
};

export const getClubCoordinates = (club = {}) => {
  const address = getAddressObject(club);
  const lat = normalizeNumber(
    address?.lat
    || address?.latitude
    || address?.coordinates?.lat
    || address?.coordinates?.latitude,
    null,
  );
  const lng = normalizeNumber(
    address?.lng
    || address?.lon
    || address?.longitude
    || address?.coordinates?.lng
    || address?.coordinates?.lon
    || address?.coordinates?.longitude,
    null,
  );
  return { lat, lng };
};

export const getClubActivities = (club = {}) => normalizeRelationArray(
  /** @type {AdminClubRecord} */ (club)?.activites,
);

export const getClubActivityLabel = (club = {}) => {
  const firstActivity = getClubActivities(club)[0] || null;
  return normalizeText(firstActivity?.name || firstActivity?.label || firstActivity?.title);
};

export const getClubRelationLabel = (value = {}) => {
  const typedValue = /** @type {AdminClubRecord} */ (value);
  return normalizeText(
    typedValue?.name
    || typedValue?.title
    || typedValue?.label
    || typedValue?.fullname
    || [typedValue?.firstname, typedValue?.lastname].filter(Boolean).join(' ')
    || typedValue?.email
    || typedValue?.phoneNumber
    || typedValue?.documentId
    || typedValue?.id,
  );
};

export const getClubInitials = (club = {}) => {
  const typedClub = /** @type {AdminClubRecord} */ (club);
  const name = normalizeText(typedClub?.name);
  if (!name) return 'FC';

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const parseJsonObject = (/** @type {any} */ value, /** @type {AdminClubRecord} */ fallback = {}) => {
  if (!normalizeText(value)) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
};

export const stringifyJson = (/** @type {any} */ value) => {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch (_error) {
    return '{}';
  }
};

export const formatJsonPreview = (/** @type {any} */ value, /** @type {number} */ maxLength = 2400) => {
  const serialized = stringifyJson(value);
  if (serialized.length <= maxLength) return serialized;
  return `${serialized.slice(0, maxLength)}\n...`;
};

export const toRelationSet = (/** @type {any} */ value, /** @type {boolean} */ isMany = false) => {
  const source = Array.isArray(value) ? value : [value];
  const set = source
    .map((/** @type {any} */ item) => {
      const documentId = typeof item === 'string' ? normalizeText(item) : getDocumentId(item);
      return documentId ? { documentId } : null;
    })
    .filter(Boolean);

  return { set: isMany ? set : set.slice(0, 1) };
};

export const buildClubListFilters = (params = {}) => {
  const {
    activityDocumentId,
    clubPartner,
    isReservationProvider,
    parentMultisportDocumentId,
  } = /** @type {AdminClubRecord} */ (params);
  const filters = /** @type {AdminClubRecord} */ ({});

  if (clubPartner === true || clubPartner === false) {
    filters.clubPartner = clubPartner;
  }

  if (isReservationProvider === true || isReservationProvider === false) {
    filters.isReservationProvider = isReservationProvider;
  }

  if (activityDocumentId) {
    filters.activites = { documentId: activityDocumentId };
  }

  if (parentMultisportDocumentId) {
    filters.parentMultisport = { documentId: parentMultisportDocumentId };
  }

  return filters;
};

export const buildAddressFromForm = (form = {}) => {
  const typedForm = /** @type {AdminClubRecord} */ (form);
  const advanced = parseJsonObject(typedForm.addressJson, {});
  return {
    ...advanced,
    address: normalizeText(typedForm.addressLabel) || advanced.address,
    city: normalizeText(typedForm.city) || advanced.city,
    description: normalizeText(typedForm.addressLabel) || advanced.description,
    label: normalizeText(typedForm.addressLabel) || advanced.label,
    lat: normalizeText(typedForm.latitude) ? normalizeNumber(typedForm.latitude, null) : advanced.lat,
    lng: normalizeText(typedForm.longitude) ? normalizeNumber(typedForm.longitude, null) : advanced.lng,
    postcode: normalizeText(typedForm.postcode) || advanced.postcode,
  };
};

export const buildClubWritePayload = (form = {}) => {
  const typedForm = /** @type {AdminClubRecord} */ (form);
  const clubPartner = Boolean(typedForm.clubPartner);
  const payload = /** @type {AdminClubRecord} */ ({
    address: buildAddressFromForm(form),
    addressDetails: normalizeText(typedForm.addressDetails),
    clubPartner,
    clubVerified: Boolean(typedForm.clubVerified),
    email: normalizeText(typedForm.email),
    geohash: normalizeText(typedForm.geohash),
    isCustomer: clubPartner,
    isReservationProvider: Boolean(typedForm.isReservationProvider),
    name: normalizeText(typedForm.name),
    phoneNumber: normalizeText(typedForm.phoneNumber),
    sponsor: Array.isArray(typedForm.sponsor) ? typedForm.sponsor : [],
  });

  if (typedForm.logo) {
    payload.logo = toRelationSet(typedForm.logo, false);
  }

  payload.activites = toRelationSet(typedForm.activites || [], true);
  payload.parentMultisport = typedForm.parentMultisport
    ? toRelationSet(typedForm.parentMultisport, false)
    : { set: [] };

  return payload;
};

export const buildClubFormInitialValues = (club = {}) => {
  const typedClub = /** @type {AdminClubRecord} */ (club);
  const address = getAddressObject(club);
  const coordinates = getClubCoordinates(club);
  return {
    activites: getClubActivities(club),
    addressDetails: normalizeText(typedClub?.addressDetails),
    addressJson: stringifyJson(address),
    addressLabel: getClubAddressLabel(club),
    city: getClubCity(club),
    clubPartner: typedClub?.clubPartner === true || typedClub?.isCustomer === true,
    clubVerified: typedClub?.clubVerified === true,
    email: normalizeText(typedClub?.email),
    geohash: normalizeText(typedClub?.geohash),
    isReservationProvider: Boolean(typedClub?.isReservationProvider),
    latitude: coordinates.lat === null ? '' : String(coordinates.lat),
    logo: normalizeSingleRelation(typedClub?.logo),
    longitude: coordinates.lng === null ? '' : String(coordinates.lng),
    name: normalizeText(typedClub?.name),
    parentMultisport: normalizeSingleRelation(typedClub?.parentMultisport),
    phoneNumber: normalizeText(typedClub?.phoneNumber),
    postcode: normalizeText(address?.postcode || address?.zipCode),
    sponsor: Array.isArray(typedClub?.sponsor) ? typedClub.sponsor : [],
  };
};
