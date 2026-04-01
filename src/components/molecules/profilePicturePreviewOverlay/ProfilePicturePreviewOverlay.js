import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const { height, width } = Dimensions.get('window');

/**
 * ProfilePicturePreviewOverlay component
 * Displays a full-screen preview of the profile picture with animation.
 * @param {object} props
 * @param {string} props.imageUrl - The URL of the image to display
 * @param {boolean} props.isVisible - Whether the overlay is visible
 * @param {() => void} props.onClose - Function to call when closing the overlay
 * @returns {import('react').ReactElement} ProfilePicturePreviewOverlay component
 */
function ProfilePicturePreviewOverlay({ imageUrl, isVisible, onClose }) {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          friction: 7,
          tension: 40,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          duration: 200,
          toValue: 1,
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
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={isVisible}
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

        {/* Image Container */}
        <View pointerEvents="box-none" style={styles.contentContainer}>
          <Animated.Image
            resizeMode="contain"
            source={{ uri: imageUrl }}
            style={[
              styles.image,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    height,
    justifyContent: 'center',
    pointerEvents: 'none', // Allow clicks to pass through to backdrop if clicked outside image (though image covers most)
    width,
  },
  image: {
    height: width, // Square aspect ratio for the container, but resizeMode contain will handle aspect ratio
    maxHeight: height * 0.8,
    width,
  },
});

export default ProfilePicturePreviewOverlay;
