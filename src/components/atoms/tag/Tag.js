import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Tag component for displaying labels or categories
 * @param {object} props - Component props
 * @param {string} props.text - Text to display in the tag
 * @returns {import('react').ReactElement} Tag component
 */
function Tag({ text }) {
  const {
    ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.borderColor.primary500,
        ApplicationStyle.borderWidth1,
        ApplicationStyle.borderRadius8,
        Spaces.paddingVertical[4],
        Spaces.paddingHorizontal[8],
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          Fonts.p3,
          Fonts.primary500,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export default Tag;
