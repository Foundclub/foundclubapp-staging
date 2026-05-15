/* eslint-disable perfectionist/sort-imports */
import { getAuthTokens } from '@/domains/auth/authUseCases';
import { getApiBaseUrl } from '@/config/runtimeUrls';

import client from '../client';

const unwrap = (/** @type {any} */ response) => response?.data?.data ?? response?.data;
const unwrapFetchJson = async (response) => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      payload?.error?.message
      || payload?.message
      || payload?.error
      || `Request failed with status ${response.status}`,
    );
  }
  return payload?.data?.data ?? payload?.data ?? payload;
};

const appendUploadField = (formData, name, value) => {
  if (value === undefined || value === null || value === '') return;
  formData.append(name, String(value));
};

const normalizePickedFile = (rawFile) => {
  if (!rawFile) return null;
  if (Array.isArray(rawFile)) return normalizePickedFile(rawFile[0]);
  if (rawFile?.assets?.[0]) return normalizePickedFile(rawFile.assets[0]);
  if (typeof File !== 'undefined' && rawFile instanceof File) return rawFile;

  const uri = rawFile.uri || rawFile.fileCopyUri || rawFile.path;
  if (!uri) return null;

  return {
    name: rawFile.name || rawFile.fileName || `cotisation-${Date.now()}`,
    type: rawFile.type || rawFile.mimeType || 'application/octet-stream',
    uri,
  };
};

