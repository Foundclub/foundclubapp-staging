import { Platform } from 'react-native';

import client from '@/services/client';

const unwrapResponse = (response) => response?.data?.data || response?.data || null;

/**
 * @returns {Promise<{
 *   activeRemotePopupCampaign?: any,
 *   pendingLeagueActionSummary?: any,
 *   pendingMatchStatsSummary?: any,
 *   serverTime?: string,
 *   unreadNotificationsCount?: number,
 *   userSummary?: User,
 * } | null>}
 */
export const getAppBootstrap = async () => {
  const response = await client.get('/app/bootstrap', {
    params: {
      platform: Platform.OS,
    },
  });

  return unwrapResponse(response);
};
