import client from '@/services/client';

const unwrap = (response) => response?.data ?? response;
const encodeDocumentId = (documentId) => encodeURIComponent(String(documentId || '').trim());

export const getActiveInAppPopupCampaigns = async (params = {}) => {
  const response = await client.get('/in-app-popup-campaigns/active', {
    params,
  });
  return unwrap(response);
};

export const recordInAppPopupImpression = async (documentId) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/impression`);
  return unwrap(response);
};

export const recordInAppPopupDismiss = async (documentId) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/dismiss`);
  return unwrap(response);
};

export const recordInAppPopupAction = async (documentId, data = {}) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/action`, {
    data,
  });
  return unwrap(response);
};

export const listInAppPopupCampaigns = async (params = {}) => {
  const response = await client.get('/in-app-popup-campaigns', {
    params,
  });
  return unwrap(response);
};

export const getInAppPopupCampaign = async (documentId) => {
  const response = await client.get(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}`);
  return unwrap(response);
};

export const createInAppPopupCampaign = async (data) => {
  const response = await client.post('/in-app-popup-campaigns', {
    data,
  });
  return unwrap(response);
};

export const updateInAppPopupCampaign = async (documentId, data) => {
  const response = await client.put(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}`, {
    data,
  });
  return unwrap(response);
};

export const publishInAppPopupCampaign = async (documentId) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/publish`);
  return unwrap(response);
};

export const pauseInAppPopupCampaign = async (documentId) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/pause`);
  return unwrap(response);
};

export const archiveInAppPopupCampaign = async (documentId) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/archive`);
  return unwrap(response);
};

export const duplicateInAppPopupCampaign = async (documentId) => {
  const response = await client.post(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/duplicate`);
  return unwrap(response);
};

export const getInAppPopupCampaignStats = async (documentId) => {
  const response = await client.get(`/in-app-popup-campaigns/${encodeDocumentId(documentId)}/stats`);
  return unwrap(response);
};
