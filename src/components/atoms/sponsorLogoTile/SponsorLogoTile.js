import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {object} SponsorLogoTileProps
 * @property {string} [imageUrl]
 * @property {string} [title]
 * @property {string} [link]
 * @property {() => void} [onPress]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [borderRadius]
 * @property {number} [titleLines]
 * @property {boolean} [showTitle]
 * @property {string} [borderColor]
 * @property {string} [backgroundColor]
 * @property {import('react-native').StyleProp<import('react-native').ViewStyle>} [containerStyle]
 * @property {import('react-native').StyleProp<import('react-native').ViewStyle>} [tileStyle]
 * @property {import('react-native').StyleProp<import('react-native').ImageStyle>} [imageStyle]
 * @property {import('react-native').StyleProp<import('react-native').TextStyle>} [titleStyle]
 */

/**
 * Sponsor logo tile that keeps any image ratio without cropping.
 * @param {SponsorLogoTileProps} props
 * @returns {import('react').ReactElement}
 */
function SponsorLogoTile({
  backgroundColor = 'rgba(255,255,255,0.96)',
  borderColor = 'rgba(255,255,255,0.72)',
  borderRadius = 8,
  containerStyle,
  height = 55,
  imageStyle,
  imageUrl,
  link,
  onPress,
  showTitle = true,
  tileStyle,
  title,
  titleLines = 1,
  titleStyle,
  width = 110,
}) {
  const { Fonts } = useTheme();
  const uri = imageUrl ? getImageUrl(imageUrl) : '';
  const hasImage = !!uri;
  const canPress = typeof onPress === 'function' || !!link;
  const effectiveBackgroundColor = hasImage ? 'transparent' : backgroundColor;
  const effectiveBorderColor = hasImage ? 'transparent' : borderColor;
  const effectiveBorderWidth = hasImage ? 0 : 1;

  const handlePress = () => {
    if (typeof onPress === 'function') {
      onPress();
      return;
    }
    if (link) {
      Linking.openURL(link).catch(() => {});
    }
  };

  const fallbackLabel = (title || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      disabled={!canPress}
      onPress={canPress ? handlePress : undefined}
      style={[styles.container, { width }, containerStyle]}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: effectiveBackgroundColor,
            borderColor: effectiveBorderColor,
            borderWidth: effectiveBorderWidth,
            borderRadius,
            height,
            width,
          },
          tileStyle,
        ]}
      >
        {hasImage ? (
          <Image
            source={{ uri }}
            style={[styles.image, imageStyle]}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.fallbackText}>{fallbackLabel}</Text>
        )}
      </View>
      {showTitle && title ? (
        <Text
          numberOfLines={titleLines}
          style={[
            Fonts.p2Bold,
            styles.title,
            { maxWidth: width },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  fallbackText: {
    color: '#173844',
    fontSize: 16,
    fontWeight: '700',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default SponsorLogoTile;
