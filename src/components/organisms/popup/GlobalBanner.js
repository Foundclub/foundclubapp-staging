import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const resolveBannerPalette = (tone, Colors) => {
  switch (tone) {
    case 'error':
      return {
        accent: Colors.error500,
        background: 'rgba(54, 17, 24, 0.97)',
        border: 'rgba(255, 40, 79, 0.34)',
      };
    case 'league':
      return {
        accent: Colors.gold500,
        background: 'rgba(20, 33, 45, 0.97)',
        border: 'rgba(255, 215, 0, 0.34)',
      };
    case 'success':
      return {
        accent: Colors.success500,
        background: 'rgba(8, 40, 33, 0.97)',
        border: 'rgba(39, 214, 163, 0.34)',
      };
    default:
      return {
        accent: Colors.primary500,
        background: 'rgba(10, 28, 43, 0.97)',
        border: 'rgba(1, 179, 244, 0.34)',
      };
  }
};

/**
 * @param {{
 *   actionLabel?: string;
 *   body?: string;
 *   onAction?: (() => void) | null;
 *   onPress?: (() => void) | null;
 *   title: string;
 *   tone?: 'success' | 'error' | 'info' | 'league';
 * }} props
 */
function GlobalBanner({
  actionLabel,
  body,
  onAction,
  onPress,
  title,
  tone = 'info',
}) {
  const { Colors, Fonts } = useTheme();
  const palette = resolveBannerPalette(tone, Colors);

  return (
    <Pressable
      onPress={onPress || undefined}
      style={[
        styles.banner,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Text numberOfLines={1} style={[Fonts.p3Bold, { color: palette.accent }]}>
          {title}
        </Text>
        {body ? (
          <Text numberOfLines={2} style={[Fonts.p3, { color: Colors.neutral100 }]}>
            {body}
          </Text>
        ) : null}
      </View>
      {actionLabel && typeof onAction === 'function' ? (
        <Pressable onPress={onAction} style={styles.actionButton}>
          <Text style={[Fonts.p4Bold, { color: palette.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    flex: 1,
    gap: 6,
  },
});

export default GlobalBanner;
