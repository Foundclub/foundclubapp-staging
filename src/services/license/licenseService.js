import client from '../client';

const unwrap = (response) => response?.data?.data ?? response?.data;

export const getCurrentLicenseCampaign = async (params = {}) => unwrap(await client.get('/licenses/campaigns/current', { params }));
export const createLicenseCampaign = async (payload) => unwrap(await client.post('/licenses/campaigns', payload));
export const updateLicenseCampaign = async (campaignId, payload) => unwrap(await client.put(`/licenses/campaigns/${campaignId}`, payload));
export const generateLicenseAssignments = async (campaignId, payload = {}) => unwrap(await client.post(`/licenses/campaigns/${campaignId}/generate-assignments`, payload));
export const getLicenseDashboard = async (campaignId) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/dashboard`));
export const getLicenseAssignments = async (campaignId, params = {}) => unwrap(await client.get(`/licenses/campaigns/${campaignId}/assignments`, { params }));
export const getLicenseAssignment = async (assignmentId) => unwrap(await client.get(`/licenses/assignments/${assignmentId}`));
export const updateLicenseAssignmentAmount = async (assignmentId, payload) => unwrap(await client.put(`/licenses/assignments/${assignmentId}/amount`, payload));
export const waiveLicenseAssignment = async (assignmentId, payload) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/waive`, payload));
export const addManualLicensePayment = async (assignmentId, payload) => unwrap(await client.post(`/licenses/assignments/${assignmentId}/payments/manual`, payload));
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
