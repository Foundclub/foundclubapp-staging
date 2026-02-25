import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';
import { registerBackgroundHandler } from './src/services/notificationBackgroundHandler';

const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isNotificationsBootstrapDisabled = parseBooleanFlag(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

const logBoot = (step, meta) => {
  if (meta === undefined) {
    console.info(`[BOOT] ${step}`);
    return;
  }
  console.info(`[BOOT] ${step}`, meta);
};

const installGlobalErrorHandler = () => {
  try {
    const errorUtils = global?.ErrorUtils;
    if (
      !errorUtils
      || typeof errorUtils.getGlobalHandler !== 'function'
      || typeof errorUtils.setGlobalHandler !== 'function'
    ) {
      logBoot('BOOT_GLOBAL_JS_HANDLER_UNAVAILABLE');
      return;
    }

    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error('[BOOT] BOOT_GLOBAL_JS_ERROR', {
        isFatal: Boolean(isFatal),
        message: error?.message || 'unknown',
        name: error?.name || 'Error',
        stack: error?.stack || 'no_stack',
      });

      if (typeof previousHandler === 'function') {
        previousHandler(error, isFatal);
      }
    });

    logBoot('BOOT_GLOBAL_JS_HANDLER_READY');
  } catch (error) {
    logBoot('BOOT_GLOBAL_JS_HANDLER_FAILED', {
      error: error?.message || 'unknown',
    });
  }
};

installGlobalErrorHandler();

logBoot('BOOT_APP_START', {
  appName,
  notificationsBootstrapDisabled: isNotificationsBootstrapDisabled,
});

// Register notification background handler context immediately
if (isNotificationsBootstrapDisabled) {
  logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_DISABLED_BY_FLAG');
} else {
  try {
    registerBackgroundHandler();
    logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_ENABLED');
  } catch (error) {
    console.warn('[index] Failed to register background handler:', error);
    logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_FAILED', {
      error: error?.message || 'unknown',
    });
  }
}

AppRegistry.registerComponent(appName, () => App);
