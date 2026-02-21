import { useCallback, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { 
    getNotifications, 
    getUnreadCount, 
    markAsRead, 
    markAllAsRead,
    deleteNotification 
} from '@/services/notification/notificationService';

const PAGE_SIZE = 20;
const NOTIFICATIONS_QUERY_KEY = ['notifications'];
const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unread-count'];
const NOTIFICATIONS_STALE_MS = 10000;
const UNREAD_POLL_MS = 30000;
const FOCUS_REFRESH_THROTTLE_MS = 8000;

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
    for (const page of data.pages) {
        const found = (page?.data || []).find((item) => item?.documentId === documentId);
        if (found) return found;
    }
    return null;
};

export const useNotificationController = () => {
    const queryClient = useQueryClient();
    const lastFocusRefreshAtRef = useRef(0);

    // Fetch notifications with infinite scroll
    const {
        data: notificationsData,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useInfiniteQuery({
        queryKey: NOTIFICATIONS_QUERY_KEY,
        queryFn: ({ pageParam = 1 }) => getNotifications({ page: pageParam, pageSize: PAGE_SIZE }),
        getNextPageParam: (/** @type {NotificationPage | undefined} */ lastPage) => {
            if (!lastPage?.meta?.pagination) return undefined;
            const page = Number(lastPage.meta.pagination.page || 1);
            const pageCount = Number(lastPage.meta.pagination.pageCount || 1);
            return page < pageCount ? page + 1 : undefined;
        },
        initialPageParam: 1,
        staleTime: NOTIFICATIONS_STALE_MS,
        refetchOnMount: false,
    });

    // Flatten notifications from all pages
    const notifications = useMemo(() => {
        const pages = /** @type {NotificationPage[]} */ (notificationsData?.pages || []);
        return pages.flatMap((page) => page?.data || []);
    }, [notificationsData]);

    // Fetch unread count
    const { data: unreadCountData } = useQuery({
        queryKey: UNREAD_COUNT_QUERY_KEY,
        queryFn: getUnreadCount,
        staleTime: NOTIFICATIONS_STALE_MS,
        refetchInterval: UNREAD_POLL_MS,
        refetchIntervalInBackground: false,
        refetchOnMount: false,
    });

    const invalidateNotificationQueries = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    }, [queryClient]);

    // Refetch on focus
    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_THROTTLE_MS) {
                return undefined;
            }
            lastFocusRefreshAtRef.current = now;
            refetch();
            queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
            return undefined;
        }, [refetch, queryClient])
    );

    // Mark as read mutation
    const { mutateAsync: markAsReadMutationAsync } = useMutation({
        mutationFn: markAsRead,
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
                ))
            );

            if (wasUnread) {
                queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, (/** @type {UnreadCountData | undefined} */ oldData) => ({
                    count: Math.max(0, Number(oldData?.count || 0) - 1),
                }));
            }

            return { previousNotifications, previousUnreadCount };
        },
        onError: (_error, _documentId, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
            }
            if (context?.previousUnreadCount) {
                queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousUnreadCount);
            }
        },
        onSettled: () => {
            invalidateNotificationQueries();
        },
    });

    // Mark all as read mutation
    const { mutateAsync: markAllAsReadMutationAsync } = useMutation({
        mutationFn: markAllAsRead,
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
                (/** @type {NotificationInfiniteData | undefined} */ oldData) => mapNotificationPages(oldData, (item) => ({ ...item, read: true }))
            );
            queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, { count: 0 });

            return { previousNotifications, previousUnreadCount };
        },
        onError: (_error, _vars, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
            }
            if (context?.previousUnreadCount) {
                queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousUnreadCount);
            }
        },
        onSettled: () => {
            invalidateNotificationQueries();
        },
    });

    // Delete notification mutation
    const { mutateAsync: deleteMutationAsync } = useMutation({
        mutationFn: deleteNotification,
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
                (/** @type {NotificationInfiniteData | undefined} */ oldData) => removeNotificationFromPages(oldData, documentId)
            );

            if (wasUnread) {
                queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, (/** @type {UnreadCountData | undefined} */ oldData) => ({
                    count: Math.max(0, Number(oldData?.count || 0) - 1),
                }));
            }

            return { previousNotifications, previousUnreadCount };
        },
        onError: (_error, _vars, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
            }
            if (context?.previousUnreadCount) {
                queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousUnreadCount);
            }
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
        notifications,
        unreadCount: (/** @type {UnreadCountData | undefined} */ (unreadCountData))?.count || 0,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        loadMore,
        refetch,
        markAsRead: markAsReadMutationAsync,
        markAllAsRead: markAllAsReadMutationAsync,
        deleteNotification: deleteMutationAsync,
        refreshNotifications: () => {
            refetch();
            queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
        },
    };
};

