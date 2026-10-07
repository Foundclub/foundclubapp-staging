import { useFocusEffect } from '@react-navigation/native';
import {
  useInfiniteQuery, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '@/services/notification/notificationService';

const PAGE_SIZE = 20;
export const NOTIFICATIONS_QUERY_KEY = ['notifications'];
export const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unread-count'];
const NOTIFICATIONS_LIST_STALE_MS = 10000;
const UNREAD_COUNT_STALE_MS = 120000;
const UNREAD_POLL_MS = 120000;
const FOCUS_REFRESH_THROTTLE_MS = 8000;
const UNREAD_FOCUS_REFRESH_MIN_AGE_MS = 45000;

/**
 * @typedef {{ documentId?: string; read?: boolean }} NotificationItem
 * @typedef {{ page?: number; pageCount?: number }} PaginationMeta
 * @typedef {{ pagination?: PaginationMeta }} NotificationMeta
 * @typedef {{ data?: NotificationItem[]; meta?: NotificationMeta }} NotificationPage
 * @typedef {{ pages?: NotificationPage[] }} NotificationInfiniteData
 * @typedef {{ count?: number }} UnreadCountData
 */

/**
 * @param {NotificationInfiniteData | undefined} data
 * @param {(item: NotificationItem) => NotificationItem} mapper
 * @returns {NotificationInfiniteData | undefined}
 */
const mapNotificationPages = (data, mapper) => {
  if (!data?.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: (page?.data || []).map(mapper),
    })),
  };
};

/**
 * @param {NotificationInfiniteData | undefined} data
 * @param {string} documentId
 * @returns {NotificationInfiniteData | undefined}
 */
const removeNotificationFromPages = (data, documentId) => {
  if (!data?.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: (page?.data || []).filter((item) => item?.documentId !== documentId),
    })),
  };
};

/**
 * @param {NotificationInfiniteData | undefined} data
 * @param {string} documentId
 * @returns {NotificationItem | null}
 */
const findNotificationByDocumentId = (data, documentId) => {
  if (!data?.pages || !documentId) return null;
  return data.pages
    .flatMap((page) => page?.data || [])
    .find((item) => item?.documentId === documentId) || null;
};

const getQueryAgeMs = (queryClient, queryKey) => {
  const queryState = queryClient.getQueryState(queryKey);
  const updatedAt = Number(queryState?.dataUpdatedAt || 0);
  if (!updatedAt) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - updatedAt);
};

/**
 * FINITIONS7 (02/10) — LE COMPTEUR DE LA CLOCHE NE SE RELIT QUE S'IL EST PERIME.
 *
 * Journal T8 : 409 lectures de `count-unread` pour 200 retours au premier plan,
 * toujours par paires. Une seule regle pour tous ceux qui « reviennent » (un
 * ecran qui reprend le focus, l'app qui repasse au premier plan) : plus de 45 s,
 * on relit UNE fois ; sinon, rien.
 * `exact` : `['notifications']` couvre aussi le compteur par prefixe — une
 * invalidation large suivie de celle-ci relancerait la lecture deux fois.
 * Temoin : hooks/__tests__/useNotifications.FINITIONS7.compteurAuRetour.test.js.
 * @param {import('@tanstack/react-query').QueryClient} queryClient - Le cache de l'app.
 * @returns {boolean} Vrai si une lecture a ete demandee.
 */
export const refreshUnreadCountIfStale = (queryClient) => {
  const ageMs = getQueryAgeMs(queryClient, UNREAD_COUNT_QUERY_KEY);
  if (ageMs < UNREAD_FOCUS_REFRESH_MIN_AGE_MS) return false;
  queryClient.invalidateQueries({ exact: true, queryKey: UNREAD_COUNT_QUERY_KEY });
  return true;
};

