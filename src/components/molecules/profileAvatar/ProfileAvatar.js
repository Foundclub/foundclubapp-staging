import React, { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';

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
 * @param {boolean} [props.enablePreview=true] - Whether to enable the full-screen preview on tap
 * @returns {import('react').ReactElement}
 */
const ProfileAvatar = ({
    imageUrl,
    size = 40,
    style,
    imageStyle,
    enablePreview = true,
}) => {
    const { ApplicationStyle, Images } = useTheme();
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const processedUrl = getImageUrl(imageUrl);
    const hasImage = !!processedUrl;
    const flattenedStyle = StyleSheet.flatten([{ height: size, width: size }, style]) || {};
    const resolvedWidth = typeof flattenedStyle.width === 'number' ? flattenedStyle.width : size;
    const resolvedHeight = typeof flattenedStyle.height === 'number' ? flattenedStyle.height : size;
    const isCircular = Math.abs(resolvedWidth - resolvedHeight) < 1;
    const normalizedBorderColor = typeof flattenedStyle.borderColor === 'string'
        ? flattenedStyle.borderColor.replace(/\s/g, '').toLowerCase()
        : '';
    const hasCircleBorder = typeof flattenedStyle.borderWidth === 'number' && flattenedStyle.borderWidth > 0;
    const isWhiteLikeBorder = [
        '#fff',
        '#ffffff',
        '#e6f7fe',
        'white',
        'rgb(255,255,255)',
        'rgba(255,255,255,1)',
        'rgba(255,255,255,1.0)',
    ].includes(normalizedBorderColor);
    const shouldSuppressCircleBorder = isCircular && hasCircleBorder && isWhiteLikeBorder;
    const resolvedRadius = isCircular
        ? resolvedWidth / 2
        : (typeof flattenedStyle.borderRadius === 'number' ? flattenedStyle.borderRadius : 0);

    const handlePress = () => {
        if (hasImage && enablePreview) {
            setIsPreviewVisible(true);
        }
    };

    return (
        <>
            <TouchableOpacity
                activeOpacity={hasImage && enablePreview ? 0.8 : 1}
                onPress={handlePress}
                disabled={!hasImage || !enablePreview}
                style={[
                    { width: size, height: size },
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
                <Image
                    source={hasImage ? { uri: processedUrl } : Images.roundAvatar}
                    style={[
                        ApplicationStyle.borderRadius24,
                        {
                            backgroundColor: 'transparent',
                            borderRadius: resolvedRadius,
                            height: resolvedHeight,
                            width: resolvedWidth,
                        },
                        shouldSuppressCircleBorder && {
                            borderColor: 'transparent',
                            borderWidth: 0,
                        },
                        imageStyle,
                    ]}
                />
            </TouchableOpacity>

            <ProfilePicturePreviewOverlay
                isVisible={isPreviewVisible}
                imageUrl={processedUrl || ''}
                onClose={() => setIsPreviewVisible(false)}
            />
        </>
    );
};

export default ProfileAvatar;
