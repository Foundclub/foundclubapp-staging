import { useEffect, useMemo, useState } from 'react';
import {
  Image, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * PERFIMAGES (03/11) — la taille d'un logo ne se demande qu'une fois. Une ligne de sponsors pose
 * le meme logo sur 4 a 8 tuiles, et le serveur interdit au telephone de reutiliser sa reponse
 * (`max-age=0`) : chaque tuile de chaque carte repartait au reseau. Mesure en prod : 991 demandes
 * d'un meme logo en 21 secondes depuis un seul reseau. Une demande ratee s'oublie, pour etre retentee.
 * ponytail: garde tout jusqu'au plafond, puis repart de zero. Sortie : une memoire LRU si des
 * listes de plus de 500 logos differents apparaissent.
 * @type {Map<string, Promise<{ height: number, width: number }>>}
 */
const logoSizes = new Map();
const MAX_KNOWN_LOGO_SIZES = 500;

/**
 * @param {string} uri
 * @returns {Promise<{ height: number, width: number }>}
 */
const readLogoSize = (uri) => {
  const known = logoSizes.get(uri);
  if (known) return known;

  if (logoSizes.size >= MAX_KNOWN_LOGO_SIZES) logoSizes.clear();
  const request = new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ height, width }), reject);
  });
  logoSizes.set(uri, request);
  request.catch(() => logoSizes.delete(uri));
  return request;
};

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
  borderRadius = 999,
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
  const [imageNaturalSize, setImageNaturalSize] = useState(null);
  const hasImage = !!uri;
  const canPress = typeof onPress === 'function' || !!link;
  const effectiveBackgroundColor = hasImage ? 'transparent' : backgroundColor;
  const effectiveBorderColor = hasImage ? 'transparent' : borderColor;
  const effectiveBorderWidth = hasImage ? 0 : 1;
  const effectiveTileBorderRadius = Math.min(borderRadius, Math.floor(Math.min(width, height) / 2));

  useEffect(() => {
    let isMounted = true;

    if (!uri) {
      setImageNaturalSize(null);
      return () => {
        isMounted = false;
      };
    }

    readLogoSize(uri).then(
      (size) => {
        if (isMounted && size.width > 0 && size.height > 0) {
          setImageNaturalSize(size);
        }
      },
      () => {
        if (isMounted) {
          setImageNaturalSize(null);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [uri]);

  const renderedImageSize = useMemo(() => {
    if (!imageNaturalSize?.width || !imageNaturalSize?.height) {
      return { height, width };
    }

    const containerAspectRatio = width / height;
    const imageAspectRatio = imageNaturalSize.width / imageNaturalSize.height;

    if (imageAspectRatio > containerAspectRatio) {
      return {
        height: width / imageAspectRatio,
        width,
      };
    }

    return {
      height,
      width: height * imageAspectRatio,
    };
  }, [height, imageNaturalSize, width]);

  const effectiveImageBorderRadius = Math.max(
    Math.min(
      effectiveTileBorderRadius,
      Math.floor(Math.min(renderedImageSize.width, renderedImageSize.height) / 2),
    ) - 1,
    0,
  );

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
            borderRadius: effectiveTileBorderRadius,
            borderWidth: effectiveBorderWidth,
            height,
            width,
          },
          tileStyle,
        ]}
      >
        {hasImage ? (
          <View
            style={[
              styles.imageFrame,
              {
                borderRadius: effectiveImageBorderRadius,
                height: renderedImageSize.height,
                width: renderedImageSize.width,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={{ uri }}
              style={[
                styles.image,
                { borderRadius: effectiveImageBorderRadius },
                imageStyle,
              ]}
            />
          </View>
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
  imageFrame: {
    borderRadius: 8,
    height: '100%',
    overflow: 'hidden',
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
