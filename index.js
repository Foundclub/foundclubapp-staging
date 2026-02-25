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

logBoot('BOOT_APP_START', { appName });

// Register notification background handler context immediately
try {
  registerBackgroundHandler();
  logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_ENABLED');
} catch (error) {
  console.warn('[index] Failed to register background handler:', error);
  logBoot('BOOT_NOTIFICATIONS_BOOTSTRAP_FAILED', {
    error: error?.message || 'unknown',
  });
}

AppRegistry.registerComponent(appName, () => App);
