import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import PremiumBadge from '@/components/molecules/premiumBadge/PremiumBadge';

/**
 * @typedef {'default' | 'primary'} HomeCardEmphasis
 * @typedef {'default' | 'destructive'} HomeCardTone
 * @typedef {{ bottom?: number; height?: number; right?: number; width?: number }} HomeCardIllustrationPlacement
 */

const DEFAULT_ILLUSTRATION_PLACEMENT = {
  bottom: -26,
  height: 138,
  right: -20,
  width: 138,
};

const GHOST_ICON_PLACEMENT = {
  bottom: -20,
  height: 112,
  right: -16,
  width: 112,
};

/**
 * Home action card used by the HomeHub sections.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {() => void} props.onPress
 * @param {boolean} [props.disabled]
 * @param {keyof import('@/theme/types').AllImages} [props.icon]
 * @param {string} [props.accentColor]
 * @param {import('react-native').ImageSourcePropType} [props.illustration]
 * @param {HomeCardIllustrationPlacement} [props.illustrationPlacement]
 * @param {HomeCardEmphasis} [props.emphasis]
 * @param {HomeCardTone} [props.tone]
 * @param {boolean} [props.highlighted] - Surbrillance pulsée (étape du tour guidé)
 * @param {'club' | 'team'} [props.premiumScope] - Offre couvrant l'action (badge informatif, handoff 12)
 * @param {1 | 2} [props.subtitleLines]
 * @param {((node: any) => void) | { current: any }} [props.tutorialTargetRef]
 * @returns {import('react').ReactElement}
 */
function HomeActionCard({
  accentColor,
  disabled = false,
  emphasis = 'default',
  highlighted = false,
  icon = 'search',
  illustration,
  illustrationPlacement,
  onPress,
  premiumScope,
  subtitle,
  subtitleLines = 2,
  title,
  tone = 'default',
  tutorialTargetRef,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const resolvedAccentColor = accentColor || Colors.primary500;
  const pulseOpacity = useRef(new Animated.Value(0.35)).current;

  // Anneau lumineux pulse quand le tour guide pointe cette carte.
  useEffect(() => {
    if (!highlighted) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseOpacity, { duration: 700, toValue: 1, useNativeDriver: true }),
      Animated.timing(pulseOpacity, { duration: 700, toValue: 0.35, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [highlighted, pulseOpacity]);
  let borderColor = `${resolvedAccentColor}47`;
  if (highlighted) {
    borderColor = resolvedAccentColor;
  }
  if (emphasis === 'primary') {
    borderColor = resolvedAccentColor;
  } else if (tone === 'destructive') {
    borderColor = `${resolvedAccentColor}61`;
  }
  const resolvedIllustrationPlacement = {
    ...DEFAULT_ILLUSTRATION_PLACEMENT,
    ...(illustrationPlacement || {}),
  };

  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityLabel={title}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ([
        {
          borderRadius: 16,
          width: '100%',
        },
        pressed && {
          opacity: 0.94,
        },
        disabled && {
          opacity: 0.5,
        },
      ])}
    >
      <View
        collapsable={false}
        ref={tutorialTargetRef}
        style={[
          ApplicationStyle.card,
          {
            backgroundColor: `${Colors.primary700}59`,
            borderColor,
            borderRadius: 16,
            borderWidth: 1,
            justifyContent: 'space-between',
            minHeight: 140,
            overflow: 'hidden',
            paddingHorizontal: 16,
            paddingVertical: 16,
          },
        ]}
      >
        {highlighted ? (
          <Animated.View
            pointerEvents="none"
            style={{
              borderColor: resolvedAccentColor,
              borderRadius: 16,
              borderWidth: 2.5,
              bottom: 0,
              left: 0,
              opacity: pulseOpacity,
              position: 'absolute',
              right: 0,
              top: 0,
              zIndex: 2,
            }}
          />
        ) : null}
        {illustration ? (
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            resizeMode="contain"
            source={illustration}
            style={{
              bottom: resolvedIllustrationPlacement.bottom,
              height: resolvedIllustrationPlacement.height,
              position: 'absolute',
              right: resolvedIllustrationPlacement.right,
              width: resolvedIllustrationPlacement.width,
            }}
          />
        ) : (
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            resizeMode="contain"
            source={Images[icon]}
            style={{
              bottom: GHOST_ICON_PLACEMENT.bottom,
              height: GHOST_ICON_PLACEMENT.height,
              opacity: 0.12,
              position: 'absolute',
              right: GHOST_ICON_PLACEMENT.right,
              width: GHOST_ICON_PLACEMENT.width,
            }}
            tintColor={resolvedAccentColor}
          />
        )}

        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { position: 'relative', zIndex: 1 }]}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}1F`,
              borderRadius: 12,
              height: 38,
              justifyContent: 'center',
              width: 38,
            }}
          >
            <Image
              source={Images[icon]}
              style={{ height: 18, width: 18 }}
              tintColor={resolvedAccentColor}
            />
          </View>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}1A`,
              borderColor: `${resolvedAccentColor}66`,
              borderRadius: 10,
              borderWidth: 1,
              height: 26,
              justifyContent: 'center',
              width: 26,
            }}
          >
            <Image
              source={Images.arrowRight}
              style={{ height: 12, width: 12 }}
              tintColor={resolvedAccentColor}
            />
          </View>
        </View>

        <View style={[Spaces.marginTop[16], Spaces.gap[8], { position: 'relative', zIndex: 1 }]}>
          {premiumScope ? (
            <View style={[Alignments.row]}>
              <PremiumBadge scope={premiumScope} />
            </View>
          ) : null}
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { fontSize: 13.5, lineHeight: 20 }]}>{title}</Text>
          <Text
            numberOfLines={subtitleLines}
            style={[
              Fonts.small,
              Fonts.neutral200,
              subtitleLines === 2 && { minHeight: 32 },
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default HomeActionCard;
