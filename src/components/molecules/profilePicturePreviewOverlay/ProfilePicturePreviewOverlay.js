import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

const { width, height } = Dimensions.get('window');

/**
 * ProfilePicturePreviewOverlay component
 * Displays a full-screen preview of the profile picture with animation.
 * @param {object} props
 * @param {string} props.imageUrl - The URL of the image to display
 * @param {boolean} props.isVisible - Whether the overlay is visible
 * @param {() => void} props.onClose - Function to call when closing the overlay
 * @returns {import('react').ReactElement} ProfilePicturePreviewOverlay component
 */
const ProfilePicturePreviewOverlay = ({ imageUrl, isVisible, onClose }) => {
    const { Colors, Images, ApplicationStyle } = useTheme();
    const insets = useSafeAreaInsets();

    // Animation values
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    friction: 7,
                    tension: 40,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.3);
            opacityAnim.setValue(0);
        }
    }, [isVisible, scaleAnim, opacityAnim]);

    if (!isVisible || !imageUrl) return null;

    return (
        <Modal
            transparent
            visible={isVisible}
            onRequestClose={onClose}
            animationType="none"
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={onClose}
                    style={styles.backdrop}
                >
                    <Animated.View
                        style={[
                            styles.backdropLayer,
                            { opacity: opacityAnim },
                        ]}
                    />
                </TouchableOpacity>

                {/* Close Button */}
                <TouchableOpacity
                    onPress={onClose}
                    style={[
                        styles.closeButton,
                        { top: insets.top + 16 },
                    ]}
                >
                    <Image
                        source={Images.close}
                        style={[
                            ApplicationStyle.icon24,
                            { tintColor: Colors.neutral00 },
                        ]}
                    />
                </TouchableOpacity>

                {/* Image Container */}
                <View style={styles.contentContainer} pointerEvents="box-none">
                    <Animated.Image
                        source={{ uri: imageUrl }}
                        style={[
                            styles.image,
                            {
                                transform: [{ scale: scaleAnim }],
                                opacity: opacityAnim,
                            },
                        ]}
                        resizeMode="contain"
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    backdropLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    contentContainer: {
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none', // Allow clicks to pass through to backdrop if clicked outside image (though image covers most)
    },
    image: {
        width: width,
        height: width, // Square aspect ratio for the container, but resizeMode contain will handle aspect ratio
        maxHeight: height * 0.8,
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
});

export default ProfilePicturePreviewOverlay;
