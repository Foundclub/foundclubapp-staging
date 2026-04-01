import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  archiveInAppPopupCampaign,
  createInAppPopupCampaign,
  duplicateInAppPopupCampaign,
  getInAppPopupCampaign,
  getInAppPopupCampaignStats,
  listInAppPopupCampaigns,
  pauseInAppPopupCampaign,
  publishInAppPopupCampaign,
  updateInAppPopupCampaign,
} from './inAppPopupCampaignService';

const campaignListKey = (params = {}) => buildNormalizedQueryKey(['in-app-popup-campaigns', 'list'], params);
const campaignDetailKey = (documentId) => ['in-app-popup-campaigns', 'detail', documentId];
const campaignStatsKey = (documentId) => ['in-app-popup-campaigns', 'stats', documentId];

export const useGetInAppPopupCampaigns = (params = {}) => useQuery({
  queryFn: () => listInAppPopupCampaigns(params),
  queryKey: campaignListKey(params),
});

export const useGetInAppPopupCampaign = (documentId) => useQuery({
  enabled: Boolean(documentId),
  queryFn: () => getInAppPopupCampaign(documentId),
  queryKey: campaignDetailKey(documentId),
});

export const useGetInAppPopupCampaignStats = (documentId) => useQuery({
  enabled: Boolean(documentId),
  queryFn: () => getInAppPopupCampaignStats(documentId),
  queryKey: campaignStatsKey(documentId),
});

export const useCreateInAppPopupCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }) => createInAppPopupCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-popup-campaigns', 'list'] });
    },
  });
};

export const useUpdateInAppPopupCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, documentId }) => updateInAppPopupCampaign(documentId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['in-app-popup-campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: campaignDetailKey(variables.documentId) });
      queryClient.invalidateQueries({ queryKey: campaignStatsKey(variables.documentId) });
    },
  });
};

export const usePublishInAppPopupCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId }) => publishInAppPopupCampaign(documentId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['in-app-popup-campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: campaignDetailKey(variables.documentId) });
      queryClient.invalidateQueries({ queryKey: campaignStatsKey(variables.documentId) });
    },
  });
};

export const usePauseInAppPopupCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId }) => pauseInAppPopupCampaign(documentId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['in-app-popup-campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: campaignDetailKey(variables.documentId) });
      queryClient.invalidateQueries({ queryKey: campaignStatsKey(variables.documentId) });
    },
  });
};

export const useArchiveInAppPopupCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId }) => archiveInAppPopupCampaign(documentId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['in-app-popup-campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: campaignDetailKey(variables.documentId) });
      queryClient.invalidateQueries({ queryKey: campaignStatsKey(variables.documentId) });
    },
  });
};

export const useDuplicateInAppPopupCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId }) => duplicateInAppPopupCampaign(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-popup-campaigns', 'list'] });
    },
  });
};
