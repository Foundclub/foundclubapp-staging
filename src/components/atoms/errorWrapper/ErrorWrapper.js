import { useState } from 'react';
import { Text, View } from 'react-native';
// Hooks
import useTheme from '@/theme/themeContext';
// Utils
import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Error wrapper component.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {unknown} props.error
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @returns {import('react').ReactElement}
 */
function ErrorWrapper({ children, error, wrapperStyle = [] }) {
  // hooks
  const {
    Alignments, ApplicationStyle, Fonts,
  } = useTheme();

  const [childrenDimensions, setChildrenDimensions] = useState({ height: 0, width: 0 });

  /**
   * Handle children layout event.
   * @param {import('react-native').LayoutChangeEvent} event
   * @returns {void}
   */
  const onChildrenLayout = (event) => {
    const { height, width } = event.nativeEvent.layout;
    setChildrenDimensions({ height, width });
  };

  return (
    <View
      onLayout={onChildrenLayout}
      style={wrapperStyle}
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
        ]}
        >
          <Text
            style={[Fonts.p1,
              Fonts.error700,
              { width: childrenDimensions.width - 48 },
            ]}
          >
            {getErrorMessage(error)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default ErrorWrapper;
