import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';

import { registerBackgroundHandler } from './src/services/notificationBackgroundHandler';

// Register background handler context immediately
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
