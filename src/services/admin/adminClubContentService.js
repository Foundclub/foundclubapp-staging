import { launchImageLibrary } from 'react-native-image-picker';

import client from '@/services/client';

import {
  buildClubListFilters,
  CLUB_DETAIL_POPULATE,
  CLUB_LIST_FIELDS,
  CLUB_UID,
  normalizeText,
} from './adminClubContentModel';
import {
  bulkSuperadminEntries,
  createSuperadminEntry,
  deleteSuperadminEntry,
  getSuperadminContentMetadata,
  getSuperadminEntry,
  listSuperadminEntries,
  searchSuperadminRelations,
  updateSuperadminEntry,
} from './superadminService';

const SORTS = {
  alpha: ['name:asc'],
  created: ['createdAt:desc'],
  customer: ['clubPartner:desc', 'name:asc'],
  partner: ['clubPartner:desc', 'name:asc'],
  updated: ['updatedAt:desc'],
};

const CLUB_LIST_POPULATE = {
  activites: {
    fields: ['documentId', 'name'],
  },
  logo: {
    fields: ['alternativeText', 'formats', 'url'],
  },
  parentMultisport: {
    fields: ['documentId', 'name'],
  },
};

const filterClubsClientSide = (items = [], params = {}) => {
  const city = normalizeText(params.city).toLowerCase();
  if (!city) return items;

  return items.filter((club) => {
    const address = club?.address && typeof club.address === 'object' ? club.address : {};
    const haystack = [
      club?.city,
      address?.city,
      address?.town,
      address?.locality,
      address?.municipality,
      address?.postcode,
      club?.addressDetails,
    ].join(' ').toLowerCase();
    return haystack.includes(city);
  });
};

export const listAdminClubContent = async (params = {}) => {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const response = await listSuperadminEntries(CLUB_UID, {
    fields: CLUB_LIST_FIELDS,
    filters: buildClubListFilters(params),
    pagination: { page, pageSize },
    populate: CLUB_LIST_POPULATE,
    q: normalizeText(params.q) || undefined,
    sort: SORTS[params.sortMode] || SORTS.updated,
  });

  return {
    ...response,
    data: filterClubsClientSide(response?.data || [], params),
  };
};

export const getAdminClubContent = async (documentId) => getSuperadminEntry(CLUB_UID, documentId, {
  populate: CLUB_DETAIL_POPULATE,
});

export const getAdminClubMetadata = async () => getSuperadminContentMetadata(CLUB_UID);

export const createAdminClubContent = async ({ data, reason }) => createSuperadminEntry(CLUB_UID, data, reason);

export const updateAdminClubContent = async ({ data, documentId, reason }) => (
  updateSuperadminEntry(CLUB_UID, documentId, data, reason)
);

export const deleteAdminClubContent = async ({ documentId, reason }) => deleteSuperadminEntry(CLUB_UID, documentId, reason);

export const bulkDeleteAdminClubContent = async ({ documentIds, reason }) => (
  bulkSuperadminEntries(CLUB_UID, 'delete', { documentIds, reason })
);

export const bulkUpdateAdminClubContent = async ({ data, documentIds, reason }) => (
  bulkSuperadminEntries(CLUB_UID, 'update', { data, documentIds, reason })
);

export const searchAdminClubRelations = async (targetUid, payload = {}) => searchSuperadminRelations(targetUid, payload);

export const updateAdminClubRelation = async ({
  action,
  documentId,
  field,
  reason,
  targetDocumentId,
}) => {
  const operation = action === 'disconnect' ? 'disconnect' : 'connect';
  return updateAdminClubContent({
    data: {
      [field]: {
        [operation]: [{ documentId: targetDocumentId }],
      },
    },
    documentId,
    reason,
  });
};

export const replaceAdminClubRelation = async ({
  documentId,
  field,
  isMany = true,
  reason,
  targetDocumentIds,
}) => updateAdminClubContent({
  data: {
    [field]: {
      set: (Array.isArray(targetDocumentIds) ? targetDocumentIds : [targetDocumentIds])
        .filter(Boolean)
        .map((targetDocumentId) => ({ documentId: targetDocumentId }))
        .slice(0, isMany ? undefined : 1),
    },
  },
  documentId,
  reason,
});

export const pickAndUploadAdminClubLogo = async () => {
  const pickerResponse = await launchImageLibrary({
    includeBase64: false,
    mediaType: 'photo',
    quality: 0.85,
    selectionLimit: 1,
  });

  if (pickerResponse?.didCancel) return null;
  if (pickerResponse?.errorCode) {
    throw new Error(pickerResponse?.errorMessage || 'Impossible d\'ouvrir la galerie.');
  }

  const asset = pickerResponse?.assets?.[0];
  if (!asset?.uri) return null;

  const mime = normalizeText(asset.type) || 'image/jpeg';
  const extension = mime.includes('/') ? (mime.split('/')[1] || 'jpg') : 'jpg';
  const fileName = normalizeText(asset.fileName || asset.name) || `club-logo-${Date.now()}.${extension}`;
  const formData = new FormData();
  formData.append('files', /** @type {any} */ ({
    name: fileName,
    type: mime,
    uri: asset.uri,
  }));

  const uploadResponse = await client.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  const files = Array.isArray(uploadResponse?.data) ? uploadResponse.data : [];
  return files[0] || null;
};

export { CLUB_UID };
