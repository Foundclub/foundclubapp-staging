import MaskedView from '@react-native-masked-view/masked-view';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import { lightenColor } from '@/utils/colors/colorsOperations';
import { addBackgroundOnDeepTextChildren } from '@/utils/elements/elementOperations';

/**
 * Skeleton loader component.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} props.isActive
 * @param {string} [props.backgroundColor]
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @returns {import('react').ReactElement}
 */
function SkeletonLoader({
  backgroundColor = '#808080',
  children,
  isActive,
  wrapperStyle = [],
}) {
  // local state

  const [layout, setLayout] = useState(/** @type {{width: number, height: number} | null} */(null));
  // reanimated variables
  const shared = useSharedValue(0);
  // hooks
  const { Alignments } = useTheme();

  useEffect(() => {
    shared.value = withRepeat(withTiming(1, { duration: 1000 }), Infinity);
  }, [shared]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shared.value,
          [0, 1],
          [layout ? -layout.width : 0, layout ? layout.width : 0],
        ),
      },
    ],
  }));

  const clones = useMemo(
    /**
     * Add background color to deep text children.
     * @returns {import('react').ReactNode} The children with background color.
     */
    () => addBackgroundOnDeepTextChildren(children),
    [children],
  );

  return !layout || !isActive ? (
    <View
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
      style={wrapperStyle}
    >
      {children}
    </View>
  ) : (
    <MaskedView
      maskElement={<View style={wrapperStyle}>{clones}</View>}
      style={{
        height: layout.height,
        width: layout.width,
      }}
    >
      <View
        style={[
          Alignments.grow1,
          Alignments.overflowHidden,
          { backgroundColor },
        ]}
      />
      <Reanimated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <MaskedView
          maskElement={(
            <LinearGradient
              colors={['transparent', 'black', 'transparent']}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          style={StyleSheet.absoluteFill}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: lightenColor(backgroundColor, 0.5) },
            ]}
          />
        </MaskedView>
      </Reanimated.View>
    </MaskedView>
  );
}

export default SkeletonLoader;
