// @ts-nocheck
import i18next from 'i18next';
import { Alert } from 'react-native';

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

/**
 * RETOURS-TESTEUR-2 (06/11/2026, M0232, décision du chef « B ») — les célébrations qui
 * demandent qu'on les LISE : une fenêtre à fermer soi-même au lieu d'un bandeau de 4 s.
 * La demande d'une séance à la Ville : la séance existe, mais la mairie peut la refuser.
 */
const EN_FENETRE = new Set(['event_city_request_sent']);

const ouvrirLaFenetre = (payload) => {
  const message = [
    payload.body,
    i18next.t(
      'collectiviteDemandes.decision.siRefusAnnulee',
      'Si la mairie refuse, la séance sera annulée.',
    ),
  ].filter(Boolean).join(' ');
  Alert.alert(payload.title, message, [
    {
      style: 'cancel',
      text: i18next.t('collectiviteDemandes.club.compris', 'J’ai compris'),
    },
    ...(payload.actionLabel && payload.onAction
      ? [{ onPress: payload.onAction, text: payload.actionLabel }]
      : []),
  ]);
  return payload;
};

export const celebrate = (actionKey, context = {}, options = {}) => {
  const payload = buildCelebrationPayload(actionKey, context, options);
  if (!payload) return null;
  if (EN_FENETRE.has(actionKey)) return ouvrirLaFenetre(payload);
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
