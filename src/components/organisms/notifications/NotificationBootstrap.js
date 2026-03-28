import React from 'react';
import { Platform } from 'react-native';

import { navigate } from '@/navigation/navigationService';

import {
  ENABLE_PUSH_NOTIFICATIONS,
  ENABLE_SMART_NOTIFICATIONS,
  NOTIFICATIONS_BOOTSTRAP_POLICY,
  NOTIFICATIONS_RUNTIME_CONFIG,
} from '@/constants/runtimeFlags';
import { useSmartNotifications } from '@/context/SmartNotificationContext';
import useNotifications from '@/hooks/useNotifications';

const isNotificationsBootstrapDisabled = !ENABLE_PUSH_NOTIFICATIONS;

/**
 *
 */
function NotificationBootstrapDisabled() {
  React.useEffect(() => {
    console.info('[BOOT] BOOT_NOTIFICATIONS_COMPONENT_SKIPPED', {
      platform: Platform.OS,
      policy: NOTIFICATIONS_BOOTSTRAP_POLICY,
    });
  }, []);

  return null;
}

/**
 *
 */
function NotificationBootstrapEnabled() {
  const { consumeNotification } = useSmartNotifications();

  React.useEffect(() => {
    console.info('[BOOT] BOOT_NOTIFICATIONS_COMPONENT_READY', {
      platform: Platform.OS,
      runtime: NOTIFICATIONS_RUNTIME_CONFIG,
    });
  }, []);

  useNotifications({
    navigate,
    onSmartNotification: ENABLE_SMART_NOTIFICATIONS ? consumeNotification : undefined,
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
