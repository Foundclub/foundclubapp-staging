import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import GlobalBanner from '@/components/organisms/popup/GlobalBanner';

import { useAppFeedback } from '@/context/AppFeedbackContext';

const DEFAULT_BANNER_DURATION_MS = 3200;

function AppBannerHost() {
  const { activeBanner, dismissBanner } = useAppFeedback();

  useEffect(() => {
    if (!activeBanner) return undefined;
    const timeoutMs = Number(activeBanner?.durationMs) > 0
      ? Number(activeBanner.durationMs)
      : DEFAULT_BANNER_DURATION_MS;
    const timer = setTimeout(() => dismissBanner(), timeoutMs);
    return () => clearTimeout(timer);
  }, [activeBanner, dismissBanner]);

  if (!activeBanner) return null;

  return (
    <View style={[styles.wrap, styles.pointerBoxNone]}>
      <GlobalBanner
        actionLabel={activeBanner.actionLabel}
        body={activeBanner.body}
        onAction={() => {
          activeBanner.onAction?.();
          dismissBanner();
        }}
        onPress={() => {
          if (typeof activeBanner.onAction === 'function') {
            activeBanner.onAction();
          }
          dismissBanner();
        }}
        title={activeBanner.title}
        tone={activeBanner.tone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    left: 16,
    position: 'absolute',
    right: 16,
    top: 64,
    zIndex: 1180,
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
});

export default AppBannerHost;
