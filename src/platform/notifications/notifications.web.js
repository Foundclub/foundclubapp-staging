import { getApp, getApps, initializeApp } from 'firebase/app';

import { buildWebPath } from '@/navigation/webRoutes';
import {
  normalizeNotificationPayload,
  resolveNotificationDestination,
} from '@/utils/notifications/notificationNavigation';

const SERVICE_WORKER_URL = '/firebase-messaging-sw.js';
const NOTIFICATION_PAYLOAD_QUERY_KEY = 'fc_notification_payload';
const SERVICE_WORKER_CLICK_EVENT = 'fc-notification-click';

const foregroundSubscribers = new Set();

let bootstrapPromise = null;
let serviceWorkerRegistrationPromise = null;
let messagingModulePromise = null;
let messagingRuntimePromise = null;
let hasAttachedServiceWorkerBridge = false;
let hasAttachedForegroundSubscription = false;
let hasLoggedMissingConfig = false;

const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const pushNotificationsEnabled = parseBooleanFlag(process.env.FC_ENABLE_PUSH_NOTIFICATIONS || '');
const notificationsBootstrapDisabled = parseBooleanFlag(process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP || '');

const getFirebaseConfig = () => ({
  apiKey: String(process.env.WEB_FIREBASE_API_KEY || ''),
  appId: String(process.env.WEB_FIREBASE_APP_ID || ''),
  authDomain: String(process.env.WEB_FIREBASE_AUTH_DOMAIN || ''),
  messagingSenderId: String(process.env.WEB_FIREBASE_MESSAGING_SENDER_ID || ''),
  projectId: String(process.env.WEB_FIREBASE_PROJECT_ID || ''),
  storageBucket: String(process.env.WEB_FIREBASE_STORAGE_BUCKET || ''),
});

const getWebVapidKey = () => String(process.env.WEB_FIREBASE_VAPID_KEY || '').trim();

const isFirebaseConfigured = () => {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey
    && config.appId
    && config.authDomain
    && config.projectId
    && config.messagingSenderId,
  );
};

const logInfo = (message, meta = undefined) => {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[web-notifications]', message, meta || '');
  }
};

const logWarn = (message, meta = undefined) => {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[web-notifications]', message, meta || '');
  }
};

const normalizeIncomingPayload = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return normalizeNotificationPayload(rawPayload);
  }

  const basePayload = rawPayload?.data && typeof rawPayload.data === 'object'
    ? { ...rawPayload.data }
    : { ...rawPayload };

  if (rawPayload?.notification?.title && !basePayload.notificationTitle) {
    basePayload.notificationTitle = rawPayload.notification.title;
  }

  if (rawPayload?.notification?.body && !basePayload.notificationBody) {
    basePayload.notificationBody = rawPayload.notification.body;
  }

  return normalizeNotificationPayload(basePayload);
};

const getFirebaseApp = () => {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getFirebaseConfig());
};

const getMessagingModule = async () => {
  if (!messagingModulePromise) {
    messagingModulePromise = import('firebase/messaging');
  }

  return messagingModulePromise;
};

const registerServiceWorker = async () => {
  if (serviceWorkerRegistrationPromise) {
    return serviceWorkerRegistrationPromise;
  }

  serviceWorkerRegistrationPromise = (async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return null;
    }

    if (!('serviceWorker' in navigator)) {
      logWarn('Service worker indisponible dans ce navigateur.');
      return null;
    }

    try {
      return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
    } catch (error) {
      logWarn('Impossible d enregistrer le service worker des notifications.', error?.message || error);
      return null;
    }
  })();

  return serviceWorkerRegistrationPromise;
};

const navigateToPath = (path) => {
  if (!path || typeof window === 'undefined') return;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath !== path) {
    window.history.pushState({}, '', path);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
};

const readPayloadFromQueryString = () => {
  if (typeof window === 'undefined') return null;

  const currentUrl = new URL(window.location.href);
  const rawPayload = currentUrl.searchParams.get(NOTIFICATION_PAYLOAD_QUERY_KEY);
  if (!rawPayload) return null;

  currentUrl.searchParams.delete(NOTIFICATION_PAYLOAD_QUERY_KEY);
  window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);

  try {
    return JSON.parse(rawPayload);
  } catch (_error) {
    logWarn('Payload de notification web invalide dans l URL.');
    return null;
  }
};

