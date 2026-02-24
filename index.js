import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';
import { registerBackgroundHandler } from './src/services/notificationBackgroundHandler';

// Register background handler context immediately
try {
  registerBackgroundHandler();
} catch (error) {
  // Never crash app startup because of notification bootstrap.
  console.warn('[index] Failed to register background handler:', error);
}

AppRegistry.registerComponent(appName, () => App);
