import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import FormScreenContainer from '@/components/templates/FormScreenContainer';

/**
 * @param {{
 *  actionLabel?: string;
 *  description: string;
 *  isLoading?: boolean;
 *  onAction?: () => void;
 *  title: string;
 * }} props
 * @returns {import('react').ReactElement}
 */
function OnboardingStateView({
  actionLabel,
  description,
  isLoading = false,
  onAction,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifyCenter,
      ]}
      contentWidth="readable"
      responsivePadding
    >
      <View
        style={[
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.padding[24],
          Spaces.gap[16],
          {
            alignSelf: 'center',
            backgroundColor: 'rgba(9, 24, 35, 0.88)',
            borderColor: 'rgba(255,255,255,0.08)',
            maxWidth: 560,
            width: '100%',
          },
        ]}
      >
        <Text style={[Fonts.h2, Fonts.neutral00]}>{title}</Text>
        <Text style={[Fonts.p1, Fonts.neutral100]}>{description}</Text>
        {isLoading ? (
          <View style={[Alignments.alignCenter, Spaces.paddingVertical[8]]}>
            <Loader />
          </View>
        ) : null}
        {onAction && actionLabel ? (
          <Button
            onPress={onAction}
            title={actionLabel}
            variant="Primary"
          />
        ) : null}
      </View>
    </FormScreenContainer>
  );
}

export default OnboardingStateView;
