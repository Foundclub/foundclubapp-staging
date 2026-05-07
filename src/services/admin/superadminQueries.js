import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  bulkDeleteSuperadminEntries,
  bulkSuperadminEntries,
  createSuperadminEntry,
  deleteSuperadminEntry,
  getSuperadminContentMetadata,
  getSuperadminContentTypes,
  getSuperadminEntry,
  listSuperadminEntries,
  searchSuperadminRelations,
  setSuperadminUserSuspension,
  updateSuperadminEntry,
} from './superadminService';

const contentTypesKey = ['superadmin', 'content-types'];
const listKey = (uid, params) => buildNormalizedQueryKey(['superadmin', 'content', uid, 'list'], params);
const detailKey = (uid, documentId) => ['superadmin', 'content', uid, 'detail', documentId];
const metadataKey = (uid) => ['superadmin', 'content', uid, 'metadata'];

/**
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetSuperadminContentTypes = () => useQuery({
  queryFn: getSuperadminContentTypes,
  queryKey: contentTypesKey,
});

/**
 * @param {string | undefined} uid
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetSuperadminContentMetadata = (uid) => useQuery({
  enabled: Boolean(uid),
  queryFn: () => getSuperadminContentMetadata(uid),
  queryKey: metadataKey(uid),
});

/**
 * @param {string | undefined} uid
 * @param {Record<string, any>} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetSuperadminEntries = (uid, params = {}) => useQuery({
  enabled: Boolean(uid),
  queryFn: () => listSuperadminEntries(uid, params),
  queryKey: listKey(uid, params),
});

/**
 * @param {string | undefined} uid
 * @param {string | undefined} documentId
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetSuperadminEntry = (uid, documentId) => useQuery({
  enabled: Boolean(uid && documentId),
  queryFn: () => getSuperadminEntry(uid, documentId),
  queryKey: detailKey(uid, documentId),
});

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, { uid: string; data: Record<string, any>; reason?: string }>}
 */
export const useCreateSuperadminEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, reason, uid }) => createSuperadminEntry(uid, data, reason),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'content', variables.uid, 'list'] });
      queryClient.invalidateQueries({ queryKey: contentTypesKey });
    },
  });
};

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, { uid: string; documentId: string; data: Record<string, any>; reason?: string }>}
 */
export const useUpdateSuperadminEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data, documentId, reason, uid,
    }) => updateSuperadminEntry(uid, documentId, data, reason),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'content', variables.uid, 'list'] });
      queryClient.invalidateQueries({ queryKey: detailKey(variables.uid, variables.documentId) });
    },
  });
};

/**
 * Mutate the explicit SuperAdmin user suspension endpoint.
 * @returns {import('@tanstack/react-query').UseMutationResult<
 *   any,
 *   Error,
 *   { documentId: string; suspended: boolean; reason: string }
 * >}
 */
export const useSetSuperadminUserSuspension = () => {
  const queryClient = useQueryClient();
  const userUid = 'plugin::users-permissions.user';

  return useMutation({
    mutationFn: ({ documentId, reason, suspended }) => (
      setSuperadminUserSuspension(documentId, { reason, suspended })
    ),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['superadmin', 'content', userUid, 'list'],
      });
      queryClient.invalidateQueries({
        queryKey: detailKey(userUid, variables.documentId),
      });
    },
  });
};

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, { uid: string; documentId: string; reason: string }>}
 */
export const useDeleteSuperadminEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, reason, uid }) => deleteSuperadminEntry(uid, documentId, reason),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'content', variables.uid, 'list'] });
      queryClient.removeQueries({ queryKey: detailKey(variables.uid, variables.documentId) });
    },
  });
};

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, { uid: string; documentIds: string[]; reason: string }>}
 */
export const useBulkDeleteSuperadminEntries = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentIds, reason, uid }) => bulkDeleteSuperadminEntries(uid, documentIds, reason),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'content', variables.uid, 'list'] });
    },
  });
};

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, { uid: string; action: 'delete' | 'update' | 'publish' | 'unpublish'; documentIds: string[]; reason: string; data?: Record<string, any> }>}
 */
export const useBulkSuperadminEntries = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action, data, documentIds, reason, uid,
    }) => bulkSuperadminEntries(uid, action, { data, documentIds, reason }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'content', variables.uid, 'list'] });
    },
  });
};

/**
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, { targetUid: string; payload?: Record<string, any> }>}
 */
export const useSearchSuperadminRelations = () => useMutation({
  mutationFn: ({ payload, targetUid }) => searchSuperadminRelations(targetUid, payload),
});
