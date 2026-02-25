import React from 'react';

import { navigate } from '@/navigation/navigationService';

import { useSmartNotifications } from '@/context/SmartNotificationContext';
import useNotifications from '@/hooks/useNotifications';

const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isNotificationsBootstrapDisabled = parseBooleanFlag(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

function NotificationBootstrapDisabled() {
  React.useEffect(() => {
    console.info('[BOOT] BOOT_NOTIFICATIONS_COMPONENT_SKIPPED_BY_FLAG');
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
