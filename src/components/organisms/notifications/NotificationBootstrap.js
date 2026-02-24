import { useEffect, useMemo, useRef } from 'react';

import { navigate } from '@/navigation/navigationService';

import { useSmartNotifications } from '@/context/SmartNotificationContext';

const isFlagEnabled = (rawValue) => {
  const normalized = String(rawValue || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const isNotificationsBootstrapDisabled = isFlagEnabled(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

let useNotificationsHookCache = null;
let useNotificationsHookLoadFailed = false;

const resolveUseNotificationsHook = () => {
  if (useNotificationsHookCache) return useNotificationsHookCache;
  if (useNotificationsHookLoadFailed) return null;

  try {
    // eslint-disable-next-line global-require
    const useNotificationsModule = require('@/hooks/useNotifications');
    const hook = useNotificationsModule?.default || useNotificationsModule;

    if (typeof hook !== 'function') {
      throw new Error('Invalid useNotifications export');
    }

    useNotificationsHookCache = hook;
    return useNotificationsHookCache;
  } catch (error) {
    useNotificationsHookLoadFailed = true;
    console.warn('[NotificationBootstrap] Failed to load notifications hook:', error);
    return null;
  }
};

/**
 * @param {{
 *  consumeNotification: (payload: any) => void,
 *  smartNotifEnabled: boolean,
 *  useNotificationsHook: (args: {
 *    navigate: (routeName: string, params?: Record<string, unknown>) => boolean | void,
 *    onSmartNotification?: (payload: any) => void
 *  }) => void
 * }} props
 * @returns {null}
 */
function NotificationBootstrapRuntime({
  consumeNotification,
  smartNotifEnabled,
  useNotificationsHook,
}) {
  useNotificationsHook({
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
 * Mounts the notifications bootstrap only when the runtime flag allows it.
 * @param {{
 *  consumeNotification: (payload: any) => void
 * }} props
 * @returns {null}
 */
function NotificationBootstrapEnabled({ consumeNotification }) {
  const hasLoggedMissingHookRef = useRef(false);
  const useNotificationsHook = useMemo(() => resolveUseNotificationsHook(), []);

  const smartNotifEnabled = (() => {
    const raw = process.env.LEAGUE_SMART_NOTIF_V1;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw.trim().toLowerCase() === 'true';
    }
    return __DEV__;
  })();

  if (!useNotificationsHook) {
    if (!hasLoggedMissingHookRef.current) {
      hasLoggedMissingHookRef.current = true;
      console.info('[BOOT] BOOT_NOTIFICATIONS_SKIPPED', {
        reason: 'hook_load_failed',
      });
    }
    return null;
  }

  return (
    <NotificationBootstrapRuntime
      consumeNotification={consumeNotification}
      smartNotifEnabled={smartNotifEnabled}
      useNotificationsHook={useNotificationsHook}
    />
  );
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
