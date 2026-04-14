import { Platform } from 'react-native';

import {
  ENABLE_PUSH_NOTIFICATIONS,
  ENABLE_SMART_NOTIFICATIONS,
  NOTIFICATIONS_BOOTSTRAP_POLICY,
  NOTIFICATIONS_RUNTIME_CONFIG,
  SMART_NOTIFICATIONS_POLICY,
} from '@/constants/runtimeFlags';

export const getNotificationRuntimeSnapshot = () => ({
  appEnv: NOTIFICATIONS_RUNTIME_CONFIG.appEnv,
  applicationId: 'unknown',
  firebaseAppId: null,
  firebaseProjectId: null,
  platform: Platform.OS,
  pushEnabled: ENABLE_PUSH_NOTIFICATIONS,
  pushPolicy: NOTIFICATIONS_BOOTSTRAP_POLICY,
  smartEnabled: ENABLE_SMART_NOTIFICATIONS,
  smartPolicy: SMART_NOTIFICATIONS_POLICY,
});

export default getNotificationRuntimeSnapshot;
