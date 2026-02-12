import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSmartNotifications } from '@/context/SmartNotificationContext';
import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';
import { RouteNames } from '@/navigation/routeNames';
import { navigate } from '@/navigation/navigationService';
import useTheme from '@/theme/themeContext';
import MatchRecapBanner from '@/components/organisms/league/MatchRecapBanner';
import MatchRecapSheet from '@/components/organisms/league/MatchRecapSheet';

const AUTO_HIDE_SNACKBAR_MS = 3200;

const resolveNavigation = (payload = {}) => {
  const type = payload.type;
  const chatId = payload.chatId || payload.conversationId;
  const matchId = payload.matchId;
  if (payload.ctaRoute) {
    return {
      params: payload.ctaParams || {},
      route: payload.ctaRoute,
    };
  }

  if (
    type === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED
    || type === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED
    || type === NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED
  ) {
    if (chatId) {
      return { params: { chatId }, route: RouteNames.Conversation };
    }
    return { params: {}, route: RouteNames.LeagueMatchTab };
  }

  if (type === NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED) {
    if (matchId) {
      return {
        params: { matchId },
        route: RouteNames.PastMatchDetails,
      };
    }
    return { params: {}, route: RouteNames.LeagueMatchTab };
  }

  return { params: {}, route: RouteNames.LeagueMatchTab };
};

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
    openRecapSheet,
    recapSheetVisible,
  } = useSmartNotifications();

  if (!smartNotifEnabled) return null;

  useEffect(() => {
    if (!activeSnackbar) return undefined;
    const timer = setTimeout(() => dismissSnackbar(), AUTO_HIDE_SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [activeSnackbar, dismissSnackbar]);

  const handleOpenFromPayload = (payload) => {
    const destination = resolveNavigation(payload);
    const ok = navigate(destination.route, destination.params);
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

      <MatchRecapBanner
        onDismiss={dismissRecap}
        onOpenDetails={openRecapSheet}
        payload={activeRecap}
        visible={Boolean(activeRecap)}
      />

      <MatchRecapSheet
        onClose={dismissRecap}
        onOpenMatch={() => {
          handleOpenFromPayload(activeRecap);
          dismissRecap();
        }}
        onRelaunchSearch={() => {
          navigate(RouteNames.LeagueMatchTab);
          dismissRecap();
        }}
        payload={activeRecap}
        visible={Boolean(activeRecap) && recapSheetVisible}
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
