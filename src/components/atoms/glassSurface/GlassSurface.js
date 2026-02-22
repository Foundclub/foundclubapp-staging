import { BlurView } from '@sbaiahmed1/react-native-blur';
import { Platform, StyleSheet, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Glass surface primitive with native blur and safe fallback color.
 * @param {object} props
 * @param {import('react').ReactNode} [props.children]
 * @param {string} [props.borderColor]
 * @param {number} [props.borderRadius]
 * @param {number} [props.blurAmount]
 * @param {import('@sbaiahmed1/react-native-blur').BlurType} [props.blurType]
 * @param {string} [props.fallbackColor]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {string} [props.tintColor]
 * @param {string} [props.topHighlightColor]
 * @param {number} [props.topHighlightHeight]
 * @returns {import('react').ReactElement}
 */
function GlassSurface({
  blurAmount = 16,
  blurType = 'systemMaterialDark',
  borderColor,
  borderRadius = 16,
  children,
  fallbackColor,
  style,
  tintColor = 'rgba(0, 18, 28, 0.46)',
  topHighlightColor = 'transparent',
  topHighlightHeight = 0,
}) {
  const { Colors } = useTheme();
  const resolvedFallbackColor = fallbackColor || `${Colors.primary900}E8`;

  return (
    <View
      style={[
        {
          backgroundColor: resolvedFallbackColor,
          borderColor: borderColor || `${Colors.primary500}CC`,
          borderRadius,
          borderWidth: 1,
          overflow: 'hidden',
          position: 'relative',
        },
        style,
      ]}
    >
      <BlurView
        blurAmount={blurAmount}
        blurType={Platform.OS === 'ios' ? blurType : 'dark'}
        reducedTransparencyFallbackColor={resolvedFallbackColor}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: tintColor,
          },
        ]}
      />
      {topHighlightHeight > 0 ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: topHighlightColor,
            height: topHighlightHeight,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />
      ) : null}
      <View style={{ position: 'relative' }}>
        {children}
      </View>
    </View>
  );
}

export default GlassSurface;
