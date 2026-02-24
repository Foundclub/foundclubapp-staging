import { useEffect } from 'react';

import { navigate } from '@/navigation/navigationService';

import { useSmartNotifications } from '@/context/SmartNotificationContext';
import useNotifications from '@/hooks/useNotifications';

const isFlagEnabled = (rawValue) => {
  const normalized = String(rawValue || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const isNotificationsBootstrapDisabled = isFlagEnabled(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

/**
 * Mounts the notifications bootstrap only when the runtime flag allows it.
 * @param {{
 *  consumeNotification: (payload: any) => void
 * }} props
 * @returns {null}
 */
function NotificationBootstrapEnabled({ consumeNotification }) {
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

  useEffect(() => {
    console.info('[BOOT] BOOT_NOTIFICATIONS_READY', {
      smartNotificationsEnabled: smartNotifEnabled,
    });
  }, [smartNotifEnabled]);

  return null;
}

/**
 * Root bootstrap component for notifications.
 * @returns {import('react').ReactElement | null}
 */
function NotificationBootstrap() {
  const { consumeNotification } = useSmartNotifications();

  if (isNotificationsBootstrapDisabled) {
    console.info('[BOOT] BOOT_NOTIFICATIONS_DISABLED', {
      flag: 'FC_DISABLE_NOTIFICATIONS_BOOTSTRAP',
      value: process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
    });
    return null;
  }

  return (
    <NotificationBootstrapEnabled consumeNotification={consumeNotification} />
  );
}

export default NotificationBootstrap;
