export const bootstrap = async () => {};
export const getToken = async () => null;
export const openFromPayload = async () => {};
export const requestPermission = async () => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};
export const subscribeForeground = () => () => {};

export default {
  bootstrap,
  getToken,
  openFromPayload,
  requestPermission,
  subscribeForeground,
};
