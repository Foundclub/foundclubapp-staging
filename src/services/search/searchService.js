import client from '@/services/client';

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 30;
const MIN_QUERY_LENGTH = 2;

const toStringOrUndefined = (value) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
};

const extractDocumentId = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return toStringOrUndefined(value);
  if (typeof value === 'object') {
    return toStringOrUndefined(value.value || value.documentId || value.id);
  }
  return undefined;
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
};

const normalizeArrayIds = (value) => toArray(value)
  .map((item) => extractDocumentId(item) || toStringOrUndefined(item))
  .filter(Boolean);

const normalizeCategoryOrLevel = (value) => {
  const values = normalizeArrayIds(value);
  return values.length ? values : undefined;
};

const normalizeActivity = (value) => {
  const values = normalizeArrayIds(value);
  if (!values.length) return undefined;
  return values.length === 1 ? values[0] : values;
};

const sanitizeBaseParams = (params = {}) => {
  const q = toStringOrUndefined(params.q);
  if (!q || q.length < MIN_QUERY_LENGTH) {
    return null;
  }

  const page = Number(params.page) || 1;
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(params.pageSize) || DEFAULT_PAGE_SIZE));
  const sort = ['date', 'distance', 'relevance'].includes(params.sort) ? params.sort : 'relevance';

  /** @type {Record<string, any>} */
  const requestParams = {
    page,
    pageSize,
    q,
    sort,
  };

  if (params.lat !== undefined) requestParams.lat = params.lat;
  if (params.lon !== undefined) requestParams.lon = params.lon;
  if (params.radius !== undefined) requestParams.radius = params.radius;
  if (params.debug) requestParams.debug = true;
  return requestParams;
};

const sanitizeOptionalBaseParams = (params = {}) => {
  const q = toStringOrUndefined(params.q);
  const page = Number(params.page) || 1;
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(params.pageSize) || DEFAULT_PAGE_SIZE));
  const sort = ['date', 'distance', 'relevance'].includes(params.sort) ? params.sort : 'relevance';

  /** @type {Record<string, any>} */
  const requestParams = {
    page,
    pageSize,
    sort,
  };

  if (q && q.length >= MIN_QUERY_LENGTH) {
    requestParams.q = q;
  }

  if (params.lat !== undefined) requestParams.lat = params.lat;
  if (params.lon !== undefined) requestParams.lon = params.lon;
  if (params.radius !== undefined) requestParams.radius = params.radius;
  if (params.debug) requestParams.debug = true;
  return requestParams;
};

const sanitizeClubMapBounds = (params = {}) => {
  const north = Number(params.north);
  const south = Number(params.south);
  const east = Number(params.east);
  const west = Number(params.west);
  const zoom = Number(params.zoom);

  if (
    !Number.isFinite(north)
    || !Number.isFinite(south)
    || !Number.isFinite(east)
    || !Number.isFinite(west)
    || !Number.isFinite(zoom)
  ) {
    return null;
  }

  const centerLat = Number.isFinite(Number(params.centerLat))
    ? Number(params.centerLat)
    : (north + south) / 2;
  const centerLon = Number.isFinite(Number(params.centerLon))
    ? Number(params.centerLon)
    : (east + west) / 2;

  return {
    centerLat,
    centerLon,
    east,
    north,
    south,
    west,
    zoom,
  };
};

const cleanParams = (params) => Object.entries(params).reduce((acc, [key, value]) => {
  if (value === undefined || value === null || value === '') return acc;
  if (Array.isArray(value) && value.length === 0) return acc;
  acc[key] = value;
  return acc;
}, {});

const requestSearch = async (path, params = {}, options = {}) => {
  const response = await client.get(path, {
    params: cleanParams(params),
    signal: options.signal,
  });
  return response.data;
};

const emptyResponse = (q = '', page = 1, pageSize = DEFAULT_PAGE_SIZE) => ({
  data: [],
  meta: {
    elapsedMs: 0,
    pagination: {
      page,
      pageCount: 0,
      pageSize,
      total: 0,
    },
    queryNormalized: q?.toLowerCase?.() || '',
  },
});

/**
 * @param {{
 *  q?: string;
 *  page?: number;
 *  pageSize?: number;
 *  sort?: 'relevance' | 'date' | 'distance';
 *  lat?: number;
 *  lon?: number;
 *  radius?: number;
 *  sessionStatus?: string;
 *  type?: string | string[];
 *  excludeType?: string;
 *  teamIds?: string[];
 *  club?: string | { value?: string };
 *  category?: string | string[];
 *  level?: string | string[];
 *  activity?: string | string[];
 *  startDateAfter?: string;
 *  startDateBefore?: string;
 * }} params
 * @param options
 * @returns {Promise<import('@/domains/search/types').SearchResponse>}
 */
