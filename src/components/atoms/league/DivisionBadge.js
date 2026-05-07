import { useEffect, useMemo } from 'react';
import {
  Image, NativeModules, StyleSheet, Text, UIManager, View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import { clampLeagueDivision } from '@/utils/league/division';

import Div1Badge from '@/assets/league/divisions/DIV-1.svg';
import Div2Badge from '@/assets/league/divisions/Div-2.svg';
import Div3Badge from '@/assets/league/divisions/Div-3.svg';
import Div4Badge from '@/assets/league/divisions/Div-4.svg';
import Div5Badge from '@/assets/league/divisions/Div-5.svg';

const BADGE_COMPONENTS = /** @type {Record<number, import('react').ComponentType<any>>} */ ({
  1: Div1Badge,
  2: Div2Badge,
  3: Div3Badge,
  4: Div4Badge,
  5: Div5Badge,
});

const hasSvgNativeSupport = () => {
  const native = NativeModules || {};
  const hasNativeModule = Object.keys(native).some((key) => key.toLowerCase().includes('rnsvg'));
  if (hasNativeModule) return true;

  const managerNames = [
    'RNSVGSvgView',
    'RNSVGPath',
    'RNSVGGroup',
    'RNSVGRect',
    'RNSVGCircle',
    'RCTRNSVGPath',
  ];

  if (typeof UIManager?.getViewManagerConfig === 'function') {
    return managerNames.some((name) => Boolean(UIManager.getViewManagerConfig(name)));
  }

  const managerLookup = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (UIManager || {}));
  return managerNames.some((name) => Boolean(managerLookup[name]));
};

const SVG_NATIVE_READY = hasSvgNativeSupport();

/**
 * @param {number} division
 * @returns {import('react').ComponentType<any>}
 */
const getBadgeComponent = (division) => BADGE_COMPONENTS[division] || BADGE_COMPONENTS[5];

/**
 * @param {import('../../../theme/types').Images} images
 * @param {number} division
 * @returns {import('react-native').ImageSourcePropType}
 */
const getLegacyImageForDivision = (images, division) => {
  const key = `division${String(division).padStart(2, '0')}`;
  const imageLookup = /** @type {Record<string, import('react-native').ImageSourcePropType>} */ (images || {});
  return imageLookup[key] || imageLookup.division05 || imageLookup.shield;
};

/**
 * @typedef {object} DivisionBadgeProps
 * @property {number} [division]
 * @property {number} [logoScale]
 * @property {boolean} [preferRaster]
 * @property {boolean} [showChrome]
 * @property {boolean} [showLabel]
 * @property {number} [size]
 */

/**
 * @param {DivisionBadgeProps} props
 * @returns {import('react').ReactElement}
 */
function DivisionBadge({
  division = 5,
  logoScale = 1,
  preferRaster = true,
  showChrome = true,
  showLabel = true,
  size = 54,
}) {
  const { Colors, Fonts, Images } = useTheme();
  const normalizedDivision = clampLeagueDivision(division);
  const BadgeComponent = useMemo(
    () => getBadgeComponent(normalizedDivision),
    [normalizedDivision],
  );
  const legacyImageSource = useMemo(
    () => getLegacyImageForDivision(Images, normalizedDivision),
    [Images, normalizedDivision],
  );

  const pulse = useSharedValue(0.14);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.32, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 1 + (pulse.value * 0.05) }],
  }));

  const normalizedLogoScale = Number.isFinite(Number(logoScale))
    ? Math.max(1, Math.min(1.8, Number(logoScale)))
    : 1;
  const glowSize = size + 10;
  const iconSize = showChrome ? Math.max(28, size - 10) : size;
  const scaledIconSize = Math.round(iconSize * normalizedLogoScale);
  const badgeFrameSize = showChrome ? size + 16 : scaledIconSize;
  const shouldUseSvg = SVG_NATIVE_READY && !preferRaster;

  return (
    <View style={[styles.wrapper, { height: badgeFrameSize, width: badgeFrameSize }]}>
      {showChrome ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              glowStyle,
              {
                backgroundColor: 'rgba(255, 215, 0, 0.09)',
                borderColor: 'rgba(255, 215, 0, 0.42)',
                height: glowSize,
                width: glowSize,
              },
            ]}
          />
          <View
            style={[
              styles.imageWrap,
              {
                backgroundColor: 'rgba(1, 36, 52, 0.98)',
                borderColor: 'rgba(255, 215, 0, 0.72)',
                height: size,
                width: size,
              },
            ]}
          >
            {shouldUseSvg ? (
              <BadgeComponent height={scaledIconSize} width={scaledIconSize} />
            ) : (
              <Image
                resizeMode="contain"
                source={legacyImageSource}
                style={{ height: scaledIconSize, width: scaledIconSize }}
              />
            )}
          </View>
        </>
      ) : (
        <View style={[styles.plainIconWrap, { height: scaledIconSize, width: scaledIconSize }]}>
          {shouldUseSvg ? (
            <BadgeComponent height={scaledIconSize} width={scaledIconSize} />
          ) : (
            <Image
              resizeMode="contain"
              source={legacyImageSource}
              style={{ height: scaledIconSize, width: scaledIconSize }}
            />
          )}
        </View>
      )}
      {showLabel ? (
        <View
          style={[
            styles.labelChip,
            {
              backgroundColor: 'rgba(1, 179, 244, 0.16)',
              borderColor: 'rgba(1, 179, 244, 0.52)',
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
            DIV
            {normalizedDivision}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

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
    elevation: 6,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'black',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
  },
  labelChip: {
    borderRadius: 999,
    borderWidth: 1,
    marginTop: -4,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  plainIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DivisionBadge;
