// @ts-nocheck
import {
  buildCelebrationPayload,
  inferCelebrationActionFromNotification,
} from '@/services/celebrations/celebrationCatalog';

/** @type {Set<(payload: Record<string, any>) => void>} */
const celebrationListeners = new Set();

export const subscribeToCelebrations = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  celebrationListeners.add(listener);
  return () => {
    celebrationListeners.delete(listener);
  };
};

export const emitCelebrationBanner = (payload) => {
  if (!payload) return null;
  if (__DEV__) {
    console.info('[célébrations] emit', {
      actionKey: payload?.actionKey,
      title: payload?.title,
      variant: payload?.variant,
    });
  }
  celebrationListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_error) {
      // noop - never block the app on celebration UI
    }
  });
  return payload;
};

export const celebrate = (actionKey, context = {}, options = {}) => {
  const payload = buildCelebrationPayload(actionKey, context, options);
  if (!payload) return null;
  return emitCelebrationBanner(payload);
};

export const emitCelebrationFromNotificationPayload = (notificationPayload = {}) => {
  const normalizedPayload = notificationPayload && typeof notificationPayload === 'object'
    ? notificationPayload
    : {};
  const actionKey = String(
    normalizedPayload?.celebrationKey
    || inferCelebrationActionFromNotification(normalizedPayload?.type, normalizedPayload),
  ).trim();
  if (!actionKey) return null;

  return celebrate(actionKey, normalizedPayload, {
    actionLabel: normalizedPayload?.celebrationActionLabel,
    body: normalizedPayload?.celebrationBody || normalizedPayload?.notificationBody || normalizedPayload?.body,
    dedupeKey: normalizedPayload?.celebrationDedupeKey || normalizedPayload?.dedupeKey,
    durationMs: normalizedPayload?.celebrationDurationMs,
    eyebrow: normalizedPayload?.celebrationEyebrow,
    priority: normalizedPayload?.celebrationPriority,
    source: 'remote',
    title: normalizedPayload?.celebrationTitle || normalizedPayload?.notificationTitle || normalizedPayload?.title,
    tone: normalizedPayload?.celebrationTone,
    variant: normalizedPayload?.celebrationVariant,
  });
};
