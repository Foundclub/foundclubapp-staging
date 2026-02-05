import React, { useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';

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
    const { ApplicationStyle, Images, Colors } = useTheme();
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const processedUrl = getImageUrl(imageUrl);
    const hasImage = !!processedUrl;

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
                ]}
            >
                <Image
                    source={hasImage ? { uri: processedUrl } : Images.roundAvatar}
                    style={[
                        ApplicationStyle.borderRadius24, // Default round
                        { width: size, height: size, borderRadius: size / 2 },

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
