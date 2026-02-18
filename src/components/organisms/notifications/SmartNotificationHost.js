import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSmartNotifications } from '@/context/SmartNotificationContext';
import { RouteNames } from '@/navigation/routeNames';
import { navigate } from '@/navigation/navigationService';
import useTheme from '@/theme/themeContext';
import MatchFinalPosterModal from '@/components/organisms/league/MatchFinalPosterModal';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

const AUTO_HIDE_SNACKBAR_MS = 3200;

const SmartNotificationHost = () => {
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

  if (!smartNotifEnabled) return null;

  useEffect(() => {
    if (!activeSnackbar) return undefined;
    const timer = setTimeout(() => dismissSnackbar(), AUTO_HIDE_SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [activeSnackbar, dismissSnackbar]);

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
      {activeSnackbar ? (
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
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]} numberOfLines={1}>
              {activeSnackbar.title || 'Notification League'}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral100 }]} numberOfLines={2}>
              {activeSnackbar.body || 'Nouvelle mise a jour.'}
            </Text>
          </Pressable>
        </View>
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
};

const styles = StyleSheet.create({
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
