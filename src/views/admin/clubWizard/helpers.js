// @ts-nocheck
import { getGeohashForPointAndRadius } from '@/domains/places/placesUseCases';

import { normalizeText } from '@/services/admin/adminClubContentModel';

export const MULTISPORT_TARGET_UID = 'api::multisport-club.multisport-club';

export const isValidOptionalEmail = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();
  if (!normalizedValue) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue);
};

export const hasInvalidSponsorRows = (rows = []) => (
  (Array.isArray(rows) ? rows : []).some((row) => {
    const title = normalizeText(row?.title);
    const link = normalizeText(row?.link);
    return Boolean((title || link) && !title);
  })
);

export const sanitizeSponsorRows = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      link: normalizeText(row?.link),
      title: normalizeText(row?.title),
    }))
    .filter((row) => row.title || row.link)
);

export const buildAddressSelectionPatch = (addressOption) => {
  if (!addressOption) {
    return {
      addressJson: '{}',
      addressLabel: '',
      city: '',
      geohash: '',
      latitude: '',
      longitude: '',
      postcode: '',
    };
  }

  const lat = Number.isFinite(addressOption?.lat) ? addressOption.lat : null;
  const lng = Number.isFinite(addressOption?.lng) ? addressOption.lng : null;
  const geohash = lat !== null && lng !== null
    ? getGeohashForPointAndRadius(lat, lng, 0.001)
    : '';
  const addressPayload = {
    address: normalizeText(addressOption?.label),
    bbox: addressOption?.bbox || null,
    city: normalizeText(addressOption?.city),
    context: normalizeText(addressOption?.context),
    description: normalizeText(addressOption?.label),
    label: normalizeText(addressOption?.label),
    lat,
    lng,
    postcode: normalizeText(addressOption?.postcode),
    provider: normalizeText(addressOption?.provider),
    providerId: addressOption?.providerId || null,
    type: normalizeText(addressOption?.type),
    value: normalizeText(addressOption?.value),
  };

  return {
    addressJson: JSON.stringify(addressPayload, null, 2),
    addressLabel: normalizeText(addressOption?.label),
    city: normalizeText(addressOption?.city),
    geohash,
    latitude: lat === null ? '' : String(lat),
    longitude: lng === null ? '' : String(lng),
    postcode: normalizeText(addressOption?.postcode),
  };
};
