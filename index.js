import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';

const logBoot = (step, meta) => {
  if (meta === undefined) {
    console.info(`[BOOT] ${step}`);
    return;
  }
  console.info(`[BOOT] ${step}`, meta);
};

logBoot('BOOT_APP_START', {
  appEnv: process.env.APP_ENV || process.env.ENV || 'unknown',
  appName,
});

const isFlagEnabled = (rawValue) => {
  const normalized = String(rawValue || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const shouldDisableNotificationsBootstrap = isFlagEnabled(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

// Register background handler context immediately
try {
  if (shouldDisableNotificationsBootstrap) {
    logBoot('BOOT_BACKGROUND_HANDLER_SKIPPED', {
      flag: 'FC_DISABLE_NOTIFICATIONS_BOOTSTRAP',
      value: process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
    });
  } else {
    // Lazy-load to avoid eager native module evaluation at startup.
    // eslint-disable-next-line global-require
    const { registerBackgroundHandler } = require('./src/services/notificationBackgroundHandler');
    registerBackgroundHandler();
    logBoot('BOOT_BACKGROUND_HANDLER_READY');
  }
} catch (error) {
  // Never crash app startup because of notification bootstrap.
  console.warn('[index] Failed to register background handler:', error);
  logBoot('BOOT_BACKGROUND_HANDLER_FAILED', {
    error: error?.message || 'unknown',
  });
}

AppRegistry.registerComponent(appName, () => App);
