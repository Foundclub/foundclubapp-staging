import { formatDateWithDayPrefix } from '@/utils/date';
import { getShortAddress, normalizeLocationInput } from '@/utils/location';

const DEFAULT_SINGLE_MARKER_DELTA = 0.016;
const DEFAULT_FALLBACK_REGION = {
  latitude: 43.2965,
  latitudeDelta: 0.12,
  longitude: 5.3698,
  longitudeDelta: 0.08,
};

const toFiniteNumber = (value) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const hasUsableCoordinates = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  // `0,0` is used in legacy event payloads as a placeholder when the address
  // label exists but no real coordinates were resolved. Treat it as missing.
  if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
    return false;
  }

  return true;
};

const extractCoordinatesFromObject = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const latitude = toFiniteNumber(
    value.lat
    ?? value.latitude
    ?? value.location?.lat
    ?? value.location?.latitude
    ?? value.address?.lat
    ?? value.address?.latitude
    ?? value.position?.lat
    ?? value.geometry?.coordinates?.[1],
  );
  const longitude = toFiniteNumber(
    value.lng
    ?? value.lon
    ?? value.longitude
    ?? value.location?.lng
    ?? value.location?.lon
    ?? value.location?.longitude
    ?? value.address?.lng
    ?? value.address?.lon
    ?? value.address?.longitude
    ?? value.position?.lng
    ?? value.position?.lon
    ?? value.geometry?.coordinates?.[0],
  );

  if (!hasUsableCoordinates(latitude, longitude)) {
    return null;
  }

  return { lat: latitude, lng: longitude };
};

const getCoordinatesFromCandidates = (candidates = []) => candidates.reduce((found, candidate) => {
  if (found) {
    return found;
  }

  const directCoordinates = extractCoordinatesFromObject(candidate);
  if (directCoordinates) {
    return directCoordinates;
  }

  const normalizedLocation = normalizeLocationInput(candidate);
  if (
    normalizedLocation
    && hasUsableCoordinates(normalizedLocation.lat, normalizedLocation.lng)
  ) {
    return {
      lat: normalizedLocation.lat,
      lng: normalizedLocation.lng,
    };
  }

  return found;
}, null);

const pickFirstString = (...candidates) => candidates.reduce((found, candidate) => {
  if (found) {
    return found;
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : found;
  }

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return String(candidate);
  }

  if (candidate && typeof candidate === 'object') {
    return pickFirstString(
      candidate.label,
      candidate.name,
      candidate.title,
      candidate.address,
      candidate.city,
      candidate.description,
    );
  }

  return found;
}, '');

const buildActivityBadge = (activities = []) => activities
  .map((activity) => pickFirstString(activity?.name))
  .filter(Boolean)
  .join(', ');

const formatDistanceLabel = (distanceKm) => {
  const parsed = Number(distanceKm);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return '';
  }
  if (parsed < 1) {
    return `${Math.round(parsed * 1000)} m`;
  }
  return `${parsed.toFixed(parsed < 10 ? 1 : 0)} km`;
};

const formatTimeLabel = (startTime, endTime) => {
  const safeStart = pickFirstString(startTime).slice(0, 5);
  const safeEnd = pickFirstString(endTime).slice(0, 5);

  if (safeStart && safeEnd) {
    return `${safeStart} - ${safeEnd}`;
  }

  return safeStart || safeEnd || '';
};

const formatPriceLabel = (pricePerPerson) => {
  if (pricePerPerson === null || pricePerPerson === undefined || pricePerPerson === '') {
    return '';
  }

  const parsed = Number(pricePerPerson);
  if (!Number.isFinite(parsed)) {
    return '';
  }
  if (parsed === 0) {
    return 'Gratuit';
  }
  return `${parsed}€ / pers`;
};

const resolveClubBadge = (club) => {
  if (Reflect.get(club || {}, '_type') === 'multisport') {
    return 'Omnisport';
  }

  return buildActivityBadge(club?.activites) || 'Club';
};

