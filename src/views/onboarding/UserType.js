/* eslint-disable jsdoc/valid-types */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { USER_TYPES } from '@/domains/auth/authUseCases';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * User type selection screen component. Let users to select their role
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User type screen component
 */
function UserType({ navigation, route }) {
  const { data: userData } = useGetMe();
  // local state
  const [type, setType] = useState(
    /** @type {USER_TYPES[keyof USER_TYPES] | ""} */(userData?.role || USER_TYPES.player),
  );
  // hooks
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(route.params?.nextRoute || RouteNames.UserName);
    },
  });

  const handleNext = () => {
    if (type && userData) {
      updateUserMutation.mutate(Object.assign(userData, { type }));
    }
  };

  /**
   * Handle the selection of the user type
   * @param {USER_TYPES[keyof USER_TYPES] | ""} selectedType
   */
  const handleSelection = (selectedType) => {
    setType((currentType) => (selectedType === currentType ? '' : selectedType));
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.type')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.type')}
          </Text>
        </View>
        <View style={[Spaces.gap[24]]}>
          <TabButton
            isActive={type === USER_TYPES.player}
            onPress={() => handleSelection(USER_TYPES.player)}
            title={t('profile.fields.types.player')}
          />
          <TabButton
            isActive={type === USER_TYPES.coach}
            onPress={() => handleSelection(USER_TYPES.coach)}
            title={t('profile.fields.types.coach')}
          />
          <TabButton
            isActive={type === USER_TYPES.president}
            onPress={() => handleSelection(USER_TYPES.president)}
            title={t('profile.fields.types.president')}
          />

        </View>
      </View>
      <Button
        disabled={!type}
        onPress={handleNext}
        title={t('profile.actions.save')}
        variant="Primary"
      />
    </ScreenContainer>
  );
}

export default UserType;
