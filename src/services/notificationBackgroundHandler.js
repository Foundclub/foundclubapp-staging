import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';

// This handler must be outside of the React lifecycle to handle background/quit state messages
export const registerBackgroundHandler = () => {
  const messagingInstance = getMessaging(getApp());
  
  setBackgroundMessageHandler(messagingInstance, async (remoteMessage) => {
    console.log('[FCM] Background/Quit Notification received:', remoteMessage);
    // You can perform background tasks here if needed (e.g. updating local storage)
    // Note: If the payload contains a 'notification' block, Android automatically displays it.
    // This handler is mainly for data-processing or overriding behavior.
    return Promise.resolve();
  });
};