export const useNotificationController = (options = {}) => {
  const {
    notificationsEnabled = true,
    skipInitialFocusRefresh = false,
    unreadCountEnabled = true,
    unreadPollMs = UNREAD_POLL_MS,
  } = options;
  const queryClient = useQueryClient();
  const lastFocusRefreshAtRef = useRef(0);
  const hasHandledInitialFocusRef = useRef(false);

  // Fetch notifications with infinite scroll
  const {
    data: notificationsData,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    enabled: notificationsEnabled,
    getNextPageParam: (/** @type {NotificationPage | undefined} */ lastPage) => {
      if (!lastPage?.meta?.pagination) return undefined;
      const page = Number(lastPage.meta.pagination.page || 1);
      const pageCount = Number(lastPage.meta.pagination.pageCount || 1);
      return page < pageCount ? page + 1 : undefined;
    },
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => getNotifications({ page: pageParam, pageSize: PAGE_SIZE }),
    queryKey: NOTIFICATIONS_QUERY_KEY,
    refetchOnMount: false,
    staleTime: NOTIFICATIONS_LIST_STALE_MS,
  });

  // Flatten notifications from all pages
  const notifications = useMemo(() => {
    const pages = /** @type {NotificationPage[]} */ (notificationsData?.pages || []);
    return pages.flatMap((page) => page?.data || []);
  }, [notificationsData]);

  // Fetch unread count
  const { data: unreadCountData } = useQuery({
    enabled: unreadCountEnabled,
    queryFn: getUnreadCount,
    queryKey: UNREAD_COUNT_QUERY_KEY,
    refetchInterval: unreadCountEnabled ? unreadPollMs : false,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    staleTime: UNREAD_COUNT_STALE_MS,
  });

  // FINITIONS7 — `exact` : sans lui, la premiere ligne relancait AUSSI le compteur
  // (prefixe), et la seconde annulait cette lecture pour en relancer une autre.
  const invalidateNotificationQueries = useCallback(() => {
    queryClient.invalidateQueries({ exact: true, queryKey: NOTIFICATIONS_QUERY_KEY });
    queryClient.invalidateQueries({ exact: true, queryKey: UNREAD_COUNT_QUERY_KEY });
  }, [queryClient]);

  // Refetch on focus
  useFocusEffect(
    useCallback(() => {
      if (!notificationsEnabled && !unreadCountEnabled) {
        return undefined;
      }

      if (skipInitialFocusRefresh && !hasHandledInitialFocusRef.current) {
        hasHandledInitialFocusRef.current = true;
        return undefined;
      }

      const now = Date.now();
      if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_THROTTLE_MS) {
        return undefined;
      }
      lastFocusRefreshAtRef.current = now;
      if (notificationsEnabled) {
        refetch();
      }
      if (unreadCountEnabled) {
        refreshUnreadCountIfStale(queryClient);
      }
      return undefined;
    }, [
      notificationsEnabled,
      queryClient,
      refetch,
      skipInitialFocusRefresh,
      unreadCountEnabled,
    ]),
  );

  // Mark as read mutation
  const { mutateAsync: markAsReadMutationAsync } = useMutation({
    mutationFn: markAsRead,
    onError: (_error, _documentId, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousUnreadCount);
      }
    },
    onMutate: async (/** @type {string} */ documentId) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });

      const previousNotifications = /** @type {NotificationInfiniteData | undefined} */ (
        queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY)
      );
      const previousUnreadCount = /** @type {UnreadCountData | undefined} */ (
        queryClient.getQueryData(UNREAD_COUNT_QUERY_KEY)
      );

      const currentNotification = findNotificationByDocumentId(previousNotifications, documentId);
      const wasUnread = Boolean(currentNotification && !currentNotification.read);

      queryClient.setQueryData(
        NOTIFICATIONS_QUERY_KEY,
        (/** @type {NotificationInfiniteData | undefined} */ oldData) => mapNotificationPages(oldData, (item) => (
          item?.documentId === documentId ? { ...item, read: true } : item
        )),
      );

      if (wasUnread) {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, (/** @type {UnreadCountData | undefined} */ oldData) => ({
          count: Math.max(0, Number(oldData?.count || 0) - 1),
        }));
      }

      return { previousNotifications, previousUnreadCount };
    },
    onSettled: () => {
      invalidateNotificationQueries();
    },
  });

  // Mark all as read mutation
  const { mutateAsync: markAllAsReadMutationAsync } = useMutation({
    mutationFn: markAllAsRead,
    onError: (_error, _vars, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousUnreadCount);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });

      const previousNotifications = /** @type {NotificationInfiniteData | undefined} */ (
        queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY)
      );
      const previousUnreadCount = /** @type {UnreadCountData | undefined} */ (
        queryClient.getQueryData(UNREAD_COUNT_QUERY_KEY)
      );

      queryClient.setQueryData(
        NOTIFICATIONS_QUERY_KEY,
        (/** @type {NotificationInfiniteData | undefined} */ oldData) => mapNotificationPages(oldData, (item) => ({ ...item, read: true })),
      );
      queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, { count: 0 });

      return { previousNotifications, previousUnreadCount };
    },
    onSettled: () => {
      invalidateNotificationQueries();
    },
  });

  // Delete notification mutation
  const { mutateAsync: deleteMutationAsync } = useMutation({
    mutationFn: deleteNotification,
    onError: (_error, _vars, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousUnreadCount);
      }
    },
    onMutate: async (/** @type {string} */ documentId) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });

      const previousNotifications = /** @type {NotificationInfiniteData | undefined} */ (
        queryClient.getQueryData(NOTIFICATIONS_QUERY_KEY)
      );
      const previousUnreadCount = /** @type {UnreadCountData | undefined} */ (
        queryClient.getQueryData(UNREAD_COUNT_QUERY_KEY)
      );

      const currentNotification = findNotificationByDocumentId(previousNotifications, documentId);
      const wasUnread = Boolean(currentNotification && !currentNotification.read);

      queryClient.setQueryData(
        NOTIFICATIONS_QUERY_KEY,
        (/** @type {NotificationInfiniteData | undefined} */ oldData) => removeNotificationFromPages(oldData, documentId),
      );

      if (wasUnread) {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, (/** @type {UnreadCountData | undefined} */ oldData) => ({
          count: Math.max(0, Number(oldData?.count || 0) - 1),
        }));
      }

      return { previousNotifications, previousUnreadCount };
    },
    onSettled: () => {
      invalidateNotificationQueries();
    },
  });

  // Load more handler
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    deleteNotification: deleteMutationAsync,
    hasNextPage,
    // VILLE-NOTIFS (07/10) — une lecture en echec n'est pas une liste vide : les ecrans le disent.
    isError,
    isFetchingNextPage,
    isLoading,
    loadMore,
    markAllAsRead: markAllAsReadMutationAsync,
    markAsRead: markAsReadMutationAsync,
    notifications,
    refetch,
    refreshNotifications: () => {
      if (notificationsEnabled) {
        refetch();
      }
      if (unreadCountEnabled) {
        refreshUnreadCountIfStale(queryClient);
      }
    },
    unreadCount: (/** @type {UnreadCountData | undefined} */ (unreadCountData))?.count || 0,
  };
};
