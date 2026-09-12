/* eslint-disable import/no-unresolved */
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';

/**
 * Web overlay rendered directly in document.body so fixed-position FABs stay
 * anchored to the viewport even when React Native Web containers scroll.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {import('react-native').ViewStyle} [props.style]
 * @returns {import('react').ReactElement}
 */
function WebFloatingOverlay({
  children,
  style,
}) {
  // RN style props may be arrays. Spreading an array into a DOM style object
  // leaks numeric keys (0, 1, …), which React then tries to assign to
  // CSSStyleDeclaration and crashes on web (notably on League squad cards).
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const overlayZIndex = typeof flattenedStyle.zIndex === 'number' ? flattenedStyle.zIndex : 1100;
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
          ...flattenedStyle,
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
