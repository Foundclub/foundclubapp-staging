import { StyleSheet, View } from 'react-native';

import AppCelebrationBanner from '@/components/organisms/popup/AppCelebrationBanner';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/**
 *
 */
function AppBannerHost() {
  const { activeBanner, dismissBanner } = useAppFeedback();

  if (!activeBanner) return null;

  return (
    <View style={[styles.wrap, styles.pointerBoxNone]}>
      <AppCelebrationBanner
        actionLabel={activeBanner.actionLabel}
        body={activeBanner.body}
        durationMs={activeBanner.durationMs}
        eyebrow={activeBanner.eyebrow}
        onAction={() => {
          activeBanner.onAction?.();
          dismissBanner();
        }}
        onExited={dismissBanner}
        onPress={() => {
          if (typeof activeBanner.onAction === 'function') {
            activeBanner.onAction();
          }
          dismissBanner();
        }}
        progressBar={activeBanner.progressBar !== false}
        title={activeBanner.title}
        tone={activeBanner.tone}
        variant={activeBanner.variant}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
  wrap: {
    left: 16,
    position: 'absolute',
    right: 16,
    top: 64,
    zIndex: 1180,
  },
});

export default AppBannerHost;
