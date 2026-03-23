import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Small helper text used on optional onboarding steps.
 * @returns {import('react').ReactElement}
 */
function OnboardingOptionalHint() {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[Alignments.alignCenter, Spaces.paddingHorizontal[8]]}>
      <Text
        style={[
          Fonts.p3,
          Fonts.textCenter,
          {
            color: Colors.primary200,
            lineHeight: 20,
          },
        ]}
      >
        {t(
          'onboarding.optionalStepHint',
          "Cette etape n'est pas obligatoire, mais elle reste utile pour ton experience FoundClub.",
        )}
      </Text>
    </View>
  );
}

export default OnboardingOptionalHint;