const resolveEventBadge = (item, scope) => {
  if (scope === 'reservations') {
    return buildActivityBadge(item?.team?.activities)
      || pickFirstString(item?.type?.name)
      || 'Réservation';
  }

  return pickFirstString(item?.type?.name)
    || buildActivityBadge(item?.team?.activities)
    || 'Événement';
};

const resolveSubtitle = (item, scope) => {
  if (scope === 'clubs') {
    return getShortAddress(item?.address) || pickFirstString(item?.address?.city, item?.city);
  }

  return (
    pickFirstString(item?.facility?.name)
    || getShortAddress(item?.locationDetails)
    || getShortAddress(item?.location)
    || getShortAddress(item?.facility?.address)
    || getShortAddress(item?.club?.address)
    || getShortAddress(item?.team?.club?.address)
  );
};

const resolveTitle = (item, scope) => {
  if (scope === 'clubs') {
    return pickFirstString(item?.name, item?.title, 'Club');
  }

  if (scope === 'reservations') {
    return pickFirstString(
      item?.team?.club?.name,
      item?.club?.name,
      item?.team?.name,
      item?.title,
      'Réservation',
    );
  }

  return pickFirstString(
    item?.subject,
    item?.team?.club?.name,
    item?.team?.name,
    item?.title,
    item?.type?.name,
    'Événement',
  );
};

const resolveImageUrl = (item, scope) => {
  if (scope === 'clubs') {
    return pickFirstString(item?.logo?.url);
  }

  return pickFirstString(item?.team?.club?.logo?.url, item?.club?.logo?.url);
};

const resolveMapItemId = (item, scope, coordinates) => (
  pickFirstString(item?.documentId, item?.id)
  || `${scope}-${coordinates.lat}-${coordinates.lng}-${resolveTitle(item, scope)}`
);

/**
 * @typedef {'events' | 'clubs' | 'reservations'} SearchMapScope
 */

/**
 * @typedef {{
 *  id: string;
 *  type: SearchMapScope;
 *  lat: number;
 *  lng: number;
 *  title: string;
 *  subtitle: string;
 *  badge: string;
 *  imageUrl: string;
 *  raw: any;
 *  dateLabel: string;
 *  distanceLabel: string;
 *  priceLabel: string;
 *  timeLabel: string;
 * }} SearchMapItem
 */

/**
 * @typedef {{
 *  lat: number;
 *  lng: number;
 *  zoom?: number;
 *  north?: number;
 *  south?: number;
 *  east?: number;
 *  west?: number;
 *  latitudeDelta?: number;
 *  longitudeDelta?: number;
 * }} SearchMapViewport
 */

/**
 * @typedef {{
 *  renderableCount?: number;
 *  markerCount?: number;
 *  clusterCount?: number;
 * }} SearchMapRenderStats
 */

/**
 * @param {any} rawItem
 * @param {SearchMapScope} scope
 * @returns {SearchMapItem | null}
 */
export const toSearchMapItem = (rawItem, scope) => {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }

  const coordinates = getCoordinatesFromCandidates([
    rawItem,
    rawItem?.location,
    rawItem?.address,
    rawItem?.facility?.address,
    rawItem?.team?.club?.address,
    rawItem?.club?.address,
  ]);

  if (!coordinates) {
    return null;
  }

  return {
    badge: scope === 'clubs'
      ? resolveClubBadge(rawItem)
      : resolveEventBadge(rawItem, scope),
    dateLabel: scope === 'clubs' ? '' : formatDateWithDayPrefix(rawItem?.date),
    distanceLabel: formatDistanceLabel(Reflect.get(rawItem || {}, '__search')?.distanceKm),
    id: resolveMapItemId(rawItem, scope, coordinates),
    imageUrl: resolveImageUrl(rawItem, scope),
    lat: coordinates.lat,
    lng: coordinates.lng,
    priceLabel: scope === 'reservations' ? formatPriceLabel(rawItem?.pricePerPerson) : '',
    raw: rawItem,
    subtitle: resolveSubtitle(rawItem, scope),
    timeLabel: scope === 'clubs' ? '' : formatTimeLabel(rawItem?.startTime, rawItem?.endTime),
    title: resolveTitle(rawItem, scope),
    type: scope,
  };
};

