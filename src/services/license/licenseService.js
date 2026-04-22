import client from '../client';

const unwrap = (response) => response?.data?.data ?? response?.data;

export const getCurrentLicenseCampaign = async (params = {}) => unwrap(await client.get('/licenses/campaigns/current', { params }));
export const createLicenseCampaign = async (payload) => unwrap(await client.post('/licenses/campaigns', payload));
export const updateLicenseCampaign = async (campaignId, payload) => unwrap(await client.put(`/licenses/campaigns/${campaignId}`, payload));
export const generateLicenseAssignments = async (campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/generate-assignments`, payload));
export const getLicenseDashboard = async (campaignId) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/dashboard`));
export const getLicenseAssignments = async (campaignId, params = {}) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/assignments`, { params }));
export const getLicensePaymentReviews = async (campaignId, params = {}) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/payment-reviews`, { params }));
export const getCMLicenseDashboard = async (cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/dashboard`, { params }));
export const getCMLicenseCampaigns = async (cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/campaigns`, { params }));
export const bulkCreateCMLicenseCampaigns = async (cmId, payload = {}) => unwrap(await client.post(`/cm/${cmId}/licenses/campaigns/bulk-create`, payload));
export const bulkGenerateCMLicenseAssignments = async (cmId, payload = {}) => unwrap(await client.post(`/cm/${cmId}/licenses/campaigns/bulk-generate`, payload));
export const getCMLicenseAssignments = async (cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/assignments`, { params }));
export const getCMLicensePaymentReviews = async (cmId, params = {}) => unwrap(await client.get(`/cm/${cmId}/licenses/payment-reviews`, { params }));
export const getLicenseAssignment = async (assignmentId) => unwrap(await client.get(`/licenses/assignments/${assignmentId}`));
export const updateLicenseAssignmentAmount = async (assignmentId, payload) => unwrap(await client.put(`/licenses/assignments/${assignmentId}/amount`, payload));
export const waiveLicenseAssignment = async (assignmentId, payload) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/waive`, payload));
export const addManualLicensePayment = async (assignmentId, payload) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/payments/manual`, payload));
export const approveExternalLicensePayment = async (paymentId, payload = {}) => unwrap(await client.post(`/licenses/payments/${paymentId}/approve`, payload));
export const rejectExternalLicensePayment = async (paymentId, payload = {}) => unwrap(await client.post(`/licenses/payments/${paymentId}/reject`, payload));
export const sendLicenseReminder = async (assignmentId, payload = {}) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/reminders`, payload));
export const sendBulkLicenseReminder = async (campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/reminders/bulk`, payload));
export const getMyLicenses = async () => unwrap(await client.get('/licenses/me'));
export const getMyLicenseAssignment = async (assignmentId) => unwrap(await client.get(`/licenses/me/${assignmentId}`));
export const createLicenseCheckout = async (assignmentId, payload) => unwrap(await client.post(`/licenses/me/${assignmentId}/checkout`, payload));
export const declareExternalLicensePayment = async (assignmentId, payload) => unwrap(await client.post(`/licenses/me/${assignmentId}/external-payment-declared`, payload));
export const getPublicLicensePayment = async (token) => unwrap(await client.get(`/licenses/pay/${token}`));
export const createPublicLicenseCheckout = async (token, payload) => unwrap(await client.post(`/licenses/pay/${token}/checkout`, payload));
export const declarePublicExternalLicensePayment = async (token, payload) => unwrap(await client.post(`/licenses/pay/${token}/external-payment-declared`, payload));
export const saveLicenseExternalLink = async (payload) => unwrap(await client.post('/licenses/providers/external-link', payload));
export const connectLicenseHelloAsso = async (payload) => unwrap(await client.post('/licenses/providers/helloasso/connect', payload));
export const connectLicenseStripe = async (payload) => unwrap(await client.post('/licenses/providers/stripe/connect-account', payload));

export const getLicenseExportUrl = (campaignId) => `/licenses/campaigns/${campaignId}/export.csv`;
export const getCMLicenseExportUrl = (cmId, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') searchParams.append(key, String(value));
  });
  const suffix = searchParams.toString();
  return `/cm/${cmId}/licenses/export.csv${suffix ? `?${suffix}` : ''}`;
};