export const searchEvents = async (params = {}, options = {}) => {
  const baseParams = sanitizeBaseParams(params);
  if (!baseParams) return emptyResponse(params.q, params.page, params.pageSize);

  return requestSearch('/search/events', {
    ...baseParams,
    activity: normalizeActivity(params.activity),
    category: normalizeCategoryOrLevel(params.category),
    club: extractDocumentId(params.club),
    excludeType: toStringOrUndefined(params.excludeType),
    level: normalizeCategoryOrLevel(params.level),
    sessionStatus: toStringOrUndefined(params.sessionStatus),
    startDateAfter: toStringOrUndefined(params.startDateAfter),
    startDateBefore: toStringOrUndefined(params.startDateBefore),
    teamIds: normalizeArrayIds(params.teamIds),
    type: normalizeArrayIds(params.type),
  }, options);
};

/**
 * @param {{
 *  q?: string;
 *  page?: number;
 *  pageSize?: number;
 *  sort?: 'relevance' | 'date' | 'distance';
 *  lat?: number;
 *  lon?: number;
 *  radius?: number;
 *  activity?: string | string[];
 * }} params
 * @param options
 * @returns {Promise<import('@/domains/search/types').SearchResponse>}
 */
export const searchClubs = async (params = {}, options = {}) => {
  const baseParams = sanitizeBaseParams(params);
  if (!baseParams) return emptyResponse(params.q, params.page, params.pageSize);

  return requestSearch('/search/clubs', {
    ...baseParams,
    activity: normalizeActivity(params.activity),
  }, options);
};

/**
 * @param {{
 *  north?: number;
 *  south?: number;
 *  east?: number;
 *  west?: number;
 *  zoom?: number;
 *  centerLat?: number;
 *  centerLon?: number;
 *  q?: string;
 *  page?: number;
 *  pageSize?: number;
 *  activity?: string | string[];
 *  includeMultisport?: boolean;
 *  view?: 'map' | 'list';
 *  debug?: boolean;
 * }} params
 * @param options
 * @returns {Promise<import('@/domains/search/types').SearchResponse>}
 */
export const searchClubsMap = async (params = {}, options = {}) => {
  const bounds = sanitizeClubMapBounds(params);
  if (!bounds) {
    return emptyResponse(params.q, params.page, params.pageSize);
  }

  const q = toStringOrUndefined(params.q);
  const view = params.view === 'list' ? 'list' : 'map';
  const maxPageSize = view === 'map' ? 1500 : MAX_PAGE_SIZE;
  const defaultPageSize = view === 'map' ? 1500 : DEFAULT_PAGE_SIZE;
  const page = Number(params.page) || 1;
  const pageSize = Math.max(1, Math.min(maxPageSize, Number(params.pageSize) || defaultPageSize));

  return requestSearch('/search/clubs/map', {
    activity: normalizeActivity(params.activity),
    centerLat: bounds.centerLat,
    centerLon: bounds.centerLon,
    debug: Boolean(params.debug),
    east: bounds.east,
    includeMultisport: params.includeMultisport !== false,
    north: bounds.north,
    page,
    pageSize,
    q: q && q.length >= MIN_QUERY_LENGTH ? q : undefined,
    south: bounds.south,
    view,
    west: bounds.west,
    zoom: bounds.zoom,
  }, options);
};

/**
 * @param {{
 *  q?: string;
 *  page?: number;
 *  pageSize?: number;
 *  sort?: 'relevance' | 'date' | 'distance';
 *  lat?: number;
 *  lon?: number;
 *  radius?: number;
 *  reservationMode?: string;
 *  club?: string | { value?: string };
 *  activity?: string | string[];
 *  category?: string | string[];
 *  level?: string | string[];
 *  maxPricePerPerson?: number;
 *  startDateAfter?: string;
 *  startDateBefore?: string;
 * }} params
 * @param options
 * @returns {Promise<import('@/domains/search/types').SearchResponse>}
 */
