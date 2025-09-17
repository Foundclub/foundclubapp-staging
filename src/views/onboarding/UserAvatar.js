import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * User avatar selection screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User avatar screen component
 */
function UserAvatar({ navigation }) {
  // local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );

  // hooks
  const { getNextOnboardingRoute } = useAuth();

  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserAvatar) || RouteNames.UserName);
    },
  });

  const handleNext = () => {
    if (avatar && userData) {
      updateUserMutation.mutate(Object.assign(userData, { avatar }));
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserAvatar) || RouteNames.UserName);
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.avatar')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.avatar')}
          </Text>
        </View>

        <View style={[Alignments.row, Alignments.justifyCenter, Spaces.marginVertical[24]]}>
          <SelectAvatar
            currentAvatar={avatar}
            onAvatarSelected={setAvatar}
            size={95}
          />
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={!avatar?.path}
          onPress={handleNext}
          title={t('profile.actions.save')}
          variant="Primary"
        />
        <TouchableOpacity
          onPress={handleSkip}
          style={[Alignments.alignCenter]}
        >
          <Text style={[Fonts.p1, Fonts.neutral300, Fonts.underlineText]}>
            {t('profile.actions.ignore')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

export default UserAvatar;