/**
 * @param {any[]} rawItems
 * @param {SearchMapScope} scope
 * @returns {SearchMapItem[]}
 */
export const toSearchMapItems = (rawItems, scope) => (Array.isArray(rawItems) ? rawItems : [])
  .map((item) => toSearchMapItem(item, scope))
  .filter(Boolean);

/**
 * @param {SearchMapItem[]} items
 * @returns {{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }}
 */
export const buildSearchMapRegion = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return DEFAULT_FALLBACK_REGION;
  }

  if (items.length === 1) {
    return {
      latitude: items[0].lat,
      latitudeDelta: DEFAULT_SINGLE_MARKER_DELTA,
      longitude: items[0].lng,
      longitudeDelta: DEFAULT_SINGLE_MARKER_DELTA,
    };
  }

  const latitudes = items.map((item) => item.lat);
  const longitudes = items.map((item) => item.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latitudeDelta = Math.max((maxLat - minLat) * 1.4, 0.04);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.4, 0.04);

  return {
    latitude: (minLat + maxLat) / 2,
    latitudeDelta,
    longitude: (minLng + maxLng) / 2,
    longitudeDelta,
  };
};

/**
 * @param {SearchMapScope} scope
 * @returns {string}
 */
export const getSearchMapEmptyMessage = (scope) => {
  switch (scope) {
    case 'clubs':
      return 'Aucun club géolocalisable pour le moment.';
    case 'reservations':
      return 'Aucune réservation géolocalisable pour le moment.';
    case 'events':
    default:
      return 'Aucun événement géolocalisable pour le moment.';
  }
};

/**
 * @param {SearchMapScope} scope
 * @param {number} totalCount
 * @returns {string}
 */
export const getSearchMapNoCoordinatesMessage = (scope, totalCount = 0) => {
  const safeCount = Number.isFinite(totalCount) ? Math.max(0, Number(totalCount)) : 0;

  switch (scope) {
    case 'clubs':
      return safeCount > 0
        ? `${safeCount} club${safeCount > 1 ? 's' : ''} trouvé${safeCount > 1 ? 's' : ''}, mais aucun n'a de position exploitable sur la carte.`
        : 'Aucun club géolocalisable pour le moment.';
    case 'reservations':
      return safeCount > 0
        ? `${safeCount} réservation${safeCount > 1 ? 's' : ''} trouvée${safeCount > 1 ? 's' : ''}, mais aucune n'a de position exploitable sur la carte.`
        : 'Aucune réservation géolocalisable pour le moment.';
    case 'events':
    default:
      return safeCount > 0
        ? `${safeCount} événement${safeCount > 1 ? 's' : ''} trouvé${safeCount > 1 ? 's' : ''}, mais aucun n'a de position exploitable sur la carte.`
        : 'Aucun événement géolocalisable pour le moment.';
  }
};

/**
 * @param {SearchMapScope} scope
 * @param {number} [count]
 * @returns {string}
 */
export const getSearchMapResultLabel = (scope, count = 2) => {
  const isPlural = Number(count) > 1;

  switch (scope) {
    case 'clubs':
      return isPlural ? 'clubs' : 'club';
    case 'reservations':
      return isPlural ? 'réservations' : 'réservation';
    case 'events':
    default:
      return isPlural ? 'événements' : 'événement';
  }
};

export default {
  buildSearchMapRegion,
  getSearchMapEmptyMessage,
  getSearchMapNoCoordinatesMessage,
  getSearchMapResultLabel,
  toSearchMapItem,
  toSearchMapItems,
};
