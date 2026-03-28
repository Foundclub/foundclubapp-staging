import { Platform } from 'react-native';
import { getDeviceId as getNativeDeviceId, getVersion } from 'react-native-device-info';

export const getDeviceId = () => getNativeDeviceId();

export const getAppVersion = () => getVersion();

export const getDeviceInfo = () => ({
  appVersion: getAppVersion(),
  deviceId: getDeviceId(),
  isDesktop: false,
  platform: Platform.OS,
});

export const isDesktop = () => false;

export default {
  getAppVersion,
  getDeviceId,
  getDeviceInfo,
  isDesktop,
};
