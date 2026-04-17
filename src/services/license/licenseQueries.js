import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addManualLicensePayment,
  createLicenseCampaign,
  createLicenseCheckout,
  declareExternalLicensePayment,
  generateLicenseAssignments,
  getCurrentLicenseCampaign,
  getLicenseAssignment,
  getLicenseAssignments,
  getLicenseDashboard,
  getMyLicenseAssignment,
  getMyLicenses,
  sendBulkLicenseReminder,
  sendLicenseReminder,
  updateLicenseAssignmentAmount,
  updateLicenseCampaign,
  waiveLicenseAssignment,
} from './licenseService';

export const licenseKeys = {
  all: ['licenses'],
  assignment: (assignmentId) => ['licenses', 'assignment', assignmentId],
  assignments: (campaignId, params) => ['licenses', 'campaign', campaignId, 'assignments', params],
  currentCampaign: (params) => ['licenses', 'campaign', 'current', params],
  dashboard: (campaignId) => ['licenses', 'campaign', campaignId, 'dashboard'],
  mine: ['licenses', 'mine'],
  mineAssignment: (assignmentId) => ['licenses', 'mine', assignmentId],
};

export const useCurrentLicenseCampaign = (params = {}, options = {}) => useQuery({
  queryFn: () => getCurrentLicenseCampaign(params),
  queryKey: licenseKeys.currentCampaign(params),
  staleTime: 30_000,
  ...options,
});

export const useLicenseDashboard = (campaignId, options = {}) => useQuery({
  enabled: Boolean(campaignId) && (options.enabled ?? true),
  queryFn: () => getLicenseDashboard(campaignId),
  queryKey: licenseKeys.dashboard(campaignId),
  staleTime: 20_000,
  ...options,
});

export const useLicenseAssignments = (campaignId, params = {}, options = {}) => useQuery({
  enabled: Boolean(campaignId) && (options.enabled ?? true),
  queryFn: () => getLicenseAssignments(campaignId, params),
  queryKey: licenseKeys.assignments(campaignId, params),
  staleTime: 20_000,
  ...options,
});

export const useLicenseAssignment = (assignmentId, options = {}) => useQuery({
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

export const useMyLicenseAssignment = (assignmentId, options = {}) => useQuery({
  enabled: Boolean(assignmentId) && (options.enabled ?? true),
  queryFn: () => getMyLicenseAssignment(assignmentId),
  queryKey: licenseKeys.mineAssignment(assignmentId),
  staleTime: 20_000,
  ...options,
});

const invalidateCampaign = (queryClient, campaignId) => {
  queryClient.invalidateQueries({ queryKey: ['licenses'] });
  if (campaignId) {
    queryClient.invalidateQueries({ queryKey: licenseKeys.dashboard(campaignId) });
  }
};

export const useLicenseMutation = (mutationFn, campaignId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateCampaign(queryClient, campaignId),
  });
};

export {
  addManualLicensePayment,
  createLicenseCampaign,
  createLicenseCheckout,
  declareExternalLicensePayment,
  generateLicenseAssignments,
  sendBulkLicenseReminder,
  sendLicenseReminder,
  updateLicenseAssignmentAmount,
  updateLicenseCampaign,
  waiveLicenseAssignment,
};