const emitForegroundPayload = (payload) => {
  const normalizedPayload = normalizeIncomingPayload(payload);

  foregroundSubscribers.forEach((handler) => {
    try {
      handler(normalizedPayload);
    } catch (error) {
      logWarn('Erreur dans un handler de notification foreground.', error?.message || error);
    }
  });
};

const attachServiceWorkerBridge = () => {
  if (hasAttachedServiceWorkerBridge) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.type !== SERVICE_WORKER_CLICK_EVENT) return;
    void openFromPayload(event.data.payload);
  });

  hasAttachedServiceWorkerBridge = true;
};

const ensureMessagingRuntime = async () => {
  if (messagingRuntimePromise) {
    return messagingRuntimePromise;
  }

  messagingRuntimePromise = (async () => {
    if (!isFirebaseConfigured()) {
      if (!hasLoggedMissingConfig) {
        hasLoggedMissingConfig = true;
        logWarn('Notifications web desactivees: configuration Firebase Web incomplete.');
      }
      return null;
    }

    const [messagingModule, serviceWorkerRegistration] = await Promise.all([
      getMessagingModule(),
      registerServiceWorker(),
    ]);

    const supported = await messagingModule.isSupported().catch(() => false);
    if (!supported) {
      logWarn('Firebase Messaging n est pas pris en charge dans ce navigateur.');
      return null;
    }

    const messaging = messagingModule.getMessaging(getFirebaseApp());

    if (!hasAttachedForegroundSubscription) {
      messagingModule.onMessage(messaging, (payload) => {
        emitForegroundPayload(payload);
      });
      hasAttachedForegroundSubscription = true;
    }

    return {
      getTokenFromFirebase: messagingModule.getToken,
      messaging,
      serviceWorkerRegistration,
    };
  })();

  return messagingRuntimePromise;
};

export const bootstrap = async () => {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    attachServiceWorkerBridge();

    const queryPayload = readPayloadFromQueryString();
    if (queryPayload) {
      await openFromPayload(queryPayload);
    }

    if (notificationsBootstrapDisabled) {
      logInfo('Bootstrap notifications web explicitement desactive.');
      return { status: 'disabled' };
    }

    if (!pushNotificationsEnabled) {
      logInfo('Bootstrap notifications web inactif tant que FC_ENABLE_PUSH_NOTIFICATIONS est faux.');
      return { status: 'disabled' };
    }

    await ensureMessagingRuntime();
    return { status: 'ready' };
  })();

  return bootstrapPromise;
};

export const getToken = async () => {
  const hasPermission = await requestPermission();
  if (!hasPermission) return null;

  const vapidKey = getWebVapidKey();
  if (!vapidKey) {
    logWarn('Impossible d obtenir un token push web: WEB_FIREBASE_VAPID_KEY manquant.');
    return null;
  }

  const messagingRuntime = await ensureMessagingRuntime();
  if (!messagingRuntime?.messaging || !messagingRuntime?.serviceWorkerRegistration) {
    return null;
  }

  try {
    return await messagingRuntime.getTokenFromFirebase(messagingRuntime.messaging, {
      serviceWorkerRegistration: messagingRuntime.serviceWorkerRegistration,
      vapidKey,
    });
  } catch (error) {
    logWarn('Impossible d obtenir le token push web.', error?.message || error);
    return null;
  }
};

export const openFromPayload = async (payload) => {
  const normalizedPayload = normalizeIncomingPayload(payload);
  const destination = resolveNotificationDestination(normalizedPayload);

  if (!destination?.route) {
    logWarn('Aucune destination resolue pour cette notification.', normalizedPayload?.type || normalizedPayload);
    return null;
  }

  const path = buildWebPath(destination.route, destination.params || {});
  navigateToPath(path);
  return path;
};

export const requestPermission = async () => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const subscribeForeground = (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }

  foregroundSubscribers.add(handler);
  void bootstrap();

  return () => {
    foregroundSubscribers.delete(handler);
  };
};

export default {
  bootstrap,
  getToken,
  openFromPayload,
  requestPermission,
  subscribeForeground,
};
