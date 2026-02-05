import { useMutation } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, RefreshControl, Text, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import { deleteAccount } from '@/services/auth/authService';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection';

import { RouteNames } from '@/navigation/routeNames';
import { getImageUrl } from '@/utils/imageUrl';

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
    authSessions,
    switchAccount,
    addAccount,
  } = useAuth();

  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);

  const canManageClub = useMemo(() => {
    if (!userData?.club?.documentId) {
      return false;
    }
    return canEditClub(userData?.club?.documentId);
  }, [userData, canEditClub]);

  // Check if user is admin of a MultisportClub
  const canManageMultisportClub = useMemo(() => {
    // @ts-expect-error multisportClubs not in User type yet
    return (userData?.multisportClubs?.length || 0) > 0;
  }, [userData]);

  // Get the first multisport club for quick access
  const firstMultisportClub = useMemo(() => {
    // @ts-expect-error multisportClubs not in User type yet  
    return userData?.multisportClubs?.[0] || null;
  }, [userData]);

  const handleEditUser = () => {
    navigation.navigate(RouteNames.ProfileEdit);
  };

  const handleFindClub = () => {
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.ClubList,
    });
  };

  const handleFindTeam = () => {
    navigation.navigate(RouteNames.HomeTab);
  };

  const handleLogout = () => {
    logoutMutation.mutate(fcmToken || '');
  };

  const handleOpenClub = () => {
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.Club,
      params: { clubId: userData?.club?.documentId },
    });
  };

  /**
   * Opens the multisport club dashboard screen.
   * @param {string} cmId - The documentId of the MultisportClub
   */
  const handleOpenMultisportClub = (cmId) => {
    navigation.navigate(RouteNames.CMDashboard, { cmId });
  };

  /**
   * Opens the team screen.
   * @param {string} teamId - The ID of the team to open
   * @returns {void}
   */
  const handleOpenTeam = (teamId) => {
    navigation.navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamDetails,
      params: { teamId },
    });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      logoutMutation.mutate(fcmToken || '');
    },
    onError: (error) => {
      // Extract specific error message if available
      const errorMessage = error?.response?.data?.error?.message 
        || error?.message 
        || t('profile.alerts.deleteError', 'Une erreur est survenue lors de la suppression du compte.');

      Alert.alert(t('common.error'), errorMessage);
    },
  });

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
            deleteAccountMutation.mutate();
          },
          style: 'destructive',
          text: t('profile.alerts.deleteAlert.actions.confirm'),
        },
      ],
    );
  };

  const handleManageClubMembershipRequests = () => {
    if (userData?.club?.documentId) {
      navigation.navigate(RouteNames.ClubStack, {
        screen: RouteNames.ClubMembershipRequests,
        params: { clubId: userData.club.documentId },
      });
    }
  };

  const handleManageTeamMembershipRequests = () => {
    if (userData?.club?.documentId) {
      navigation.navigate(RouteNames.TeamStack, {
        screen: RouteNames.TeamMembershipRequests,
        params: { teamIds: userData.trainedTeams?.map((team) => team.documentId) },
      });
    }
  };

  const handleSwitchAccount = (session) => {
    switchAccount(session);
    setIsAccountModalVisible(false);
  };

  const handleAddAccount = () => {
    // Limit to 5 accounts maximum
    const MAX_ACCOUNTS = 5;
    if (authSessions?.length >= MAX_ACCOUNTS) {
      Alert.alert(
        t('profile.alerts.maxAccounts.title', 'Limite atteinte'),
        t('profile.alerts.maxAccounts.message', `Vous ne pouvez pas avoir plus de ${MAX_ACCOUNTS} comptes connectés.`),
      );
      return;
    }
    setIsAccountModalVisible(false);
    addAccount();
  };

  const renderUserClub = () => {
    // Check if user has a regular club
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
          {userData?.club?.logo?.url ? (
            <ProfileAvatar
              imageUrl={userData.club.logo.url}
              size={60}
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.neutral00,
                { borderRadius: 60 },
              ]}
              imageStyle={{ borderRadius: 60 }}
            />
          ) : (
            <TeamShield
              initials={
                userData?.club?.name
                  ? getClubInitials(userData.club?.name) : ''
              }
              isSmall
            />
          )}
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
    
    // Check if user is admin of a MultisportClub (Dirigeant Omnisport)
    if (userData?.multisportClubs?.length > 0) {
      const cm = userData.multisportClubs[0];
      return (
        <TouchableOpacity
          onPress={() => handleOpenMultisportClub(cm.documentId)}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[16],
            { marginTop: -10, maxWidth: '85%' }]}
        >
          {cm?.logo?.url ? (
            <ProfileAvatar
              imageUrl={cm.logo.url}
              size={60}
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.primary500,
                { borderRadius: 60 },
              ]}
              imageStyle={{ borderRadius: 60 }}
            />
          ) : (
            <TeamShield
              initials={cm?.name ? getClubInitials(cm.name) : 'CM'}
              isSmall
            />
          )}
          <View style={[
            { height: 40, width: 1 },
            ApplicationStyle.backgroundColor.primary500,
          ]}
          />
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[Fonts.p1Black, Fonts.neutral00]}
            >
              {cm?.name}
            </Text>
            <View style={{
              backgroundColor: '#01b3f4', // primary500
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 3,
              alignSelf: 'flex-start',
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>
                CM
              </Text>
            </View>
          </View>
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
          {team?.club?.logo?.url ? (
            <ProfileAvatar
              imageUrl={team.club.logo.url}
              size={60}
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.neutral00,
                { borderRadius: 60 },
              ]}
              imageStyle={{ borderRadius: 60 }}
            />
          ) : (
            <TeamShield
              initials={
                team?.club?.name
                  ? getClubInitials(team.club?.name) : ''
              }
              isSmall
            />
          )}
          <View style={[
            { height: 40, width: 1 },
            ApplicationStyle.backgroundColor.neutral300,
          ]}
          />
          <Text numberOfLines={2} style={[Fonts.p1Black, Fonts.neutral00]}>
            {team?.club?.name || team?.name}
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
            <ProfileAvatar
              imageUrl={userData?.avatar?.url}
              size={80}
              style={[
                ApplicationStyle.borderColor.neutral00,
                ApplicationStyle.borderWidth1,
                { borderRadius: 80 },
              ]}
              imageStyle={{ borderRadius: 80 }}
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
          {canManageMultisportClub && firstMultisportClub ? (
            <TabButton
              isActive={false}
              onPress={() => handleOpenMultisportClub(firstMultisportClub.documentId)}
              title={t('profile.actions.manageClub', 'Gérer mon club')}
            />
          ) : null}
          <TabButton
            isActive={false}
            onPress={() => navigation.navigate(RouteNames.SearchAlerts)}
            title={t('profile.actions.manageAlerts', 'Gérer mes alertes')}
          />
          {canManageClub ? (
            <TabButton
              isActive={false}
              onPress={handleManageClubMembershipRequests}
              title={t('profile.actions.manageClubJoinRequests')}
            />
          ) : null}
          {canManageClub ? (
            <TabButton
              isActive={false}
              onPress={() => navigation.navigate(RouteNames.ClubStack, {
                screen: RouteNames.RequestsDashboard,
                params: { clubId: userData?.club?.documentId },
              })}
              title={t('profile.actions.manageEventRequests', 'Gérer les demandes d\'événements')}
            />
          ) : null}
          {canManageTeam && userData?.club ? (
            <TabButton
              isActive={false}
              onPress={handleManageTeamMembershipRequests}
              title={t('profile.actions.manageTeamJoinRequests')}
            />
          ) : null}
          {userData?.role?.name === USER_ROLES.superAdmin ? (
            <TabButton
              isActive={false}
              onPress={() => navigation.navigate(RouteNames.AdminStack, {
                screen: RouteNames.AdminDashboard,
              })}
              title="Espace Administration"
            />
          ) : null}

          <TabButton
            isActive={false}
            onPress={() => setIsAccountModalVisible(true)}
            title={t('profile.actions.switchAccount', 'Changer de compte')}
          />
        </View>

        {/* Sports History Section */}
        <UserHistorySection
          isOwnProfile={true}
          bestLevel={userData?.bestLevel}
          preferredSport={userData?.preferredSport}
          onAddPress={() => navigation.navigate(RouteNames.HistoryWizardClub)}
          onEditPress={(entry) => {
            // TODO: Pass entry to wizard for editing
            navigation.navigate(RouteNames.HistoryWizardClub);
          }}
        />

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
      <BottomModal
        close={() => setIsAccountModalVisible(false)}
        hideCloseButton
        isVisible={isAccountModalVisible}
      >
        <View style={[Spaces.gap[12], Spaces.paddingVertical[16]]}>
          {authSessions?.map((session, index) => {
            const isCurrent = session?.user?.documentId === userData?.documentId;
            // For current user, use userData which has full info; for others use session data
            const user = isCurrent ? userData : session?.user;
            const displayName = user?.firstname && user?.lastname
              ? `${user.firstname} ${user.lastname}`
              : user?.phone || user?.username || 'Compte';
            const roleName = user?.role?.name === 'Authenticated' 
              ? 'Dirigeant'
              : user?.role?.name || 'Utilisateur';
            const avatarUrl = isCurrent ? userData?.avatar?.url : session?.user?.avatar?.url;
            
            return (
              <TouchableOpacity
                key={index}
                onPress={() => !isCurrent && handleSwitchAccount(session)}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.padding[12],
                  ApplicationStyle.borderRadius8,
                  ApplicationStyle.backgroundColor.primary700,
                  isCurrent && { borderWidth: 1, borderColor: '#01b3f4' },
                ]}
              >
                <ProfileAvatar
                  imageUrl={avatarUrl}
                  size={40}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {roleName}
                  </Text>
                </View>
                {isCurrent && (
                  <Text style={[Fonts.p2Bold, Fonts.primary500]}>Actif</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <Button
            onPress={handleAddAccount}
            title={t('profile.actions.addAccount', 'Ajouter un compte')}
            variant="Secondary"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default Profile;
