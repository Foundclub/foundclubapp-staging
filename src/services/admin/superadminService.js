import client from '@/services/client';

const encodeUid = (uid) => encodeURIComponent(String(uid || '').trim());
const encodeDocumentId = (documentId) => encodeURIComponent(String(documentId || '').trim());

const unwrap = (response) => response?.data ?? response;

/**
 * @returns {Promise<{data: Array<{uid: string; displayName: string; kind: string}>; meta: {total: number}}>}
 */
export const getSuperadminContentTypes = async () => {
  const response = await client.get('/superadmin/content-types');
  return unwrap(response);
};

/**
 * @param {string} uid
 */
export const getSuperadminContentMetadata = async (uid) => {
  const response = await client.get(`/superadmin/content/${encodeUid(uid)}/metadata`);
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {Record<string, any>} [payload]
 */
export const listSuperadminEntries = async (uid, payload = {}) => {
  const response = await client.post(`/superadmin/content/${encodeUid(uid)}/list`, payload);
  return unwrap(response);
};

/**
 * Set a SuperAdmin user suspension state.
 * @param {string} documentId
 * @param {{ suspended: boolean; reason: string }} payload
 * @returns {Promise<any>}
 */
export const setSuperadminUserSuspension = async (documentId, payload) => {
  const response = await client.post(
    `/superadmin/users/${encodeDocumentId(documentId)}/suspension`,
    {
      data: {
        suspended: payload?.suspended === true,
      },
      reason: payload?.reason,
    },
  );
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {string} documentId
 * @param {Record<string, any>} [params]
 */
export const getSuperadminEntry = async (uid, documentId, params = {}) => {
  const response = await client.get(`/superadmin/content/${encodeUid(uid)}/${encodeDocumentId(documentId)}`, { params });
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {Record<string, any>} data
 * @param {string | undefined} reason
 */
export const createSuperadminEntry = async (uid, data, reason) => {
  const response = await client.post(`/superadmin/content/${encodeUid(uid)}`, {
    data,
    reason: reason || undefined,
  });
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {string} documentId
 * @param {Record<string, any>} data
 * @param {string | undefined} reason
 */
export const updateSuperadminEntry = async (uid, documentId, data, reason) => {
  const response = await client.put(`/superadmin/content/${encodeUid(uid)}/${encodeDocumentId(documentId)}`, {
    data,
    reason: reason || undefined,
  });
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {string} documentId
 * @param {string} reason
 */
export const deleteSuperadminEntry = async (uid, documentId, reason) => {
  const response = await client.delete(`/superadmin/content/${encodeUid(uid)}/${encodeDocumentId(documentId)}`, {
    data: {
      reason,
    },
  });
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {string[]} documentIds
 * @param {string} reason
 */
export const bulkDeleteSuperadminEntries = async (uid, documentIds, reason) => {
  const response = await client.post(`/superadmin/content/${encodeUid(uid)}/bulk`, {
    action: 'delete',
    documentIds,
    reason,
  });
  return unwrap(response);
};

/**
 * @param {string} uid
 * @param {'delete' | 'update' | 'publish' | 'unpublish'} action
 * @param {{ documentIds: string[]; reason: string; data?: Record<string, any> }} payload
 */
export const bulkSuperadminEntries = async (uid, action, payload) => {
  const response = await client.post(`/superadmin/content/${encodeUid(uid)}/bulk`, {
    action,
    data: payload?.data,
    documentIds: payload?.documentIds,
    reason: payload?.reason,
  });
  return unwrap(response);
};

/**
 * @param {string} targetUid
 * @param {Record<string, any>} [payload]
 */
export const searchSuperadminRelations = async (targetUid, payload = {}) => {
  const response = await client.post(`/superadmin/relations/${encodeUid(targetUid)}/search`, payload);
  return unwrap(response);
};
