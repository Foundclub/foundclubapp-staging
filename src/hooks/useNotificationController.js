import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/services/notification/notificationService';

export const useNotificationController = () => {
    const queryClient = useQueryClient();

    // Fetch notifications
    const { data: notificationsData, isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => getNotifications(),
    });

    // Fetch unread count
    const { data: unreadCountData } = useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: () => getUnreadCount(),
        refetchInterval: 30000, // Poll every 30s
    });

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

    return {
        notifications: notificationsData?.data || [],
        unreadCount: unreadCountData?.count || 0,
        isLoading,
        markAsRead: markAsReadMutation,
        markAllAsRead: markAllAsReadMutation,
    };
};
