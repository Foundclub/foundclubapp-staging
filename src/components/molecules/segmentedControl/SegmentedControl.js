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

// 🔠 S5 (vague S) — LE PLANCHER DE RETRECISSEMENT DU MODE UNE-LIGNE.
//
// 0,72 est la valeur deja retenue 17 fois dans ce depot pour le meme besoin
// (MatchHistory.js, FutCard.js, FriendlyMatchListContent.js…) : en dessous, le
// texte devient plus petit que ce qu'un pouce lit sur un telephone.
//
// ⚠️ C'EST UN PLANCHER, PAS UNE PROMESSE. Si le libelle ne tient toujours pas a
// 72 % de sa taille, React Native l'ellipse — le contrat « jamais tronque » de
// ce mode vaut TANT QUE 72 % suffit, et pas au-dela.
const SHRINK_MIN_SCALE = 0.72;

/**
 * SegmentedControl component.
 * @param {object} props
 * @param {Array<{label: string, value: string}>} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.centerContent]
 * @param {boolean} [props.fitLabels] S5 : UNE ligne, le texte retrecit pour tenir.
 * @param {boolean} [props.fullLabels] Libelles systeme : jamais tronques.
 * @returns {import('react').ReactElement}
 */
function SegmentedControl({
  centerContent = false, fitLabels = false, fullLabels = false, onChange, options, value,
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
    // D63 : opt-in. `flexShrink: 1` laissait le libelle se comprimer jusqu'a
    // l'ellipse ; sur deux lignes il prend la place dont il a besoin. Les 15
    // ecrans qui n'activent pas la prop gardent le bandeau d'une seule ligne.
    segmentTextFull: {
      flexShrink: 0,
    },
    segmentTextSelected: {
      ...Fonts.p3Bold,
      // Encre foncee sur fond primary500 : neutral00 = 2,40:1 (echec WCAG AA),
      // primary900 = 7,96:1. Decision Adel 2026-07-14, cf. THEME.md.
      color: Colors.primary900,
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
        {/* 🔠 S5 (vague S) — TROIS MODES, ET UN SEUL GAGNE A LA FOIS.
            · defaut          → une ligne, le texte se coupe (15 ecrans a onglets courts)
            · `fullLabels`    → DEUX lignes, jamais coupe (D63, FacilityForm)
            · `fitLabels`     → UNE ligne, le texte RETRECIT jusqu a 72 %

            🧨 POURQUOI UN TROISIEME MODE PLUTOT QUE DE CORRIGER `fullLabels` :
            la recette du 25/08 a montre qu en deux lignes, « Participants » et
            « Convocation » se cassent sur leur DERNIERE lettre — un « s » et un
            « n » tout seuls sous le mot. Passer les onglets a une ligne en
            changeant `fullLabels` aurait ramene FacilityForm a la troncature que
            D63 avait justement supprimee, et sa hauteur y est reservee pour deux
            lignes. Les deux besoins sont reels et opposes : ils ont deux props.

            ⚠️ `fitLabels` PRIME sur `fullLabels` quand les deux arrivent. Sans
            regle ecrite ici, un futur appelant qui passe les deux tomberait sur
            un rendu indefini — et ce genre d indefini se decouvre a la recette. */}
        <Text
          adjustsFontSizeToFit={fitLabels}
          minimumFontScale={fitLabels ? SHRINK_MIN_SCALE : undefined}
          numberOfLines={fullLabels && !fitLabels ? 2 : 1}
          style={[
            styles.segmentText,
            fullLabels && !fitLabels && styles.segmentTextFull,
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
