import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addManualLicensePayment,
  approveExternalLicensePayment,
  bulkCreateCMLicenseCampaigns,
  bulkGenerateCMLicenseAssignments,
  createLicenseCampaign,
  createLicenseCheckout,
  declareExternalLicensePayment,
  deleteDraftLicenseCampaign,
  deleteLicenseDocumentRequest,
  deleteLicensePricingRule,
  duplicateLicenseCampaign,
  generateLicenseAssignments,
  generateLicenseReceipt,
  getCMLicenseAssignments,
  getCMLicenseCampaigns,
  getCMLicenseDashboard,
  getCMLicensePaymentReviews,
  getCurrentLicenseCampaign,
  getLicenseAssignment,
  getLicenseAssignments,
  getLicenseCampaign,
  getLicenseCampaigns,
  getLicenseDashboard,
  getLicensePaymentReviews,
  getLicensePaymentStatus,
  getMyLicenseAssignment,
  getMyLicenses,
  refundLicensePayment,
  rejectExternalLicensePayment,
  reviewLicenseDocument,
  sendBulkLicenseReminder,
  sendLicenseReminder,
  submitLicenseDocument,
  transitionLicenseCampaign,
  updateLicenseAssignmentAmount,
  updateLicenseCampaign,
  upsertLicenseDocumentRequest,
  upsertLicensePricingRule,
  waiveLicenseAssignment,
} from './licenseService';

export const licenseKeys = {
  all: ['licenses'],
  assignment: (/** @type {any} */ assignmentId) => ['licenses', 'assignment', assignmentId],
  assignments: (/** @type {any} */ campaignId, /** @type {any} */ params) => ['licenses', 'campaign', campaignId, 'assignments', params],
  campaign: (/** @type {any} */ campaignId) => ['licenses', 'campaign', campaignId],
  campaigns: (/** @type {any} */ params) => ['licenses', 'campaigns', params],
  cmAssignments: (/** @type {any} */ cmId, /** @type {any} */ params) => ['licenses', 'cm', cmId, 'assignments', params],
  cmCampaigns: (/** @type {any} */ cmId, /** @type {any} */ params) => ['licenses', 'cm', cmId, 'campaigns', params],
  cmDashboard: (/** @type {any} */ cmId, /** @type {any} */ params) => ['licenses', 'cm', cmId, 'dashboard', params],
  cmPaymentReviews: (/** @type {any} */ cmId, /** @type {any} */ params) => ['licenses', 'cm', cmId, 'payment-reviews', params],
  currentCampaign: (/** @type {any} */ params) => ['licenses', 'campaign', 'current', params],
  dashboard: (/** @type {any} */ campaignId) => ['licenses', 'campaign', campaignId, 'dashboard'],
  mine: ['licenses', 'mine'],
  mineAssignment: (/** @type {any} */ assignmentId) => ['licenses', 'mine', assignmentId],
  paymentReviews: (/** @type {any} */ campaignId, /** @type {any} */ params) => ['licenses', 'campaign', campaignId, 'payment-reviews', params],
  paymentStatus: (/** @type {any} */ paymentId) => ['licenses', 'payment', paymentId, 'status'],
};

export const useCurrentLicenseCampaign = (params = {}, options = {}) => useQuery({
  queryFn: () => getCurrentLicenseCampaign(params),
  queryKey: licenseKeys.currentCampaign(params),
  staleTime: 30_000,
  ...options,
});

export const useLicenseCampaign = (/** @type {any} */ campaignId, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(campaignId) && (options.enabled ?? true),
  queryFn: () => getLicenseCampaign(campaignId),
  queryKey: licenseKeys.campaign(campaignId),
  staleTime: 30_000,
  ...options,
});

export const useLicenseCampaigns = (params = {}, options = {}) => useQuery({
  enabled: options.enabled ?? true,
  queryFn: () => getLicenseCampaigns(params),
  queryKey: licenseKeys.campaigns(params),
  staleTime: 20_000,
  ...options,
});

export const useLicensePaymentStatus = (/** @type {any} */ paymentId, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(paymentId) && (options.enabled ?? true),
  queryFn: () => getLicensePaymentStatus(paymentId),
  queryKey: licenseKeys.paymentStatus(paymentId),
  staleTime: 10_000,
  ...options,
});

export const useLicenseDashboard = (/** @type {any} */ campaignId, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(campaignId) && (options.enabled ?? true),
  queryFn: () => getLicenseDashboard(campaignId),
  queryKey: licenseKeys.dashboard(campaignId),
  staleTime: 20_000,
  ...options,
});