export const getCurrentLicenseCampaign = async (params = {}) => unwrap(await client.get('/licenses/campaigns/current', { params }));
export const getLicenseCampaigns = async (params = {}) => unwrap(await client.get('/licenses/campaigns', { params }));
export const createLicenseCampaign = async (/** @type {any} */ payload) => unwrap(await client.post('/licenses/campaigns', payload));
export const getLicenseCampaign = async (/** @type {any} */ campaignId) => {
  try {
    return unwrap(await client.get(`/licenses/campaigns/${campaignId}`));
  } catch (error) {
    const dashboard = unwrap(await client.get(`/licenses/campaigns/${campaignId}/dashboard`));
    if (dashboard?.campaign) return dashboard.campaign;
    throw error;
  }
};
export const updateLicenseCampaign = async (/** @type {any} */ campaignId, /** @type {any} */ payload) => unwrap(await client.put(`/licenses/campaigns/${campaignId}`, payload));
export const duplicateLicenseCampaign = async (/** @type {any} */ campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/duplicate`, payload));
export const deleteDraftLicenseCampaign = async (/** @type {any} */ campaignId) => unwrap(await client.delete(`/licenses/campaigns/${campaignId}`));
export const transitionLicenseCampaign = async (/** @type {any} */ campaignId, /** @type {string} */ action, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/${action}`, payload));
export const upsertLicenseDocumentRequest = async (/** @type {any} */ campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/document-requests`, payload));
export const deleteLicenseDocumentRequest = async (/** @type {any} */ documentRequestId) => unwrap(await client.delete(`/licenses/document-requests/${documentRequestId}`));
export const upsertLicensePricingRule = async (/** @type {any} */ campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/pricing-rules`, payload));
export const deleteLicensePricingRule = async (/** @type {any} */ pricingRuleId) => unwrap(await client.delete(`/licenses/pricing-rules/${pricingRuleId}`));
export const generateLicenseAssignments = async (/** @type {any} */ campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/generate-assignments`, payload));
export const getLicenseDashboard = async (/** @type {any} */ campaignId) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/dashboard`));
export const getLicenseAssignments = async (/** @type {any} */ campaignId, params = {}) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/assignments`, { params }));
export const getLicensePaymentReviews = async (/** @type {any} */ campaignId, params = {}) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/payment-reviews`, { params }));
export const getCMLicenseDashboard = async (/** @type {any} */ cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/dashboard`, { params }));
export const getCMLicenseCampaigns = async (/** @type {any} */ cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/campaigns`, { params }));
export const bulkCreateCMLicenseCampaigns = async (/** @type {any} */ cmId, payload = {}) => unwrap(await client.post(`/cm/${cmId}/licenses/campaigns/bulk-create`, payload));
export const bulkGenerateCMLicenseAssignments = async (/** @type {any} */ cmId, payload = {}) => unwrap(await client.post(`/cm/${cmId}/licenses/campaigns/bulk-generate`, payload));
export const getCMLicenseAssignments = async (/** @type {any} */ cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/assignments`, { params }));
export const getCMLicensePaymentReviews = async (/** @type {any} */ cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/payment-reviews`, { params }));
export const getLicenseAssignment = async (/** @type {any} */ assignmentId) => unwrap(await client.get(`/licenses/assignments/${assignmentId}`));
export const updateLicenseAssignmentAmount = async (/** @type {any} */ assignmentId, /** @type {any} */ payload) => unwrap(await client.put(`/licenses/assignments/${assignmentId}/amount`, payload));
export const waiveLicenseAssignment = async (/** @type {any} */ assignmentId, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/waive`, payload));
export const addManualLicensePayment = async (/** @type {any} */ assignmentId, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/payments/manual`, payload));
export const submitLicenseDocument = async (/** @type {any} */ assignmentId, /** @type {any} */ payload = {}) => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('API FoundClub indisponible pour envoyer le document.');

  const file = normalizePickedFile(payload.file || payload.document || payload.proof);
  const formData = new FormData();
  appendUploadField(formData, 'documentRequestId', payload.documentRequestId || payload.requestId);
  appendUploadField(formData, 'comment', payload.comment || payload.memberComment);
  if (file) {
    if (typeof File !== 'undefined' && file instanceof File) {
      formData.append('file', file, file.name || `cotisation-${Date.now()}`);
    } else {
      formData.append('file', /** @type {any} */ ({
        name: file.name,
        type: file.type,
        uri: file.uri,
      }));
    }
  }

  const token = getAuthTokens()?.token;
  const response = await fetch(`${apiBaseUrl}/licenses/assignments/${assignmentId}/documents`, {
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    method: 'POST',
  });

  return unwrapFetchJson(response);
};
export const uploadOfficialLicenseDocument = async (/** @type {any} */ assignmentId, /** @type {any} */ payload = {}) => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('API FoundClub indisponible pour envoyer la licence officielle.');

  const file = normalizePickedFile(payload.file || payload.document || payload.proof);
  const formData = new FormData();
  appendUploadField(formData, 'comment', payload.comment || payload.memberComment);
  if (file) {
    if (typeof File !== 'undefined' && file instanceof File) {
      formData.append('file', file, file.name || `licence-officielle-${Date.now()}`);
    } else {
      formData.append('file', /** @type {any} */ ({
        name: file.name,
        type: file.type,
        uri: file.uri,
      }));
    }
  }

  const token = getAuthTokens()?.token;
  const response = await fetch(`${apiBaseUrl}/licenses/assignments/${assignmentId}/official-license`, {
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    method: 'POST',
  });

  return unwrapFetchJson(response);
};
export const reviewLicenseDocument = async (/** @type {any} */ submissionId, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/documents/${submissionId}/review`, payload));
export const getLicensePaymentStatus = async (/** @type {any} */ paymentId, params = {}) => unwrap(await client.get(`/licenses/payments/${paymentId}/status`, { params }));
export const generateLicenseReceipt = async (/** @type {any} */ paymentId) => unwrap(await client.post(`/licenses/payments/${paymentId}/receipt`));
export const refundLicensePayment = async (/** @type {any} */ paymentId, payload = {}) => unwrap(await client.post(`/licenses/payments/${paymentId}/refunds`, payload));
export const approveExternalLicensePayment = async (/** @type {any} */ paymentId, payload = {}) => unwrap(await client.post(`/licenses/payments/${paymentId}/approve`, payload));
export const rejectExternalLicensePayment = async (/** @type {any} */ paymentId, payload = {}) => unwrap(await client.post(`/licenses/payments/${paymentId}/reject`, payload));
export const sendLicenseReminder = async (/** @type {any} */ assignmentId, payload = {}) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/reminders`, payload));
export const sendBulkLicenseReminder = async (/** @type {any} */ campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/reminders/bulk`, payload));
export const getMyLicenses = async () => unwrap(await client.get('/licenses/me'));
export const getMyLicenseAssignment = async (/** @type {any} */ assignmentId) => unwrap(await client.get(`/licenses/me/${assignmentId}`));
export const getUserCurrentLicense = async (/** @type {any} */ userId) => unwrap(await client.get(`/licenses/users/${userId}/current`));
export const createLicenseCheckout = async (/** @type {any} */ assignmentId, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/me/${assignmentId}/checkout`, payload));
export const declareExternalLicensePayment = async (/** @type {any} */ assignmentId, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/me/${assignmentId}/external-payment-declared`, payload));
export const getPublicLicensePayment = async (/** @type {any} */ token) => unwrap(await client.get(`/licenses/pay/${token}`));
export const createPublicLicenseCheckout = async (/** @type {any} */ token, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/pay/${token}/checkout`, payload));
export const declarePublicExternalLicensePayment = async (/** @type {any} */ token, /** @type {any} */ payload) => unwrap(await client.post(`/licenses/pay/${token}/external-payment-declared`, payload));
export const saveLicenseExternalLink = async (/** @type {any} */ payload) => unwrap(await client.post('/licenses/providers/external-link', payload));
export const connectLicenseHelloAsso = async (/** @type {any} */ payload) => unwrap(await client.post('/licenses/providers/helloasso/connect', payload));
export const connectLicenseStripe = async (/** @type {any} */ payload) => unwrap(await client.post('/licenses/providers/stripe/connect-account', payload));

export const getLicenseExportUrl = (/** @type {any} */ campaignId) => `/licenses/campaigns/${campaignId}/export.csv`;
export const getCMLicenseExportUrl = (/** @type {any} */ cmId, /** @type {Record<string, any>} */ params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') searchParams.append(key, String(value));
  });
  const suffix = searchParams.toString();
  return `/cm/${cmId}/licenses/export.csv${suffix ? `?${suffix}` : ''}`;
};
