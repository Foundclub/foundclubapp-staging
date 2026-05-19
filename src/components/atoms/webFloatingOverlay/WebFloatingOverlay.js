import { View } from 'react-native';

/**
 * Native fallback for a viewport-anchored floating overlay.
 * Native absolute positioning already behaves relative to the current screen.
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
  return (
    <View pointerEvents="box-none" style={style}>
      {children}
    </View>
  );
}

export default WebFloatingOverlay;
