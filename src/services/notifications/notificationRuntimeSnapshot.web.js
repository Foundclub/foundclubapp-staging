import {
  APP_RUNTIME_ENV,
  ENABLE_PUSH_NOTIFICATIONS,
  ENABLE_SMART_NOTIFICATIONS,
  NOTIFICATIONS_BOOTSTRAP_POLICY,
  SMART_NOTIFICATIONS_POLICY,
} from '@/constants/runtimeFlags';

export const getNotificationRuntimeSnapshot = () => ({
  appEnv: APP_RUNTIME_ENV,
  applicationId: 'web',
  firebaseAppId: null,
  firebaseProjectId: null,
  platform: 'web',
  pushEnabled: ENABLE_PUSH_NOTIFICATIONS,
  pushPolicy: NOTIFICATIONS_BOOTSTRAP_POLICY,
  smartEnabled: ENABLE_SMART_NOTIFICATIONS,
  smartPolicy: SMART_NOTIFICATIONS_POLICY,
});

export default getNotificationRuntimeSnapshot;
