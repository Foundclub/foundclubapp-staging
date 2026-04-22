import React from 'react';
import { Platform } from 'react-native';

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
  const { consumeNotification } = useSmartNotifications();

  React.useEffect(() => {
    console.info(`[BOOT] BOOT_NOTIFICATIONS_COMPONENT_READY ${formatBootMeta({
      platform: Platform.OS,
      runtime: NOTIFICATIONS_RUNTIME_CONFIG,
      ...(shouldExposeNotificationRuntimeSnapshot ? { snapshot: getNotificationRuntimeSnapshot() } : {}),
    })}`);
  }, []);

  const {
    calendarPrompt,
    pushPermissionPrompt,
  } = useNotifications({
    navigate,
    onSmartNotification: ENABLE_SMART_NOTIFICATIONS ? consumeNotification : undefined,
  });

  const canShowCalendarPrompt = useBlockingOverlayPrompt(
    calendarPrompt.descriptor.id,
    calendarPrompt.canShow,
    calendarPrompt.descriptor.priority,
  );
  const canShowPushPrompt = useBlockingOverlayPrompt(
    pushPermissionPrompt.descriptor.id,
    pushPermissionPrompt.canShow,
    pushPermissionPrompt.descriptor.priority,
  );
  const isCalendarPromptVisible = Boolean(calendarPrompt.canShow && canShowCalendarPrompt);
  const isPushPromptVisible = Boolean(pushPermissionPrompt.canShow && canShowPushPrompt);
  useBlockingOverlayLifecycle(calendarPrompt.descriptor.id, isCalendarPromptVisible, {
    releaseDelayMs: 320,
  });
  useBlockingOverlayLifecycle(pushPermissionPrompt.descriptor.id, isPushPromptVisible, {
    releaseDelayMs: 320,
  });

  React.useEffect(() => {
    if (!isCalendarPromptVisible) return;
    calendarPrompt.onVisible?.();
  }, [calendarPrompt, isCalendarPromptVisible]);

  React.useEffect(() => {
    if (!isPushPromptVisible) return;
    pushPermissionPrompt.onVisible?.();
  }, [isPushPromptVisible, pushPermissionPrompt]);

  return (
    <>
      <GlobalPromptModal
        body={pushPermissionPrompt.body}
        onRequestClose={pushPermissionPrompt.onDismiss}
        primaryAction={{
          label: 'Activer',
          onPress: pushPermissionPrompt.onAccept,
        }}
        secondaryAction={{
          label: 'Plus tard',
          onPress: pushPermissionPrompt.onDismiss,
        }}
        supportingText="Vous pourrez toujours modifier ce choix plus tard dans les réglages."
        title={pushPermissionPrompt.title}
        visible={isPushPromptVisible}
      />

      <GlobalPromptModal
        body={calendarPrompt.body}
        onRequestClose={calendarPrompt.onDismiss}
        primaryAction={{
          label: 'Ajouter au calendrier',
          onPress: calendarPrompt.onAccept,
        }}
        secondaryAction={{
          label: 'Plus tard',
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