export const useLicenseAssignments = (/** @type {any} */ campaignId, params = {}, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(campaignId) && (options.enabled ?? true),
  queryFn: () => getLicenseAssignments(campaignId, params),
  queryKey: licenseKeys.assignments(campaignId, params),
  staleTime: 20_000,
  ...options,
});

export const useLicensePaymentReviews = (/** @type {any} */ campaignId, params = {}, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(campaignId) && (options.enabled ?? true),
  queryFn: () => getLicensePaymentReviews(campaignId, params),
  queryKey: licenseKeys.paymentReviews(campaignId, params),
  staleTime: 20_000,
  ...options,
});

export const useCMLicenseDashboard = (/** @type {any} */ cmId, params = {}, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(cmId) && (options.enabled ?? true),
  queryFn: () => getCMLicenseDashboard(cmId, params),
  queryKey: licenseKeys.cmDashboard(cmId, params),
  staleTime: 20_000,
  ...options,
});

export const useCMLicenseCampaigns = (/** @type {any} */ cmId, params = {}, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(cmId) && (options.enabled ?? true),
  queryFn: () => getCMLicenseCampaigns(cmId, params),
  queryKey: licenseKeys.cmCampaigns(cmId, params),
  staleTime: 20_000,
  ...options,
});

export const useCMLicenseAssignments = (/** @type {any} */ cmId, params = {}, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(cmId) && (options.enabled ?? true),
  queryFn: () => getCMLicenseAssignments(cmId, params),
  queryKey: licenseKeys.cmAssignments(cmId, params),
  staleTime: 20_000,
  ...options,
});

export const useCMLicensePaymentReviews = (/** @type {any} */ cmId, params = {}, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(cmId) && (options.enabled ?? true),
  queryFn: () => getCMLicensePaymentReviews(cmId, params),
  queryKey: licenseKeys.cmPaymentReviews(cmId, params),
  staleTime: 20_000,
  ...options,
});

export const useLicenseAssignment = (/** @type {any} */ assignmentId, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(assignmentId) && (options.enabled ?? true),
  queryFn: () => getLicenseAssignment(assignmentId),
  queryKey: licenseKeys.assignment(assignmentId),
  staleTime: 20_000,
  ...options,
});

export const useMyLicenses = (options = {}) => useQuery({
  queryFn: getMyLicenses,
  queryKey: licenseKeys.mine,
  staleTime: 20_000,
  ...options,
});

export const useMyLicenseAssignment = (/** @type {any} */ assignmentId, /** @type {any} */ options = {}) => useQuery({
  enabled: Boolean(assignmentId) && (options.enabled ?? true),
  queryFn: () => getMyLicenseAssignment(assignmentId),
  queryKey: licenseKeys.mineAssignment(assignmentId),
  staleTime: 20_000,
  ...options,
});

const invalidateCampaign = (/** @type {any} */ queryClient, /** @type {any} */ campaignId) => {
  queryClient.invalidateQueries({ queryKey: ['licenses'] });
  if (campaignId) {
    queryClient.invalidateQueries({ queryKey: licenseKeys.campaign(campaignId) });
    queryClient.invalidateQueries({ queryKey: licenseKeys.dashboard(campaignId) });
  }
};

export const useLicenseMutation = (/** @type {any} */ mutationFn, /** @type {any} */ campaignId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateCampaign(queryClient, campaignId),
  });
};

export {
  addManualLicensePayment,
  approveExternalLicensePayment,
  bulkCreateCMLicenseCampaigns,
  bulkGenerateCMLicenseAssignments,
  createLicenseCampaign,
  createLicenseCheckout,
  declareExternalLicensePayment,
  deleteDraftLicenseCampaign,
  deleteLicenseDocumentRequest,
  deleteLicensePricingRule,
  duplicateLicenseCampaign,
  generateLicenseAssignments,
  generateLicenseReceipt,
  getLicenseCampaign,
  getLicensePaymentReviews,
  refundLicensePayment,
  rejectExternalLicensePayment,
  reviewLicenseDocument,
  sendBulkLicenseReminder,
  sendLicenseReminder,
  submitLicenseDocument,
  transitionLicenseCampaign,
  updateLicenseAssignmentAmount,
  updateLicenseCampaign,
  upsertLicenseDocumentRequest,
  upsertLicensePricingRule,
  waiveLicenseAssignment,
};
