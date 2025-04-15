import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Team shield component that displays initials on top of a shield image
 * @param {object} props - Component props
 * @param {string} props.initials - Team initials (max 3 letters)
 * @param {boolean} [props.isSmall] - Size of the shield
 * @returns {import('react').ReactElement} TeamShield component
 */
function TeamShield({ initials, isSmall = false }) {
  // hooks
  const { Alignments, Fonts, Images } = useTheme();

  // Format initials to max 3 letters uppercase
  const formattedInitials = initials.slice(0, 3).toUpperCase();
  const size = isSmall ? 60 : 90;

  return (
    <View style={[
      Alignments.relative,
      Alignments.alignCenter,
    ]}
    >
      <Image
        source={Images.shield}
        style={{
          height: size,
          width: size,
        }}
      />
      <View style={[
        Alignments.absolute,
      ]}
      >
        <Text style={[
          isSmall ? Fonts.p2Black : Fonts.h4Black,
          Fonts.primary700,
          { top: size / 3.5 },
        ]}
        >
          {formattedInitials}
        </Text>
      </View>
    </View>
  );
}

export default TeamShield;
