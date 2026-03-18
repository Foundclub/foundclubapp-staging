import { useState } from 'react';
import {
  Image, StyleSheet, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

import ProfilePicturePreviewOverlay from '../profilePicturePreviewOverlay/ProfilePicturePreviewOverlay';

/**
 * ProfileAvatar component
 * Displays an avatar that opens a full-screen preview on tap.
 * @param {object} props
 * @param {string} [props.imageUrl] - The URL of the avatar image
 * @param {number} [props.size] - Size of the avatar (width/height)
 * @param {object} [props.style] - Additional styles for the container
 * @param {object} [props.imageStyle] - Additional styles for the image
 * @param {boolean} [props.enablePreview] - Whether to enable the full-screen preview on tap
 * @param {'avatar' | 'logo'} [props.variant] - Rendering variant for classic avatars or logos
 * @param {'cover' | 'contain'} [props.fitMode] - Optional explicit resize mode
 * @param {number} [props.safeInsetRatio] - Inner inset ratio (logo mode only)
 * @param {'auto' | 'circle' | 'rounded'} [props.shape] - Optional outer frame shape
 * @returns {import('react').ReactElement}
 */
function ProfileAvatar({
  enablePreview = true,
  fitMode,
  imageStyle,
  imageUrl,
  safeInsetRatio,
  shape = 'auto',
  size = 40,
  style,
  variant = 'avatar',
}) {
  const {
    Alignments, ApplicationStyle, Colors, Images,
  } = useTheme();
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const processedUrl = getImageUrl(imageUrl);
  const hasImage = !!processedUrl;
  const isLogoVariant = variant === 'logo';
  const flattenedStyle = StyleSheet.flatten([{ height: size, width: size }, style]) || {};
  const resolvedWidth = typeof flattenedStyle.width === 'number' ? flattenedStyle.width : size;
  const resolvedHeight = typeof flattenedStyle.height === 'number' ? flattenedStyle.height : size;
  const defaultInsetRatio = isLogoVariant ? 0.04 : 0;
  const rawInsetRatio = Number.isFinite(safeInsetRatio) ? safeInsetRatio : defaultInsetRatio;
  const sanitizedInsetRatio = Number.isFinite(rawInsetRatio)
    ? Math.min(Math.max(rawInsetRatio, 0), 0.3)
    : defaultInsetRatio;
  const effectiveInsetRatio = isLogoVariant ? sanitizedInsetRatio : 0;
  const innerWidth = resolvedWidth * (1 - (2 * effectiveInsetRatio));
  const innerHeight = resolvedHeight * (1 - (2 * effectiveInsetRatio));
  const resolvedFitMode = fitMode || (isLogoVariant ? 'contain' : 'cover');
  const isCircular = Math.abs(resolvedWidth - resolvedHeight) < 1;
  const resolvedShape = shape === 'auto'
    ? (isLogoVariant ? 'auto' : (isCircular ? 'circle' : 'rounded'))
    : shape;
  const normalizedBorderColor = typeof flattenedStyle.borderColor === 'string'
    ? flattenedStyle.borderColor.replace(/\s/g, '').toLowerCase()
    : '';
  const hasCircleBorder = typeof flattenedStyle.borderWidth === 'number' && flattenedStyle.borderWidth > 0;
  const isWhiteLikeBorder = [
    '#e6f7fe',
    '#fff',
    '#ffffff',
    'rgb(255,255,255)',
    'rgba(255,255,255,1.0)',
    'rgba(255,255,255,1)',
    'white',
  ].includes(normalizedBorderColor);
  const shouldSuppressCircleBorder = resolvedShape === 'circle'
    && isCircular
    && hasCircleBorder
    && isWhiteLikeBorder;
  let resolvedRadius = 0;
  if (resolvedShape === 'circle' && isCircular) {
    resolvedRadius = resolvedWidth / 2;
  } else if (resolvedShape === 'rounded') {
    resolvedRadius = typeof flattenedStyle.borderRadius === 'number'
      ? flattenedStyle.borderRadius
      : Math.min(Math.round(Math.min(resolvedWidth, resolvedHeight) * 0.22), 24);
  } else if (typeof flattenedStyle.borderRadius === 'number') {
    resolvedRadius = flattenedStyle.borderRadius;
  } else if (isCircular) {
    resolvedRadius = resolvedWidth / 2;
  }

  const handlePress = () => {
    if (hasImage && enablePreview) {
      setIsPreviewVisible(true);
    }
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={hasImage && enablePreview ? 0.8 : 1}
        disabled={!hasImage || !enablePreview}
        onPress={handlePress}
        style={[
          { height: size, width: size },
          style,
          {
            borderRadius: resolvedRadius,
            height: resolvedHeight,
            overflow: 'hidden',
            width: resolvedWidth,
          },
          shouldSuppressCircleBorder && {
            borderColor: 'transparent',
            borderWidth: 0,
          },
        ]}
      >
        <View style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            height: resolvedHeight,
            width: resolvedWidth,
          },
        ]}
        >
          <Image
            resizeMode={resolvedFitMode}
            source={hasImage ? { uri: processedUrl } : Images.roundAvatar}
            style={[
              !isLogoVariant && ApplicationStyle.borderRadius24,
              {
                backgroundColor: isLogoVariant ? (Colors?.neutral00 || '#FFFFFF') : 'transparent',
                borderRadius: isLogoVariant ? 0 : resolvedRadius,
                height: isLogoVariant ? innerHeight : resolvedHeight,
                width: isLogoVariant ? innerWidth : resolvedWidth,
              },
              shouldSuppressCircleBorder && {
                borderColor: 'transparent',
                borderWidth: 0,
              },
              imageStyle,
              isLogoVariant && { borderRadius: 0 },
            ]}
          />
        </View>
      </TouchableOpacity>

      <ProfilePicturePreviewOverlay
        imageUrl={processedUrl || ''}
        isVisible={isPreviewVisible}
        onClose={() => setIsPreviewVisible(false)}
      />
    </>
  );
}

export default ProfileAvatar;
