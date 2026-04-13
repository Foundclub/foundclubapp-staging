export const CLUB_UID = 'api::club.club';

export const CLUB_LIST_FIELDS = [
  'documentId',
  'name',
  'email',
  'phoneNumber',
  'address',
  'addressDetails',
  'geohash',
  'isCustomer',
  'isReservationProvider',
  'subscriptionValue',
  'maxTeamNumber',
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

export const normalizeText = (value) => String(value || '').trim();

export const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeRelationArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) {
    return value.data.map((item) => item?.attributes || item).filter(Boolean);
  }
  return [];
};

export const normalizeSingleRelation = (value) => {
  if (!value) return null;
  if (value?.data) return value.data?.attributes || value.data;
  return value;
};

export const getDocumentId = (value) => normalizeText(value?.documentId || value?.id);

export const getAddressObject = (club = {}) => (
  club?.address && typeof club.address === 'object' && !Array.isArray(club.address)
    ? club.address
    : {}
);

export const getClubCity = (club = {}) => {
  const address = getAddressObject(club);
  return normalizeText(
    club?.city
    || address?.city
    || address?.town
    || address?.locality
    || address?.municipality
    || address?.postcode,
  );
};

export const getClubAddressLabel = (club = {}) => {
  const address = getAddressObject(club);
  return normalizeText(
    address?.label
    || address?.description
    || address?.address
    || address?.street
    || club?.addressDetails,
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

export const getClubActivities = (club = {}) => normalizeRelationArray(club?.activites);

export const getClubActivityLabel = (club = {}) => {
  const firstActivity = getClubActivities(club)[0] || null;
  return normalizeText(firstActivity?.name || firstActivity?.label || firstActivity?.title);
};

export const getClubRelationLabel = (value = {}) => normalizeText(
  value?.name
  || value?.title
  || value?.label
  || value?.fullname
  || [value?.firstname, value?.lastname].filter(Boolean).join(' ')
  || value?.email
  || value?.phoneNumber
  || value?.documentId
  || value?.id,
);

export const getClubInitials = (club = {}) => {
  const name = normalizeText(club?.name);
  if (!name) return 'FC';

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const parseJsonObject = (value, fallback = {}) => {
  if (!normalizeText(value)) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
};

export const stringifyJson = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch (_error) {
    return '{}';
  }
};

export const formatJsonPreview = (value, maxLength = 2400) => {
  const serialized = stringifyJson(value);
  if (serialized.length <= maxLength) return serialized;
  return `${serialized.slice(0, maxLength)}\n...`;
};

export const toRelationSet = (value, isMany = false) => {
  const source = Array.isArray(value) ? value : [value];
  const set = source
    .map((item) => {
      const documentId = typeof item === 'string' ? normalizeText(item) : getDocumentId(item);
      return documentId ? { documentId } : null;
    })
    .filter(Boolean);

  return { set: isMany ? set : set.slice(0, 1) };
};

export const buildClubListFilters = ({
  activityDocumentId,
  isCustomer,
  isReservationProvider,
  parentMultisportDocumentId,
} = {}) => {
  const filters = {};

  if (isCustomer === true || isCustomer === false) {
    filters.isCustomer = isCustomer;
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
  const advanced = parseJsonObject(form.addressJson, {});
  return {
    ...advanced,
    address: normalizeText(form.addressLabel) || advanced.address,
    city: normalizeText(form.city) || advanced.city,
    description: normalizeText(form.addressLabel) || advanced.description,
    label: normalizeText(form.addressLabel) || advanced.label,
    lat: normalizeText(form.latitude) ? normalizeNumber(form.latitude, null) : advanced.lat,
    lng: normalizeText(form.longitude) ? normalizeNumber(form.longitude, null) : advanced.lng,
    postcode: normalizeText(form.postcode) || advanced.postcode,
  };
};

export const buildClubWritePayload = (form = {}) => {
  const payload = {
    address: buildAddressFromForm(form),
    addressDetails: normalizeText(form.addressDetails),
    email: normalizeText(form.email),
    geohash: normalizeText(form.geohash),
    isCustomer: Boolean(form.isCustomer),
    isReservationProvider: Boolean(form.isReservationProvider),
    maxTeamNumber: normalizeNumber(form.maxTeamNumber, 0),
    name: normalizeText(form.name),
    phoneNumber: normalizeText(form.phoneNumber),
    sponsor: Array.isArray(form.sponsor) ? form.sponsor : [],
    subscriptionValue: normalizeNumber(form.subscriptionValue, 0),
  };

  if (form.logo) {
    payload.logo = toRelationSet(form.logo, false);
  }

  payload.activites = toRelationSet(form.activites || [], true);
  payload.parentMultisport = form.parentMultisport
    ? toRelationSet(form.parentMultisport, false)
    : { set: [] };

  return payload;
};

export const buildClubFormInitialValues = (club = {}) => {
  const address = getAddressObject(club);
  const coordinates = getClubCoordinates(club);
  return {
    activites: getClubActivities(club),
    addressDetails: normalizeText(club?.addressDetails),
    addressJson: stringifyJson(address),
    addressLabel: getClubAddressLabel(club),
    city: getClubCity(club),
    email: normalizeText(club?.email),
    geohash: normalizeText(club?.geohash),
    isCustomer: Boolean(club?.isCustomer),
    isReservationProvider: Boolean(club?.isReservationProvider),
    latitude: coordinates.lat === null ? '' : String(coordinates.lat),
    logo: normalizeSingleRelation(club?.logo),
    longitude: coordinates.lng === null ? '' : String(coordinates.lng),
    maxTeamNumber: String(club?.maxTeamNumber ?? 0),
    name: normalizeText(club?.name),
    parentMultisport: normalizeSingleRelation(club?.parentMultisport),
    phoneNumber: normalizeText(club?.phoneNumber),
    postcode: normalizeText(address?.postcode || address?.zipCode),
    sponsor: Array.isArray(club?.sponsor) ? club.sponsor : [],
    subscriptionValue: String(club?.subscriptionValue ?? 0),
  };
};
