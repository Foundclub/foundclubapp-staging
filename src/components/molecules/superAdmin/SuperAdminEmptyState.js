import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @param {{
 *  title: string;
 *  description: string;
 * }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEmptyState({ description, title }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <View style={[
      ApplicationStyle.card,
      ApplicationStyle.borderRadius16,
      Spaces.padding[16],
      Alignments.alignCenter,
      Spaces.marginTop[20],
      { backgroundColor: Colors.neutral800 },
    ]}
    >
      <Text style={[Fonts.h4, Fonts.neutral00, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8], { textAlign: 'center' }]}>
        {description}
      </Text>
    </View>
  );
}

export default SuperAdminEmptyState;
