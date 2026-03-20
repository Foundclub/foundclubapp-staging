import React from 'react';
import { Platform } from 'react-native';

import { navigate } from '@/navigation/navigationService';

import {
  DISABLE_NOTIFICATIONS_BOOTSTRAP,
  NOTIFICATIONS_BOOTSTRAP_POLICY,
} from '@/constants/runtimeFlags';
import { useSmartNotifications } from '@/context/SmartNotificationContext';
import useNotifications from '@/hooks/useNotifications';

const isNotificationsBootstrapDisabled = DISABLE_NOTIFICATIONS_BOOTSTRAP;

function NotificationBootstrapDisabled() {
  React.useEffect(() => {
    console.info('[BOOT] BOOT_NOTIFICATIONS_COMPONENT_SKIPPED', {
      platform: Platform.OS,
      policy: NOTIFICATIONS_BOOTSTRAP_POLICY,
    });
  }, []);

  return null;
}

function NotificationBootstrapEnabled() {
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

/**
 *
 */
function NotificationBootstrap() {
  if (isNotificationsBootstrapDisabled) {
    return <NotificationBootstrapDisabled />;
  }

  return <NotificationBootstrapEnabled />;
}

export default NotificationBootstrap;
