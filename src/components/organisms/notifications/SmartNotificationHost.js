import { useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import LeagueModalHeader from '@/components/molecules/header/LeagueModalHeader';
import MatchFinalPosterModal from '@/components/organisms/league/MatchFinalPosterModal';
import GlobalBanner from '@/components/organisms/popup/GlobalBanner';

import { navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import { ENABLE_SMART_NOTIFICATIONS } from '@/constants/runtimeFlags';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';
import { useSmartNotifications } from '@/context/SmartNotificationContext';

const AUTO_HIDE_SNACKBAR_MS = 3200;

/**
 *
 */
function SmartNotificationHost() {
  const { Colors, Fonts } = useTheme();
  const {
    activeRecap,
    activeSnackbar,
    dismissRecap,
    dismissSnackbar,
  } = useSmartNotifications();

  const isLineupReminder = activeSnackbar?.type === NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER;
  const lineupReminderPopup = usePopupEligibility(
    POPUP_IDS.SMART_LINEUP_REMINDER,
    Boolean(activeSnackbar && isLineupReminder),
    {
      cooldownKey: String(activeSnackbar?.matchId || activeSnackbar?.eventId || activeSnackbar?.dedupeKey || activeSnackbar?.notificationId || 'default'),
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const recapPopup = usePopupEligibility(
    POPUP_IDS.SMART_MATCH_RECAP,
    Boolean(activeRecap),
    {
      cooldownKey: String(activeRecap?.matchId || activeRecap?.dedupeKey || activeRecap?.notificationId || 'default'),
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const canShowLineupReminderModal = useBlockingOverlayPrompt(
    lineupReminderPopup.descriptor.id,
    lineupReminderPopup.canShow,
    lineupReminderPopup.descriptor.priority,
  );
  const canShowRecapModal = useBlockingOverlayPrompt(
    recapPopup.descriptor.id,
    recapPopup.canShow,
    recapPopup.descriptor.priority,
  );
  const isLineupReminderVisible = Boolean(activeSnackbar && isLineupReminder && lineupReminderPopup.canShow && canShowLineupReminderModal);
  const isRecapVisible = Boolean(activeRecap && recapPopup.canShow && canShowRecapModal);
  const shouldRenderNativeLineupReminder = isLineupReminderVisible && Platform.OS !== 'web';
  useBlockingOverlayLifecycle(lineupReminderPopup.descriptor.id, isLineupReminderVisible, {
    releaseDelayMs: 320,
  });
  useBlockingOverlayLifecycle(recapPopup.descriptor.id, isRecapVisible, {
    releaseDelayMs: 320,
  });

  useEffect(() => {
    if (!activeSnackbar || isLineupReminder) return undefined;
    const timer = setTimeout(() => dismissSnackbar(), AUTO_HIDE_SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [activeSnackbar, dismissSnackbar, isLineupReminder]);

  useEffect(() => {
    if (!isLineupReminderVisible) return;
    lineupReminderPopup.markShown({
      matchId: activeSnackbar?.matchId || activeSnackbar?.eventId || null,
    });
  }, [activeSnackbar?.eventId, activeSnackbar?.matchId, isLineupReminderVisible, lineupReminderPopup]);

  useEffect(() => {
    if (!isRecapVisible) return;
    recapPopup.markShown({
      matchId: activeRecap?.matchId || null,
    });
  }, [activeRecap?.matchId, isRecapVisible, recapPopup]);

  // Lineup reminder popup must stay available even when smart league snackbars are feature-flagged off.
  if (!ENABLE_SMART_NOTIFICATIONS && !isLineupReminder) return null;

  const handleOpenFromPayload = (payload) => {
    const destination = resolveNotificationDestination(payload);
    const route = destination?.route || RouteNames.NotificationList;
    const params = destination?.params || {};
    const ok = navigate(route, params);
    if (ok === false) {
      navigate(RouteNames.NotificationList);
    }
  };

  return (
    <>
      {activeSnackbar && !isLineupReminder ? (
        <View style={styles.snackbarWrap}>
          <GlobalBanner
            body={activeSnackbar.body || 'Nouvelle mise à jour.'}
            onPress={() => {
              handleOpenFromPayload(activeSnackbar);
              dismissSnackbar();
            }}
            title={activeSnackbar.title || 'Notification league'}
            tone="league"
          />
        </View>
      ) : null}

      {isLineupReminderVisible && Platform.OS === 'web' ? (
        <View
          style={{
            bottom: 0,
            left: 0,
            position: 'fixed',
            right: 0,
            top: 0,
            zIndex: 1070,
          }}
        >
          <View style={styles.lineupOverlay}>
            <Pressable
              onPress={() => {
                lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
                dismissSnackbar();
              }}
              style={styles.lineupOverlayTapArea}
            />
            <View style={[styles.lineupCard, { borderColor: Colors.primary500 }]}>
              <LeagueModalHeader
                description={activeSnackbar.body || 'Ton match est dans 2 jours. Souhaites-te publier la composition maintenant ?'}
                title={activeSnackbar.title || 'Publier la compo'}
              />

              <View style={styles.lineupActions}>
                <Pressable
                  onPress={() => {
                    lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
                    dismissSnackbar();
                  }}
                  style={[styles.lineupSecondaryButton, { borderColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Plus tard</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    lineupReminderPopup.trackEvent('accepted', {
                      matchId: activeSnackbar?.matchId || activeSnackbar?.eventId || null,
                    });
                    lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
                    handleOpenFromPayload(activeSnackbar);
                    dismissSnackbar();
                  }}
                  style={[styles.lineupPrimaryButton, { backgroundColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Publier la compo</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {shouldRenderNativeLineupReminder ? (
        <Modal
          animationType="fade"
          onRequestClose={() => {
            lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
            dismissSnackbar();
          }}
          statusBarTranslucent
          transparent
          visible
        >
          <View style={styles.lineupOverlay}>
            <Pressable
              onPress={() => {
                lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
                dismissSnackbar();
              }}
              style={styles.lineupOverlayTapArea}
            />
            <View style={[styles.lineupCard, { borderColor: Colors.primary500 }]}>
              <LeagueModalHeader
                description={activeSnackbar.body || 'Ton match est dans 2 jours. Souhaites-te publier la composition maintenant ?'}
                title={activeSnackbar.title || 'Publier la compo'}
              />

              <View style={styles.lineupActions}>
                <Pressable
                  onPress={() => {
                    lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
                    dismissSnackbar();
                  }}
                  style={[styles.lineupSecondaryButton, { borderColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Plus tard</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    lineupReminderPopup.trackEvent('accepted', {
                      matchId: activeSnackbar?.matchId || activeSnackbar?.eventId || null,
                    });
                    lineupReminderPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
                    handleOpenFromPayload(activeSnackbar);
                    dismissSnackbar();
                  }}
                  style={[styles.lineupPrimaryButton, { backgroundColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Publier la compo</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <MatchFinalPosterModal
        onClose={() => {
          recapPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
          dismissRecap();
        }}
        onOpenDetails={() => {
          recapPopup.trackEvent('accepted', {
            matchId: activeRecap?.matchId || null,
          });
          recapPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
          handleOpenFromPayload(activeRecap);
          dismissRecap();
        }}
        onRelaunchSearch={() => {
          recapPopup.trackEvent('accepted', {
            action: 'relaunch_search',
            matchId: activeRecap?.matchId || null,
          });
          recapPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
          navigate(RouteNames.LeagueMatchTab);
          dismissRecap();
        }}
        payload={activeRecap}
        visible={isRecapVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  lineupActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 20,
  },
  lineupCard: {
    backgroundColor: 'rgba(19, 60, 80, 0.98)',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: '88%',
    zIndex: 2,
  },
  lineupDescription: {
    marginTop: 8,
  },
  lineupOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  lineupOverlayTapArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  lineupPrimaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  lineupSecondaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  snackbarWrap: {
    left: 12,
    position: 'absolute',
    right: 12,
    top: 68,
    zIndex: 45,
  },
});

export default SmartNotificationHost;
