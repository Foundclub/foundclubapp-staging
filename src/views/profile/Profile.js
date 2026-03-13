import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, RefreshControl, Text, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { deleteAccount } from '@/services/auth/authService';

import { getImageUrl } from '@/utils/imageUrl';

/** @typedef {import('@/store/types').AuthSession} AuthSession */

/**
 * Profile screen component. Displays user information and profile management options.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile screen component
 */
function Profile({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [{ fcmToken }] = useAppContext();
  const { getClubInitials } = useClub();
  const {
    addAccount,
    authSessions,
    canEditClub,
    canJoinClub,
    canManageTeam,
    logoutMutation,
    refetchUserData,
    switchAccount,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();

  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState(/** @type {string | null} */ (null));
  const safeAuthSessions = authSessions || [];
  const multisportClubs = userData?.multisportClubs || [];

  useEffect(() => {
    if (!route?.params?.openAccountModal) return;
    setIsAccountModalVisible(true);
    navigation.setParams({ openAccountModal: false });
  }, [navigation, route?.params?.openAccountModal]);

  const canManageClub = useMemo(() => {
    if (!userData?.club?.documentId) {
      return false;
    }
    return canEditClub(userData?.club?.documentId);
  }, [userData, canEditClub]);

  // Check if user is admin of a MultisportClub
  const canManageMultisportClub = useMemo(() => multisportClubs.length > 0, [multisportClubs]);

  // Get the first multisport club for quick access
  const firstMultisportClub = useMemo(() => multisportClubs[0] || null, [multisportClubs]);

  const handleEditUser = () => {
    navigation.navigate(RouteNames.ProfileEdit);
  };

  const handleFindClub = () => {
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.ClubList,
    });
  };

  const handleFindTeam = () => {
    navigation.navigate(RouteNames.SearchClubs);
  };

  const handleLogout = () => {
    logoutMutation.mutate(fcmToken || '');
  };

  const handleOpenClub = () => {
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: userData?.club?.documentId },
      screen: RouteNames.Club,
    });
  };

  /**
   * Opens the multisport club dashboard screen.
   * @param {string | undefined} cmId - The documentId of the MultisportClub
   */
  const handleOpenMultisportClub = (cmId) => {
    if (!cmId) return;
    navigation.navigate(RouteNames.CMDashboard, { cmId });
  };

  /**
   * Opens the team screen.
   * @param {string} teamId - The ID of the team to open
   * @returns {void}
   */
  const handleOpenTeam = (teamId) => {
    navigation.navigate(RouteNames.TeamStack, {
      params: { teamId },
      screen: RouteNames.TeamDetails,
    });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onError: (error) => {
      const normalizedError = /** @type {any} */ (error);
      // Extract specific error message if available
      const errorMessage = normalizedError?.response?.data?.error?.message
        || normalizedError?.message
        || t('profile.alerts.deleteError', 'Une erreur est survenue lors de la suppression du compte.');

      Alert.alert(t('common.error'), errorMessage);
    },
    onSuccess: () => {
      logoutMutation.mutate(fcmToken || '');
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

  const handleOpenRequestsHub = () => {
    navigateToRequestsHub(navigation, {
      initialFilter: 'all',
      source: 'profile',
    });
  };

  const handleSwitchAccount = async (/** @type {AuthSession} */ session) => {
    const targetId = session?.user?.documentId || session?.user?.id;
    if (!targetId || switchingAccountId) return;

    setSwitchingAccountId(targetId);
    try {
      await switchAccount(session);
      setIsAccountModalVisible(false);
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const handleAddAccount = () => {
    // Limit to 5 accounts maximum
    const MAX_ACCOUNTS = 5;
    if (safeAuthSessions.length >= MAX_ACCOUNTS) {
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
    const clubIdentitySize = 44;
    const clubIdentityRadius = clubIdentitySize / 2;
    const clubRowStyle = [
      Alignments.row,
      Alignments.alignCenter,
      Spaces.gap[8],
      { minWidth: 0, paddingRight: 4, width: '100%' },
    ];

    // Check if user has a regular club
    if (userData?.club) {
      return (
        <TouchableOpacity
          onPress={handleOpenClub}
          style={clubRowStyle}
        >
          {userData?.club?.logo?.url ? (
            <ProfileAvatar
              imageStyle={{ borderRadius: clubIdentityRadius }}
              imageUrl={userData.club.logo.url}
              size={clubIdentitySize}
              variant="logo"
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.neutral00,
                { borderRadius: clubIdentityRadius },
              ]}
            />
          ) : (
            <TeamShield
              initials={
                userData?.club?.name
                  ? getClubInitials(userData.club?.name) : ''
              }
              size={clubIdentitySize}
            />
          )}
          <View style={[
            { height: 24, width: 1 },
            ApplicationStyle.backgroundColor.neutral300,
          ]}
          />
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1, minWidth: 0 }]}
          >
            {userData?.club?.name}
          </Text>
        </TouchableOpacity>
      );
    }

    // Check if user is admin of a MultisportClub (Dirigeant Omnisport)
    if (multisportClubs.length > 0) {
      const cm = multisportClubs[0];
      return (
        <TouchableOpacity
          onPress={() => handleOpenMultisportClub(cm.documentId)}
          style={clubRowStyle}
        >
          {cm?.logo?.url ? (
            <ProfileAvatar
              imageStyle={{ borderRadius: clubIdentityRadius }}
              imageUrl={cm.logo.url}
              size={clubIdentitySize}
              variant="logo"
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.primary500,
                { borderRadius: clubIdentityRadius },
              ]}
            />
          ) : (
            <TeamShield
              initials={cm?.name ? getClubInitials(cm.name) : 'CM'}
              size={clubIdentitySize}
            />
          )}
          <View style={[
            { height: 24, width: 1 },
            ApplicationStyle.backgroundColor.primary500,
          ]}
          />
          <View style={[Spaces.gap[4], { flex: 1, minWidth: 0 }]}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={2}
              style={[Fonts.p2Bold, Fonts.neutral00]}
            >
              {cm?.name}
            </Text>
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: '#01b3f4', // primary500
              borderRadius: 3,
              paddingHorizontal: 6,
              paddingVertical: 1,
            }}
            >
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
          style={clubRowStyle}
        >
          {team?.club?.logo?.url ? (
            <ProfileAvatar
              imageStyle={{ borderRadius: clubIdentityRadius }}
              imageUrl={team.club.logo.url}
              size={clubIdentitySize}
              variant="logo"
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.neutral00,
                { borderRadius: clubIdentityRadius },
              ]}
            />
          ) : (
            <TeamShield
              initials={
                team?.club?.name
                  ? getClubInitials(team.club?.name) : ''
              }
              size={clubIdentitySize}
            />
          )}
          <View style={[
            { height: 24, width: 1 },
            ApplicationStyle.backgroundColor.neutral300,
          ]}
          />
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1, minWidth: 0 }]}
          >
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

  const activeProfileTutorialId = route?.params?.tutorialId === TutorialIds.ACCOUNT_SWITCHER_MODAL
    ? TutorialIds.ACCOUNT_SWITCHER_MODAL
    : route?.params?.tutorialId === TutorialIds.LOGOUT_CONFIRMATION
      ? TutorialIds.LOGOUT_CONFIRMATION
      : TutorialIds.PROFILE_MAIN;
  const isProfileMainTutorial = activeProfileTutorialId === TutorialIds.PROFILE_MAIN;
  const isAccountSwitcherTutorial = activeProfileTutorialId === TutorialIds.ACCOUNT_SWITCHER_MODAL;
  const isLogoutTutorial = activeProfileTutorialId === TutorialIds.LOGOUT_CONFIRMATION;

  const profileActionsContent = (
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
          title={t('profile.actions.manageClub', 'G\u00e9rer mon club')}
        />
      ) : null}
      <TabButton
        isActive={false}
        onPress={() => navigation.navigate(RouteNames.SearchAlerts)}
        title={t('profile.actions.manageAlerts', 'G\u00e9rer mes alertes')}
      />
      {canManageTeam ? (
        <TabButton
          isActive={false}
          onPress={handleOpenRequestsHub}
          title={t('profile.actions.manageRequests', 'Gérer mes demandes')}
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
  );

  const accountSwitcherContent = (
    <View style={[Spaces.gap[12], Spaces.paddingVertical[16]]}>
      {safeAuthSessions.map((session, index) => {
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
            disabled={Boolean(switchingAccountId)}
            key={index}
            onPress={() => !isCurrent && !switchingAccountId && handleSwitchAccount(session)}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.padding[12],
              ApplicationStyle.borderRadius8,
              ApplicationStyle.backgroundColor.primary700,
              isCurrent && { borderColor: '#01b3f4', borderWidth: 1 },
              switchingAccountId && { opacity: 0.6 },
            ]}
          >
            <ProfileAvatar
              imageUrl={avatarUrl}
              size={40}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                {displayName}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {roleName}
              </Text>
            </View>
            {switchingAccountId === (session?.user?.documentId || session?.user?.id) && (
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>Changement...</Text>
            )}
            {isCurrent && switchingAccountId !== (session?.user?.documentId || session?.user?.id) && (
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
  );

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={activeProfileTutorialId}
      userId={userData?.documentId}
    >
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
                Alignments.alignStart,
                Spaces.gap[16],
              ]}
            >
              <ProfileAvatar
                imageStyle={{ borderRadius: 80 }}
                imageUrl={userData?.avatar?.url}
                size={80}
                style={[
                  ApplicationStyle.borderColor.neutral00,
                  ApplicationStyle.borderWidth1,
                  { borderRadius: 80 },
                ]}
              />
              {userData?.firstname && userData?.lastname && (
              <View style={[
                { flex: 1, minWidth: 0 },
                Alignments.justifyStart,
                Alignments.alignStart,
                Spaces.gap[12],
              ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
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
          {/* Sports History Section - prioritize this block at top of profile content */}
          <UserHistorySection
            bestLevel={
              typeof userData?.bestLevel === 'string'
                ? userData.bestLevel
                : userData?.bestLevel?.name
            }
            isOwnProfile
            onAddPress={() => navigation.navigate(RouteNames.HistoryWizardCategory)}
            onEditPress={() => {
              // TODO: Pass entry to wizard for editing
              navigation.navigate(RouteNames.HistoryWizardCategory);
            }}
            preferredSport={
              typeof userData?.preferredSport === 'string'
                ? userData.preferredSport
                : userData?.preferredSport?.name
            }
            userId={undefined}
          />

          {isProfileMainTutorial ? (
            <OnboardingWrapper
              description="Depuis cette zone, vous pouvez modifier votre profil, gérer vos demandes et changer de compte."
              id="profile-main-actions"
              order={1}
              spotlight={{
                borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
              }}
              title="Actions profil"
            >
              {profileActionsContent}
            </OnboardingWrapper>
          ) : profileActionsContent}

          {isLogoutTutorial ? (
            <OnboardingWrapper
              description="Ce bouton lance la confirmation de déconnexion de votre session."
              id="profile-logout-action"
              order={2}
              spotlight={{
                borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
              }}
              title="Déconnexion"
            >
              <Button
                onPress={handleLogout}
                title={t('profile.actions.logout')}
                variant="Secondary"
              />
            </OnboardingWrapper>
          ) : (
            <Button
              onPress={handleLogout}
              title={t('profile.actions.logout')}
              variant="Secondary"
            />
          )}
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
          contentContainerStyle={{ paddingBottom: 8 }}
          hideCloseButton
          isVisible={isAccountModalVisible}
          useSafeAreaBottomInset={false}
        >
          {isAccountSwitcherTutorial ? (
            <OnboardingWrapper
              description="Choisissez un compte actif ou ajoutez un nouveau compte connecte."
              id="profile-account-switcher-modal"
              order={1}
              spotlight={{
                borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
              }}
              title="Changer de compte"
            >
              {accountSwitcherContent}
            </OnboardingWrapper>
          ) : accountSwitcherContent}
        </BottomModal>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default Profile;
