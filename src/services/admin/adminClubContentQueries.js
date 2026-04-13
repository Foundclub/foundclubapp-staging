import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  bulkDeleteAdminClubContent,
  bulkUpdateAdminClubContent,
  createAdminClubContent,
  deleteAdminClubContent,
  getAdminClubContent,
  getAdminClubMetadata,
  listAdminClubContent,
  pickAndUploadAdminClubLogo,
  replaceAdminClubRelation,
  searchAdminClubRelations,
  updateAdminClubContent,
  updateAdminClubRelation,
} from './adminClubContentService';

const clubListRootKey = ['admin', 'club-content'];
const clubListKey = (params) => buildNormalizedQueryKey([...clubListRootKey, 'list'], params);
const clubDetailKey = (documentId) => [...clubListRootKey, 'detail', documentId];

export const useGetAdminClubContentList = (params) => useQuery({
  queryFn: () => listAdminClubContent(params),
  queryKey: clubListKey(params),
});

export const useGetAdminClubContent = (documentId) => useQuery({
  enabled: Boolean(documentId),
  queryFn: () => getAdminClubContent(documentId),
  queryKey: clubDetailKey(documentId),
});

export const useGetAdminClubMetadata = () => useQuery({
  queryFn: getAdminClubMetadata,
  queryKey: [...clubListRootKey, 'metadata'],
});

export const useCreateAdminClubContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminClubContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
    },
  });
};

export const useUpdateAdminClubContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminClubContent,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
      queryClient.invalidateQueries({ queryKey: clubDetailKey(variables.documentId) });
    },
  });
};

export const useDeleteAdminClubContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminClubContent,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
      queryClient.removeQueries({ queryKey: clubDetailKey(variables.documentId) });
    },
  });
};

export const useBulkDeleteAdminClubContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteAdminClubContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
    },
  });
};

export const useBulkUpdateAdminClubContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdateAdminClubContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
    },
  });
};

export const useUpdateAdminClubRelation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminClubRelation,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
      queryClient.invalidateQueries({ queryKey: clubDetailKey(variables.documentId) });
    },
  });
};

export const useReplaceAdminClubRelation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replaceAdminClubRelation,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: clubListRootKey });
      queryClient.invalidateQueries({ queryKey: clubDetailKey(variables.documentId) });
    },
  });
};

export const useSearchAdminClubRelations = () => useMutation({
  mutationFn: ({ payload, targetUid }) => searchAdminClubRelations(targetUid, payload),
});

export const useUploadAdminClubLogo = () => useMutation({
  mutationFn: pickAndUploadAdminClubLogo,
});
