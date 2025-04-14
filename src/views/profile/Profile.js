import { useTranslation } from 'react-i18next';
import {
  Image, RefreshControl, Text, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Profile screen component. Displays user information and profile management options.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile screen component
 */
function Profile({ navigation }) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    logoutMutation, refetchUserData, userData, userDataError, userDataLoading,
  } = useAuth();

  const handleEditUser = () => {
    navigation.navigate(RouteNames.ProfileEdit);
  };

  const handleFindClub = () => {
    navigation.navigate(RouteNames.ClubList);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.gap[32]]}
    >
      <View style={[
        Alignments.justifyCenter,
        Alignments.alignCenter,
        Spaces.gap[12]]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('profile.titles.profile').toUpperCase()}
        </Text>
        <View style={[
          ApplicationStyle.separator,
          ApplicationStyle.backgroundColor.neutral00,
          { width: 98 }]}
        />
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {userData?.role?.name?.toUpperCase()}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[32],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetchUserData}
            refreshing={userDataLoading}
          />
        )}
      >

        <WithDataWrapper
          error={userDataError?.message}
          isLoading={userDataLoading}
        >
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[24],
            ]}
          >
            <Image
              source={userData?.avatar?.url
                ? { uri: userData.avatar?.url }
                : Images.roundAvatar}
              style={[
                ApplicationStyle.borderColor.neutral00,
                ApplicationStyle.borderWidth1,
                { borderRadius: 80, height: 80, width: 80 }]}
            />
            {userData?.firstname && userData?.lastname && (
            <View style={[
              { maxWidth: '70%' },
              Spaces.gap[12],
            ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  Fonts.textCenter,
                  Fonts.h4Black,
                  Fonts.neutral00]}
              >
                {`${userData.firstname} ${userData.lastname?.toUpperCase()}`}
              </Text>
              {userData.club
              // TODO: display club shield
                ? null
                : (
                  <Button
                    isOption
                    onPress={handleFindClub}
                    title={t('profile.actions.findClub')}
                    variant="SecondaryLight"
                  />
                )}
            </View>
            )}
          </View>
        </WithDataWrapper>
        <View style={[Spaces.gap[24], Spaces.marginTop[24]]}>
          <Button
            onPress={handleEditUser}
            title={t('profile.actions.edit')}
            variant="Primary"
          />
          <Button
            onPress={handleLogout}
            title={t('profile.actions.logout')}
            variant="Secondary"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default Profile;
