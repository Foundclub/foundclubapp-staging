import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';
import { registerBackgroundHandler } from './src/services/notificationBackgroundHandler';

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

// Register background handler context immediately
try {
  registerBackgroundHandler();
  logBoot('BOOT_BACKGROUND_HANDLER_READY');
} catch (error) {
  // Never crash app startup because of notification bootstrap.
  console.warn('[index] Failed to register background handler:', error);
  logBoot('BOOT_BACKGROUND_HANDLER_FAILED', {
    error: error?.message || 'unknown',
  });
}

AppRegistry.registerComponent(appName, () => App);
