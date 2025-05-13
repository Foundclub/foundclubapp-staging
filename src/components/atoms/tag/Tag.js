import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Tag component for displaying labels or categories
 * @param {object} props - Component props
 * @param {string} props.text - Text to display in the tag
 * @param {'primary500' | 'neutral00'} [props.textColor] - Color of the text, defaults to primary500
 * @param {import('react-native').TextStyle} [props.textStyle] - Additional styles for the text
 * @returns {import('react').ReactElement} Tag component
 */
function Tag({ text, textColor = 'primary500', textStyle }) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.borderColor.primary500,
        ApplicationStyle.borderWidth1,
        ApplicationStyle.borderRadius8,
        Spaces.paddingVertical[4],
        Spaces.paddingHorizontal[8],
        Alignments.alignCenter,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          Fonts.p3,
          textStyle,
          Fonts[textColor],
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export default Tag;