export const searchReservations = async (params = {}, options = {}) => {
  const baseParams = sanitizeBaseParams(params);
  if (!baseParams) return emptyResponse(params.q, params.page, params.pageSize);

  return requestSearch('/search/reservations', {
    ...baseParams,
    activity: normalizeActivity(params.activity),
    category: normalizeCategoryOrLevel(params.category),
    club: extractDocumentId(params.club),
    level: normalizeCategoryOrLevel(params.level),
    maxPricePerPerson: params.maxPricePerPerson,
    reservationMode: toStringOrUndefined(params.reservationMode),
    startDateAfter: toStringOrUndefined(params.startDateAfter),
    startDateBefore: toStringOrUndefined(params.startDateBefore),
  }, options);
};

/**
 * @param {{
 *  q?: string;
 *  page?: number;
 *  pageSize?: number;
 *  sort?: 'relevance' | 'date' | 'distance';
 *  lat?: number;
 *  lon?: number;
 *  radius?: number;
 *  sport?: string;
 *  audienceType?: string;
 *  coachRole?: string;
 *  city?: string | { value?: string };
 *  section?: string | { value?: string };
 *  category?: string | string[];
 *  level?: string | string[];
 *  position?: string | string[];
 *  includeInactive?: boolean;
 *  authorDocumentId?: string;
 *  teamIds?: string | string[];
 * }} params
 * @param options
 * @returns {Promise<import('@/domains/search/types').SearchResponse>}
 */
export const searchRecruitment = async (params = {}, options = {}) => {
  const baseParams = sanitizeOptionalBaseParams(params);

  return requestSearch('/search/recruitment', {
    ...baseParams,
    audienceType: toStringOrUndefined(params.audienceType),
    authorDocumentId: toStringOrUndefined(params.authorDocumentId),
    category: normalizeCategoryOrLevel(params.category),
    city: extractDocumentId(params.city) || toStringOrUndefined(params.city),
    coachRole: toStringOrUndefined(params.coachRole),
    includeInactive: Boolean(params.includeInactive),
    level: normalizeCategoryOrLevel(params.level),
    position: normalizeCategoryOrLevel(params.position),
    section: extractDocumentId(params.section) || toStringOrUndefined(params.section),
    sport: toStringOrUndefined(params.sport),
    teamIds: normalizeArrayIds(params.teamIds),
  }, options);
};

/**
 * @param {({
 *  q?: string;
 *  page?: number;
 *  pageSize?: number;
 *  sort?: 'relevance' | 'date' | 'distance';
 *  lat?: number;
 *  lon?: number;
 *  radius?: number;
 *  activity?: string | string[];
 *  activityNames?: string | string[];
 *  category?: string | string[];
 *  sectionIds?: string | string[];
 *  position?: string | string[];
 *  geohash?: string;
 * })} params
 * @param options
 * @returns {Promise<import('@/domains/search/types').SearchResponse>}
 */
export const searchProfiles = async (params = {}, options = {}) => {
  const baseParams = sanitizeOptionalBaseParams(params);

  return requestSearch('/search/profiles', {
    ...baseParams,
    activity: normalizeActivity(params.activityNames || params.activity),
    category: normalizeCategoryOrLevel(params.sectionIds || params.category),
    geohash: toStringOrUndefined(params.geohash),
    position: normalizeCategoryOrLevel(params.position),
  }, options);
};

/**
 * @param {import('@/domains/search/types').SearchResponse | undefined} searchResponse
 * @returns {any[]}
 */
export const mapSearchPayload = (searchResponse) => (searchResponse?.data || []).map((entry) => ({
  ...entry.payload,
  __search: {
    distanceKm: entry.distanceKm,
    highlights: entry.highlights,
    matchReasons: entry.matchReasons || [],
    score: entry.score,
  },
}));

/**
 * @param {import('@/domains/search/types').SearchMatchReason | undefined} reason
 */
export const getMatchReasonLabel = (reason) => {
  switch (reason) {
    case 'ACTIVITY_MATCH':
      return 'Correspond à l\'activité';
    case 'CITY_MATCH':
      return 'Correspond à la ville';
    case 'CLUB_MATCH':
      return 'Correspond au club';
    case 'DESCRIPTION_MATCH':
      return 'Correspond à la description';
    case 'GEO_NEARBY':
      return 'A proximite';
    case 'LOCATION_FUZZY':
      return 'Lieu proche de la recherche';
    case 'LOCATION_MATCH':
      return 'Correspond au lieu';
    case 'NAME_EXACT':
      return 'Correspondance exacte du nom';
    case 'NAME_FUZZY':
      return 'Nom proche de la recherche';
    case 'NAME_PREFIX':
      return 'Correspondance du nom';
    case 'TEAM_MATCH':
      return 'Correspond à l équipe';
    default:
      return '';
  }
};
