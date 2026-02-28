import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import { DISABLE_NOTIFICATIONS_BOOTSTRAP } from './src/constants/runtimeFlags';
import {
  persistBootError,
  readPersistedBootError,
} from './src/utils/bootDiagnostics';

const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isNotificationsBootstrapDisabled = DISABLE_NOTIFICATIONS_BOOTSTRAP || parseBooleanFlag(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);

const logBoot = (step, meta) => {
  if (meta === undefined) {
    console.info(`[BOOT] ${step}`);
    return;
  }
  console.info(`[BOOT] ${step}`, meta);
};

const createBootErrorPayload = (error, isFatal, context) => ({
  context,
  isFatal: Boolean(isFatal),
  message: error?.message || 'unknown',
  name: error?.name || 'Error',
  stack: error?.stack || 'no_stack',
  timestamp: new Date().toISOString(),
});

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
      const payload = createBootErrorPayload(error, isFatal, 'BOOT_GLOBAL_JS_ERROR');
      persistBootError(payload);
      console.error('[BOOT] BOOT_GLOBAL_JS_ERROR', payload);

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

const previousBootError = readPersistedBootError();
if (previousBootError) {
  logBoot('BOOT_PREVIOUS_JS_ERROR_DETECTED', previousBootError);
}

logBoot('BOOT_APP_START', {
  appName,
  notificationsBootstrapDisabled: isNotificationsBootstrapDisabled,
});

// Register notification background handler context immediately
if (isNotificationsBootstrapDisabled) {
  logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_DISABLED_BY_FLAG');
} else {
  try {
    const { registerBackgroundHandler } = require('./src/services/notificationBackgroundHandler');
    registerBackgroundHandler();
    logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_ENABLED');
  } catch (error) {
    console.warn('[index] Failed to register background handler:', error);
    logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_FAILED', {
      error: error?.message || 'unknown',
    });
  }
}

let App;
try {
  App = require('./src/App').default;
  logBoot('BOOT_APP_MODULE_READY');
} catch (error) {
  const payload = createBootErrorPayload(error, true, 'BOOT_APP_REQUIRE_FAILED');
  persistBootError(payload);
  console.error('[BOOT] BOOT_APP_REQUIRE_FAILED', payload);
  throw error;
}

AppRegistry.registerComponent(appName, () => App);
