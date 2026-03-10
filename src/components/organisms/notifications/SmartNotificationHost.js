import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import MatchFinalPosterModal from '@/components/organisms/league/MatchFinalPosterModal';

import { navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import { useSmartNotifications } from '@/context/SmartNotificationContext';

const AUTO_HIDE_SNACKBAR_MS = 3200;

/**
 *
 */
function SmartNotificationHost() {
  const smartNotifEnabled = (() => {
    const raw = process.env.LEAGUE_SMART_NOTIF_V1;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw.trim().toLowerCase() === 'true';
    }
    return __DEV__;
  })();
  const { Colors, Fonts } = useTheme();
  const {
    activeRecap,
    activeSnackbar,
    dismissRecap,
    dismissSnackbar,
  } = useSmartNotifications();

  const isLineupReminder = activeSnackbar?.type === NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER;

  useEffect(() => {
    if (!activeSnackbar || isLineupReminder) return undefined;
    const timer = setTimeout(() => dismissSnackbar(), AUTO_HIDE_SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [activeSnackbar, dismissSnackbar, isLineupReminder]);

  // Lineup reminder popup must stay available even when smart league snackbars are feature-flagged off.
  if (!smartNotifEnabled && !isLineupReminder) return null;

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
          <Pressable
            onPress={() => {
              handleOpenFromPayload(activeSnackbar);
              dismissSnackbar();
            }}
            style={[
              styles.snackbar,
              {
                backgroundColor: 'rgba(10, 28, 43, 0.96)',
                borderColor: Colors.primary500,
              },
            ]}
          >
            <Text numberOfLines={1} style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              {activeSnackbar.title || 'Notification League'}
            </Text>
            <Text numberOfLines={2} style={[Fonts.p3, { color: Colors.neutral100 }]}>
              {activeSnackbar.body || 'Nouvelle mise a jour.'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {activeSnackbar && isLineupReminder ? (
        <Modal
          animationType="fade"
          onRequestClose={dismissSnackbar}
          statusBarTranslucent
          transparent
          visible
        >
          <View style={styles.lineupOverlay}>
            <Pressable onPress={dismissSnackbar} style={styles.lineupOverlayTapArea} />
            <View style={[styles.lineupCard, { borderColor: Colors.primary500 }]}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
                {activeSnackbar.title || 'Publier la compo'}
              </Text>
              <Text style={[Fonts.p2, styles.lineupDescription, { color: Colors.neutral100 }]}>
                {activeSnackbar.body || 'Votre match est dans 2 jours. Souhaitez-vous publier la composition maintenant ?'}
              </Text>

              <View style={styles.lineupActions}>
                <Pressable
                  onPress={dismissSnackbar}
                  style={[styles.lineupSecondaryButton, { borderColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Plus tard</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
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
        onClose={dismissRecap}
        onOpenDetails={() => {
          handleOpenFromPayload(activeRecap);
          dismissRecap();
        }}
        onRelaunchSearch={() => {
          navigate(RouteNames.LeagueMatchTab);
          dismissRecap();
        }}
        payload={activeRecap}
        visible={Boolean(activeRecap)}
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
  snackbar: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
