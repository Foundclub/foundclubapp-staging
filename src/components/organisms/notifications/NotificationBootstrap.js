import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import PreDemandeNotifications from '@/components/organisms/notifications/PreDemandeNotifications';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';

import { navigate } from '@/navigation/navigationService';

import { getNotificationRuntimeSnapshot } from '@/services/notifications/notificationRuntimeSnapshot';

import { formatBootMeta } from '@/utils/performance/bootPerformance';

import {
  ENABLE_PUSH_NOTIFICATIONS,
  ENABLE_SMART_NOTIFICATIONS,
  NOTIFICATIONS_BOOTSTRAP_POLICY,
  NOTIFICATIONS_RUNTIME_CONFIG,
} from '@/constants/runtimeFlags';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import { useSmartNotifications } from '@/context/SmartNotificationContext';
import useNotifications from '@/hooks/useNotifications';

const isNotificationsBootstrapDisabled = !ENABLE_PUSH_NOTIFICATIONS;
const shouldExposeNotificationRuntimeSnapshot = NOTIFICATIONS_RUNTIME_CONFIG.appEnv !== 'production';

/**
 *
 */
function NotificationBootstrapDisabled() {
  React.useEffect(() => {
    console.info(`[BOOT] BOOT_NOTIFICATIONS_COMPONENT_SKIPPED ${formatBootMeta({
      platform: Platform.OS,
      policy: NOTIFICATIONS_BOOTSTRAP_POLICY,
      ...(shouldExposeNotificationRuntimeSnapshot ? { snapshot: getNotificationRuntimeSnapshot() } : {}),
    })}`);
  }, []);

  return null;
}

/**
 *
 */
function NotificationBootstrapEnabled() {
  const { t } = useTranslation();
  const { consumeNotification } = useSmartNotifications();

  React.useEffect(() => {
    console.info(`[BOOT] BOOT_NOTIFICATIONS_COMPONENT_READY ${formatBootMeta({
      platform: Platform.OS,
      runtime: NOTIFICATIONS_RUNTIME_CONFIG,
      ...(shouldExposeNotificationRuntimeSnapshot ? { snapshot: getNotificationRuntimeSnapshot() } : {}),
    })}`);
  }, []);

  const {
    activerNotifications,
    calendarPrompt,
  } = useNotifications({
    navigate,
    onSmartNotification: ENABLE_SMART_NOTIFICATIONS ? consumeNotification : undefined,
  });

  const canShowCalendarPrompt = useBlockingOverlayPrompt(
    calendarPrompt.descriptor.id,
    calendarPrompt.canShow,
    calendarPrompt.descriptor.priority,
  );
  const isCalendarPromptVisible = Boolean(calendarPrompt.canShow && canShowCalendarPrompt);
  useBlockingOverlayLifecycle(calendarPrompt.descriptor.id, isCalendarPromptVisible, {
    releaseDelayMs: 320,
  });

  React.useEffect(() => {
    if (!isCalendarPromptVisible) return;
    calendarPrompt.onVisible?.();
  }, [calendarPrompt, isCalendarPromptVisible]);

  return (
    <>
      {/* NOTIF-PREDEMANDE (29/10/2026) — notre ecran avant la fenetre systeme. */}
      <PreDemandeNotifications activerNotifications={activerNotifications} />

      <GlobalPromptModal
        body={calendarPrompt.body}
        inlineOnAndroid
        onRequestClose={calendarPrompt.onDismiss}
        primaryAction={{
          label: t('notificationBootstrap.calendar.add', 'Ajouter au calendrier'),
          onPress: calendarPrompt.onAccept,
        }}
        secondaryAction={{
          label: t('notificationBootstrap.later', 'Plus tard'),
          onPress: calendarPrompt.onDismiss,
        }}
        title={calendarPrompt.title}
        tone="league"
        visible={isCalendarPromptVisible}
      />
    </>
  );
}

/**
 *
 */
function NotificationBootstrap() {
  if (isNotificationsBootstrapDisabled) {
    return <NotificationBootstrapDisabled />;
  }

  return <NotificationBootstrapEnabled />;
}

export default NotificationBootstrap;
