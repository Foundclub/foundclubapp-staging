import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, RefreshControl, Text, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
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
  const [{ fcmToken }] = useAppContext();
  const { getClubInitials } = useClub();
  const {
    canEditClub,
    canJoinClub,
    canManageTeam,
    logoutMutation,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();

  const canManageClub = useMemo(() => {
    if (!userData?.club?.documentId) {
      return false;
    }
    return canEditClub(userData?.club?.documentId);
  }, [userData, canEditClub]);

  const handleEditUser = () => {
    navigation.navigate(RouteNames.ProfileEdit);
  };

  const handleFindClub = () => {
    navigation.navigate(RouteNames.ClubList);
  };

  const handleFindTeam = () => {
    navigation.navigate(RouteNames.HomeTab);
  };

  const handleLogout = () => {
    logoutMutation.mutate(fcmToken || '');
  };

  const handleOpenClub = () => {
    navigation.navigate(RouteNames.Club, {
      clubId: userData?.club?.documentId,
    });
  };

  /**
   * Opens the team screen.
   * @param {string} teamId - The ID of the team to open
   * @returns {void}
   */
  const handleOpenTeam = (teamId) => {
    navigation.navigate(RouteNames.TeamDetails, {
      teamId,
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.alerts.deleteAlert.title'),
      t('profile.alerts.deleteAlert.subtitle'),
      [
        {
          style: 'cancel',
          text: t('profile.alerts.deleteAlert.actions.cancel'),
        },
        {
          onPress: () => {
            if (process.env.DELETE_ACCOUNT_URL) {
              Linking.openURL(process.env.DELETE_ACCOUNT_URL);
            }
          },
          text: t('profile.alerts.deleteAlert.actions.confirm'),
        },
      ],
    );
  };

  const handleManageClubMembershipRequests = () => {
    if (userData?.club?.documentId) {
      navigation.navigate(RouteNames.ClubMembershipRequests, { clubId: userData.club.documentId });
    }
  };

  const handleManageTeamMembershipRequests = () => {
    if (userData?.club?.documentId) {
      navigation.navigate(
        RouteNames.TeamMembershipRequests,
        { teamIds: userData.trainedTeams?.map((team) => team.documentId) },
      );
    }
  };

  const renderUserClub = () => {
    if (userData?.club) {
      return (
        <TouchableOpacity
          onPress={handleOpenClub}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[16],
            { marginTop: -10, maxWidth: '85%' }]}
        >
          <TeamShield
            initials={
            userData?.club?.name
              ? getClubInitials(userData.club?.name) : ''
          }
            isSmall
          />
          <View style={[
            { height: 40, width: 1 },
            ApplicationStyle.backgroundColor.neutral300,
          ]}
          />
          <Text
            numberOfLines={2}
            style={[Fonts.p1Black, Fonts.neutral00,
              { maxWidth: '90%' }]}
          >
            {userData?.club?.name}
          </Text>
        </TouchableOpacity>
      );
    }
    if (canJoinClub || userData?.role?.name === USER_ROLES.president) {
      return (
        <Button
          isOption
          onPress={handleFindClub}
          title={t('profile.actions.findClub')}
          variant="SecondaryLight"
        />
      );
    }
    if ((userData?.myTeams?.length || 0) > 0) {
      const team = userData?.myTeams?.[0];
      return team ? (
        <TouchableOpacity
          onPress={() => handleOpenTeam(team.documentId || '')}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[16],
            { marginTop: -10, maxWidth: '85%' }]}
        >
          <TeamShield
            initials={
            team?.club?.name
              ? getClubInitials(team.club?.name) : ''
          }
            isSmall
          />
          <View style={[
            { height: 40, width: 1 },
            ApplicationStyle.backgroundColor.neutral300,
          ]}
          />
          <Text numberOfLines={2} style={[Fonts.p1Black, Fonts.neutral00]}>
            {team?.name}
          </Text>
        </TouchableOpacity>
      ) : null;
    }
    return (
      <Button
        isOption
        onPress={handleFindTeam}
        title={t('profile.actions.findTeam')}
        variant="SecondaryLight"
      />
    );
  };

  useFocusEffect(
    useCallback(() => {
      refetchUserData();
    }, [refetchUserData]),
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.gap[32],
        Spaces.paddingTop[0],
        Spaces.paddingBottom[12],
        Alignments.justifySpaceBetween,
        Alignments.fill,
      ]}
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
        <View style={[{ maxWidth: '80%' }, Alignments.alignCenter]}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.primary500]}>
            {userData?.role?.name?.toUpperCase()}
          </Text>
        </View>
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
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
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
              Alignments.justifyStart,
              Alignments.alignStart,
              Spaces.gap[24],
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
              {renderUserClub()}
            </View>
            )}
          </View>
        </WithDataWrapper>
        <View style={[
          Spaces.gap[16]]}
        >
          <TabButton
            isActive={false}
            onPress={handleEditUser}
            title={t('profile.actions.edit')}
          />
          {canManageClub ? (
            <TabButton
              isActive={false}
              onPress={handleOpenClub}
              title={t('profile.actions.manageClub')}
            />
          ) : null}
          {canManageClub ? (
            <TabButton
              isActive={false}
              onPress={handleManageClubMembershipRequests}
              title={t('profile.actions.manageClubJoinRequests')}
            />
          ) : null}
          {canManageTeam && userData?.club ? (
            <TabButton
              isActive={false}
              onPress={handleManageTeamMembershipRequests}
              title={t('profile.actions.manageTeamJoinRequests')}
            />
          ) : null}
        </View>
        <Button
          onPress={handleLogout}
          title={t('profile.actions.logout')}
          variant="Secondary"
        />
        <View style={[Alignments.fullWidth, Alignments.alignCenter]}>
          <TouchableOpacity onPress={handleDeleteAccount}>
            <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
              {t('profile.actions.deleteAccount')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default Profile;
