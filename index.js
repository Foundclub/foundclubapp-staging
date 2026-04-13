import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import {
  ENABLE_PUSH_NOTIFICATIONS,
  NOTIFICATIONS_RUNTIME_CONFIG,
} from './src/constants/runtimeFlags';
import {
  createBootErrorPayload,
  persistBootError,
  readPersistedBootError,
} from './src/utils/bootDiagnostics';

const isNotificationsBootstrapDisabled = !ENABLE_PUSH_NOTIFICATIONS;

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
  notificationsRuntime: NOTIFICATIONS_RUNTIME_CONFIG,
});

if (
  NOTIFICATIONS_RUNTIME_CONFIG.push.shouldEnableByDefault
  && !NOTIFICATIONS_RUNTIME_CONFIG.push.enabled
) {
  logBoot('BOOT_NOTIFICATIONS_EXPECTED_BUT_DISABLED', NOTIFICATIONS_RUNTIME_CONFIG);
}

// Register notification background handler context immediately
if (isNotificationsBootstrapDisabled) {
  logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_DISABLED_BY_FLAG', {
    policy: NOTIFICATIONS_RUNTIME_CONFIG.push.policy,
  });
} else {
  try {
    // eslint-disable-next-line global-require
    const { registerBackgroundHandler } = require('./src/services/notificationBackgroundHandler');
    registerBackgroundHandler();
    logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_ENABLED', {
      policy: NOTIFICATIONS_RUNTIME_CONFIG.push.policy,
    });
  } catch (error) {
    console.warn('[index] Failed to register background handler:', error);
    logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_FAILED', {
      error: error?.message || 'unknown',
      policy: NOTIFICATIONS_RUNTIME_CONFIG.push.policy,
    });
  }
}

let App;
try {
  // eslint-disable-next-line global-require
  App = require('./src/App').default;
  logBoot('BOOT_APP_MODULE_READY');
} catch (error) {
  const payload = createBootErrorPayload(error, true, 'BOOT_APP_REQUIRE_FAILED');
  persistBootError(payload);
  console.error('[BOOT] BOOT_APP_REQUIRE_FAILED', payload);
  throw error;
}

AppRegistry.registerComponent(appName, () => App);
