import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Platform,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { horizontalScale, moderateScale, verticalScale } from '@/theme/scaling';
import useTheme from '@/theme/themeContext';

/**
 * SegmentedControl component.
 * @param {object} props
 * @param {Array<{label: string, value: string}>} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.centerContent]
 * @returns {import('react').ReactElement}
 */
function SegmentedControl({
  centerContent = false, onChange, options, value,
}) {
  const { Colors, Fonts } = useTheme();
  const isWeb = Platform.OS === 'web';
  const ScrollViewComponent = isWeb ? RNScrollView : GestureScrollView;
  const useEqualWidthLayout = centerContent;
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollOffset = useSharedValue(0);
  const dragStartOffset = useSharedValue(0);
  const horizontalGap = isWeb ? 8 : horizontalScale(8.58);
  const containerMinHeight = isWeb ? 44 : verticalScale(37.52);
  const segmentMinHeight = isWeb ? 36 : verticalScale(32);
  const segmentHorizontalPadding = isWeb ? 16 : horizontalScale(16);
  const segmentVerticalPadding = isWeb ? 9 : verticalScale(8);
  const segmentTextSize = isWeb ? 13 : moderateScale(12.87);
  const segmentTextLineHeight = isWeb ? 18 : moderateScale(18);
  const wrapperMinHeight = isWeb ? 52 : verticalScale(45);
  const segmentRadius = moderateScale(33.24);
  const selectedRadius = moderateScale(34.31);
  const maxScrollOffset = Math.max(0, contentWidth - containerWidth);
  const shouldUseManualHorizontalPan = !isWeb && !useEqualWidthLayout;

  useEffect(() => {
    scrollOffset.value = Math.min(scrollOffset.value, maxScrollOffset);
  }, [maxScrollOffset, scrollOffset]);

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-8, 8])
    .onStart(() => {
      'worklet';

      dragStartOffset.value = scrollOffset.value;
    })
    .onUpdate((gestureEvent) => {
      'worklet';

      const nextOffset = Math.max(
        0,
        Math.min(
          maxScrollOffset,
          dragStartOffset.value - gestureEvent.translationX,
        ),
      );
      scrollOffset.value = nextOffset;
    })
    .onEnd((gestureEvent) => {
      'worklet';

      const nextOffset = Math.max(
        0,
        Math.min(
          maxScrollOffset,
          dragStartOffset.value - gestureEvent.translationX,
        ),
      );
      scrollOffset.value = nextOffset;
    }), [maxScrollOffset, dragStartOffset, scrollOffset]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollOffset.value }],
  }));

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: Colors.transparent,
      flexDirection: 'row',
      gap: horizontalGap,
      minHeight: containerMinHeight,
      paddingVertical: isWeb ? 2 : 0,
      width: '100%',
    },
    containerCentered: {
      justifyContent: 'center',
      paddingHorizontal: isWeb ? 4 : horizontalScale(4),
      width: '100%',
    },
    containerEqualWidth: {
      alignItems: 'stretch',
    },
    scroll: {
      width: '100%',
    },
    scrollContent: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: Colors.transparent,
      flexDirection: 'row',
      gap: horizontalGap,
      minHeight: containerMinHeight,
      paddingVertical: isWeb ? 2 : 0,
    },
    scrollViewport: {
      overflow: 'hidden',
      width: '100%',
    },
    segment: {
      alignItems: 'center',
      backgroundColor: Colors.transparent,
      borderColor: Colors.neutral500,
      borderRadius: segmentRadius,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: segmentMinHeight,
      paddingHorizontal: segmentHorizontalPadding,
      paddingVertical: segmentVerticalPadding,
    },
    segmentEqualWidth: {
      flex: 1,
      minWidth: 0,
    },
    segmentSelected: {
      backgroundColor: Colors.primary500,
      borderColor: Colors.primary500,
      borderRadius: selectedRadius,
      elevation: 4,
      shadowColor: Colors.neutral900,
      shadowOffset: {
        height: verticalScale(4.29),
        width: 0,
      },
      shadowOpacity: 0.47,
      shadowRadius: moderateScale(4.29),
    },
    segmentText: {
      ...Fonts.p3,
      color: Colors.neutral00,
      flexShrink: 1,
      fontSize: segmentTextSize,
      includeFontPadding: !isWeb ? false : undefined,
      lineHeight: segmentTextLineHeight,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    segmentTextSelected: {
      ...Fonts.p3Bold,
      color: Colors.neutral00,
      fontSize: segmentTextSize,
      includeFontPadding: !isWeb ? false : undefined,
      lineHeight: segmentTextLineHeight,
    },
    wrapper: {
      minHeight: wrapperMinHeight,
      width: '100%',
    },
  }), [
    Colors,
    Fonts.p3,
    Fonts.p3Bold,
    containerMinHeight,
    horizontalGap,
    isWeb,
    segmentHorizontalPadding,
    segmentMinHeight,
    segmentRadius,
    segmentTextLineHeight,
    segmentTextSize,
    segmentVerticalPadding,
    selectedRadius,
    wrapperMinHeight,
  ]);

  const segmentButtons = options.map((option) => {
    const isSelected = option.value === value;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        key={option.value}
        onPress={() => onChange(option.value)}
        style={[
          styles.segment,
          useEqualWidthLayout && styles.segmentEqualWidth,
          isSelected && styles.segmentSelected,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.segmentText,
            isSelected && styles.segmentTextSelected,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  });

  let content;

  if (useEqualWidthLayout) {
    content = (
      <View style={[styles.container, styles.containerCentered, styles.containerEqualWidth]}>
        {segmentButtons}
      </View>
    );
  } else if (shouldUseManualHorizontalPan) {
    content = (
      <GestureDetector gesture={panGesture}>
        <View
          onLayout={(event) => {
            setContainerWidth(event.nativeEvent.layout.width);
          }}
          style={[styles.scrollViewport, styles.scroll]}
        >
          <Animated.View
            onLayout={(event) => {
              setContentWidth(event.nativeEvent.layout.width);
            }}
            style={[
              styles.scrollContent,
              animatedContentStyle,
            ]}
          >
            {segmentButtons}
          </Animated.View>
        </View>
      </GestureDetector>
    );
  } else {
    content = (
      <ScrollViewComponent
        bounces={!centerContent}
        contentContainerStyle={[
          styles.scrollContent,
          centerContent && styles.containerCentered,
        ]}
        directionalLockEnabled
        horizontal
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={!isWeb}
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {segmentButtons}
      </ScrollViewComponent>
    );
  }

  return (
    <View style={styles.wrapper}>
      {content}
    </View>
  );
}

export default SegmentedControl;
