import { useCallback, useMemo } from 'react';
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

export const useNotificationController = () => {
    const queryClient = useQueryClient();

    // Fetch notifications with infinite scroll
    const {
        data: notificationsData,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useInfiniteQuery({
        queryKey: ['notifications'],
        queryFn: ({ pageParam = 1 }) => getNotifications({ page: pageParam, pageSize: PAGE_SIZE }),
        getNextPageParam: (lastPage) => {
            if (!lastPage?.meta?.pagination) return undefined;
            const { page, pageCount } = lastPage.meta.pagination;
            return page < pageCount ? page + 1 : undefined;
        },
        initialPageParam: 1,
    });

    // Flatten notifications from all pages
    const notifications = useMemo(() => {
        if (!notificationsData?.pages) return [];
        return notificationsData.pages.flatMap(page => page?.data || []);
    }, [notificationsData]);

    // Fetch unread count
    const { data: unreadCountData } = useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: getUnreadCount,
        refetchInterval: 30000, // Poll every 30s
    });

    // Refetch on focus
    useFocusEffect(
        useCallback(() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        }, [refetch, queryClient])
    );

    // Mark as read mutation
    const { mutate: markAsReadMutation } = useMutation({
        mutationFn: markAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // Mark all as read mutation
    const { mutate: markAllAsReadMutation } = useMutation({
        mutationFn: markAllAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // Delete notification mutation
    const { mutate: deleteMutation } = useMutation({
        mutationFn: deleteNotification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
        unreadCount: unreadCountData?.count || 0,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        loadMore,
        refetch,
        markAsRead: markAsReadMutation,
        markAllAsRead: markAllAsReadMutation,
        deleteNotification: deleteMutation,
    };
};

