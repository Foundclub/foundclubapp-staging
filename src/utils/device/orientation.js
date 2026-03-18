import { NativeModules, Platform } from 'react-native';

const getOrientationModule = () => {
  if (Platform.OS === 'android') {
    return NativeModules?.PlanningOrientation || NativeModules?.Orientation || null;
  }

  return NativeModules?.Orientation || null;
};

const callOrientationMethod = (methodName) => {
  const orientationModule = getOrientationModule();
  const method = orientationModule?.[methodName];

  if (typeof method !== 'function') {
    return false;
  }

  method.call(orientationModule);
  return true;
};

export const lockToPortrait = () => callOrientationMethod('lockToPortrait');

export const lockToLandscape = () => callOrientationMethod('lockToLandscape');

export const unlockAllOrientations = () => (
  callOrientationMethod('unlockAllOrientations')
  || callOrientationMethod('unlockToUserPreference')
);

export const hasOrientationControl = () => Boolean(getOrientationModule());
