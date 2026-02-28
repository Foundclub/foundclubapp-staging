import React from 'react';

import { DISABLE_NOTIFICATIONS_BOOTSTRAP } from '@/constants/runtimeFlags';

const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isNotificationsBootstrapDisabled = DISABLE_NOTIFICATIONS_BOOTSTRAP || parseBooleanFlag(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

function NotificationBootstrapDisabled() {
  React.useEffect(() => {
    console.info('[BOOT] BOOT_NOTIFICATIONS_COMPONENT_SKIPPED_BY_FLAG');
  }, []);

  return null;
}

function NotificationBootstrapEnabled() {
  const { navigate } = require('../../../navigation/navigationService');
  const { useSmartNotifications } = require('../../../context/SmartNotificationContext');
  const useNotifications = require('../../../hooks/useNotifications').default;
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
