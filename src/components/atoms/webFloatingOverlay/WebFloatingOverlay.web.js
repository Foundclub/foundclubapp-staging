/* eslint-disable import/no-unresolved */
import { createPortal } from 'react-dom';
import { View } from 'react-native';

/**
 * Web overlay rendered directly in document.body so fixed-position FABs stay
 * anchored to the viewport even when React Native Web containers scroll.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {import('react-native').ViewStyle} [props.style]
 * @returns {import('react').ReactElement}
 */
function WebFloatingOverlay({
  children,
  style,
}) {
  const overlayZIndex = typeof style?.zIndex === 'number' ? style.zIndex : 1100;
  const overlay = (
    <View
      pointerEvents="box-none"
      style={{
        bottom: 0,
        left: 0,
        pointerEvents: 'none',
        position: 'fixed',
        right: 0,
        top: 0,
        zIndex: overlayZIndex,
      }}
    >
      <View
        pointerEvents="box-none"
        style={{
          ...style,
          position: 'absolute',
        }}
      >
        {children}
      </View>
    </View>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(overlay, document.body);
  }

  return overlay;
}

export default WebFloatingOverlay;
