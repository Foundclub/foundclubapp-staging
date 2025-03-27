import { useState } from 'react';
import { View, Text } from 'react-native';
// hooks
import useTheme from '../../../theme/themeContext';
// utils
import { getErrorMessage } from '../../../utils/errors/displayError';

/**
 * Error wrapper component.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} props.error
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @returns {import('react').ReactElement}
 */
function ErrorWrapper({ children, error, wrapperStyle = [] }) {
  // hooks
  const {
    ApplicationStyle, Alignments, Fonts, Spaces,
  } = useTheme();

  const [childrenDimensions, setChildrenDimensions] = useState({ width: 0, height: 0 });

  /**
   * Handle children layout event.
   * @param {import('react-native').LayoutChangeEvent} event
   * @returns {void}
   */
  const onChildrenLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setChildrenDimensions({ width, height });
  };

  return (
    <View
      style={wrapperStyle}
      onLayout={onChildrenLayout}
    >
      {children}
      {error && (
        <View style={[
          Alignments.absolute,
          Alignments.justifyCenter,
          Alignments.alignCenter,
          childrenDimensions,
          ApplicationStyle.backgroundColor.error100,
          ApplicationStyle.borderRadius8,
          Spaces.padding[24],
        ]}
        >
          <Text style={[Fonts.p1, Fonts.error700]}>
            {getErrorMessage(error)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default ErrorWrapper;
