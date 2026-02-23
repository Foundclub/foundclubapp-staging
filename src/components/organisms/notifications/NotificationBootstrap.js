import React from 'react';

import { navigate } from '@/navigation/navigationService';

import { useSmartNotifications } from '@/context/SmartNotificationContext';
import useNotifications from '@/hooks/useNotifications';

/**
 *
 */
function NotificationBootstrap() {
  const { consumeNotification } = useSmartNotifications();
  const smartNotifEnabled = (() => {
    const raw = process.env.LEAGUE_SMART_NOTIF_V1;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw.trim().toLowerCase() === 'true';
    }
    return __DEV__;
  })();
  useNotifications({
    navigate,
    onSmartNotification: smartNotifEnabled ? consumeNotification : undefined,
  });
  return null;
}

export default NotificationBootstrap;
