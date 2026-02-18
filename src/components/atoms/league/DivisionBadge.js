import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import useTheme from '@/theme/themeContext';

const clampDivision = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.max(1, Math.min(10, parsed));
};

const getImageForDivision = (images, division) => {
  const key = `division${String(division).padStart(2, '0')}`;
  return images?.[key] || images?.division10 || images?.shield;
};

const DivisionBadge = ({
  division = 10,
  showLabel = true,
  size = 54,
}) => {
  const { Colors, Fonts, Images } = useTheme();
  const normalizedDivision = clampDivision(division);
  const imageSource = useMemo(
    () => getImageForDivision(Images, normalizedDivision),
    [Images, normalizedDivision]
  );

  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.75, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 1 + (pulse.value * 0.08) }],
  }));

  const glowSize = size + 14;

  return (
    <View style={[styles.wrapper, { width: size + 16 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          glowStyle,
          {
            backgroundColor: 'rgba(250, 204, 21, 0.35)',
            borderColor: Colors.gold500,
            height: glowSize,
            width: glowSize,
          },
        ]}
      />
      <View
        style={[
          styles.imageWrap,
          {
            backgroundColor: 'rgba(9, 27, 42, 0.95)',
            borderColor: Colors.gold500,
            height: size,
            width: size,
          },
        ]}
      >
        <Image
          source={imageSource}
          style={{ height: size - 8, width: size - 8 }}
          resizeMode="contain"
        />
      </View>
      {showLabel ? (
        <View
          style={[
            styles.labelChip,
            {
              backgroundColor: 'rgba(250, 204, 21, 0.18)',
              borderColor: 'rgba(250, 204, 21, 0.55)',
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>DIV {normalizedDivision}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  glow: {
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  imageWrap: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labelChip: {
    borderRadius: 999,
    borderWidth: 1,
    marginTop: -6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DivisionBadge;

