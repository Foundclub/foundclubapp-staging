import { getApp } from '@react-native-firebase/app';
import { Platform } from 'react-native';
import { getBundleId } from 'react-native-device-info';

import {
  APP_RUNTIME_ENV,
  ENABLE_PUSH_NOTIFICATIONS,
  ENABLE_SMART_NOTIFICATIONS,
  NOTIFICATIONS_BOOTSTRAP_POLICY,
  SMART_NOTIFICATIONS_POLICY,
} from '@/constants/runtimeFlags';

export const getNotificationRuntimeSnapshot = () => {
  let firebaseOptions = {};

  try {
    firebaseOptions = getApp()?.options || {};
  } catch (_error) {
    firebaseOptions = {};
  }

  return {
    appEnv: APP_RUNTIME_ENV,
    applicationId: getBundleId(),
    firebaseAppId: firebaseOptions?.appId || null,
    firebaseProjectId: firebaseOptions?.projectId || null,
    platform: Platform.OS,
    pushEnabled: ENABLE_PUSH_NOTIFICATIONS,
    pushPolicy: NOTIFICATIONS_BOOTSTRAP_POLICY,
    smartEnabled: ENABLE_SMART_NOTIFICATIONS,
    smartPolicy: SMART_NOTIFICATIONS_POLICY,
  };
};

export default getNotificationRuntimeSnapshot;
