import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const navigate = (name, params) => {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate(name, params);
  return true;
};

export const getCurrentRouteName = () => {
  if (!navigationRef.isReady()) return null;
  return navigationRef.getCurrentRoute()?.name || null;
};
