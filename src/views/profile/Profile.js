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
  Image,
  Platform,
  RefreshControl, Text, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { getSubscriptionQuotaItems } from '@/domains/subscription/subscriptionDecision';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { deleteAccount } from '@/services/auth/authService';

/** @typedef {import('@/store/types').AuthSession} AuthSession */

// Design 13c « l'abonnement au centre » : jetons de surface locaux (translucides,
// hors palette de tokens car spécifiques à cet écran).
const SURFACE = {
  cardBg: 'rgba(4,31,44,0.82)',
  cardBorder: 'rgba(1,179,244,0.24)',
  divider: 'rgba(255,255,255,0.08)',
  iconTileClub: 'rgba(255,40,79,0.12)',
  iconTileDefault: 'rgba(1,179,244,0.12)',
  quotaTrack: 'rgba(255,255,255,0.08)',
  sectionBg: 'rgba(255,255,255,0.04)',
  sectionBorder: 'rgba(255,255,255,0.09)',
};

/**
 * Profile screen component. Displays user information and profile management options.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile screen component
 */
function Profile({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [{ fcmToken }] = useAppContext();
  const {
    addAccount,
    authSessions,
    canEditClub,
    canManageTeam,
    freeUsageSummary,
    logoutMutation,
    refetchUserData,
    subscriptionAccessLevel,
    switchAccount,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();

  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState(/** @type {string | null} */ (null));
  const safeAuthSessions = authSessions || [];
  const hasMultipleConnectedAccounts = safeAuthSessions.length > 1;
  const currentRoleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionExperience = currentRoleKey === 'coach'
    || currentRoleKey === 'president'
    || currentRoleKey === 'superAdmin';
  const isSuperAdmin = currentRoleKey === 'superAdmin';
  const multisportClubs = useMemo(
    () => userData?.multisportClubs || [],
    [userData?.multisportClubs],
  );

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

  const visibleSubscriptionQuotaItems = useMemo(
    () => getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel).slice(0, 2),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  // Check if user is admin of a MultisportClub
  const canManageMultisportClub = useMemo(() => multisportClubs.length > 0, [multisportClubs]);

  // Get the first multisport club for quick access
  const firstMultisportClub = useMemo(() => multisportClubs[0] || null, [multisportClubs]);

  const handleEditUser = () => {
    navigation.navigate(RouteNames.ProfileEdit);
  };

  const handleViewProfile = () => {
    navigation.navigate(RouteNames.UserDetails);
  };

  const handleOpenMyCard = () => {
    navigation.navigate(RouteNames.PlayerCard);
  };

  const handleOpenSubscriptionOverview = () => {
    if (!canShowSubscriptionExperience) {
      return;
    }
    navigation.navigate(RouteNames.SubscriptionOverview);
  };

  const handleLogout = () => {
    logoutMutation.mutate(fcmToken || '');
  };

  const handleLogoutFromAccountSwitcher = () => {
    setIsAccountModalVisible(false);
    handleLogout();
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
    // Keep a little room for multi-role QA and real multi-account users.
    const MAX_ACCOUNTS = 7;
    if (safeAuthSessions.length >= MAX_ACCOUNTS) {
      Alert.alert(
        t('profile.alerts.maxAccounts.title'),
        t('profile.alerts.maxAccounts.message', { count: MAX_ACCOUNTS }),
      );
      return;
    }
    setIsAccountModalVisible(false);
    addAccount();
  };

  const handleToggleAccountSwitcher = () => {
    if (Platform.OS === 'web') {
      setIsAccountModalVisible((currentValue) => !currentValue);
      return;
    }

    setIsAccountModalVisible(true);
  };

  useFocusEffect(
    useCallback(() => {
      refetchUserData();
    }, [refetchUserData]),
  );

  let activeProfileTutorialId = TutorialIds.PROFILE_MAIN;
  if (route?.params?.tutorialId === TutorialIds.ACCOUNT_SWITCHER_MODAL) {
    activeProfileTutorialId = TutorialIds.ACCOUNT_SWITCHER_MODAL;
  } else if (route?.params?.tutorialId === TutorialIds.LOGOUT_CONFIRMATION) {
    activeProfileTutorialId = TutorialIds.LOGOUT_CONFIRMATION;
  }
  const isProfileMainTutorial = activeProfileTutorialId === TutorialIds.PROFILE_MAIN;
  const isAccountSwitcherTutorial = activeProfileTutorialId === TutorialIds.ACCOUNT_SWITCHER_MODAL;
  const isLogoutTutorial = activeProfileTutorialId === TutorialIds.LOGOUT_CONFIRMATION;

  // ----- Identité compacte -----
  const identityFirstName = userData?.firstname || '';
  const identityLastName = userData?.lastname || '';
  const identityFullName = `${identityFirstName} ${identityLastName}`.trim();
  const identityInitials = `${identityFirstName.charAt(0)}${identityLastName.charAt(0)}`.toUpperCase();
  const identityRoleLabel = t(`profile.identity.roles.${currentRoleKey}`, t('profile.identity.roles.new'));
  const identityClubName = userData?.club?.name
    || firstMultisportClub?.name
    || userData?.myTeams?.[0]?.club?.name
    || userData?.myTeams?.[0]?.name
    || '';
  const identitySubline = identityClubName
    ? t('profile.identity.roleWithClub', { club: identityClubName, role: identityRoleLabel })
    : identityRoleLabel;
  let identityClub = null;
  let identityClubOnPress = null;
  if (userData?.club) {
    identityClub = userData.club;
    identityClubOnPress = handleOpenClub;
  } else if (firstMultisportClub) {
    identityClub = firstMultisportClub;
    identityClubOnPress = () => handleOpenMultisportClub(firstMultisportClub.documentId);
  } else if (userData?.myTeams?.[0]) {
    identityClub = userData.myTeams[0].club || userData.myTeams[0];
    identityClubOnPress = () => handleOpenTeam(userData.myTeams[0].documentId || '');
  }

  const identityContent = (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
      {userData?.avatar?.url ? (
        <ProfileAvatar
          imageStyle={{ borderRadius: 27 }}
          imageUrl={userData?.avatar?.url}
          size={54}
          style={[
            ApplicationStyle.borderColor.neutral00,
            ApplicationStyle.borderWidth1,
            { borderRadius: 27 },
          ]}
        />
      ) : (
        <View style={{
          alignItems: 'center',
          backgroundColor: 'rgba(1,179,244,0.16)',
          borderColor: 'rgba(1,179,244,0.35)',
          borderRadius: 27,
          borderWidth: 1,
          height: 54,
          justifyContent: 'center',
          width: 54,
        }}
        >
          <Text style={[Fonts.neutral00, { fontFamily: 'Montserrat-Bold', fontSize: 18 }]}>
            {identityInitials || '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text numberOfLines={1} style={[Fonts.neutral00, { fontFamily: 'Montserrat-Bold', fontSize: 17 }]}>
          {identityFullName}
        </Text>
        <Text numberOfLines={1} style={{ color: Colors.neutral300, fontSize: 12 }}>
          {identitySubline}
        </Text>
      </View>
      {identityClub ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!identityClubOnPress}
          onPress={identityClubOnPress || undefined}
        >
          <ClubLogoMark
            club={identityClub}
            logoStyle={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 17 },
            ]}
            name={identityClub?.name}
            size={34}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ----- Carte abonnement (chip 4 états + jauges humaines) -----
  const subscriptionChip = useMemo(() => {
    switch (subscriptionAccessLevel) {
      case 'CLUB':
        return {
          container: { backgroundColor: 'rgba(133,103,255,0.16)', borderColor: 'rgba(133,103,255,0.55)' },
          label: t('profile.subscription.states.club'),
          showClock: false,
          textColor: Colors.violet200,
        };
      case 'CLUB_UNVERIFIED':
        return {
          container: { backgroundColor: 'rgba(133,103,255,0.10)', borderColor: 'rgba(133,103,255,0.45)' },
          label: t('profile.subscription.states.clubUnverified'),
          showClock: true,
          textColor: Colors.violet200,
        };
      case 'TEAM':
        return {
          container: { backgroundColor: 'rgba(1,179,244,0.12)', borderColor: 'rgba(1,179,244,0.45)' },
          label: t('profile.subscription.states.team'),
          showClock: false,
          textColor: Colors.primary200,
        };
      default:
        return {
          container: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.22)' },
          label: t('profile.subscription.states.free'),
          showClock: false,
          textColor: Colors.neutral200,
        };
    }
  }, [subscriptionAccessLevel, Colors, t]);

  const subscriptionStatusKey = {
    CLUB: 'club',
    CLUB_UNVERIFIED: 'clubUnverified',
    FREE: 'free',
    TEAM: 'team',
  }[subscriptionAccessLevel] || 'free';

  const renderQuotaGauge = (item) => {
    const remaining = Number(item.remaining) || 0;
    const total = Number(item.total) || 0;
    const isAvailable = remaining > 0;
    const ratio = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
    const label = t(`profile.subscription.quota.labels.${item.quotaType}`, item.label);
    const value = isAvailable
      ? t('profile.subscription.quota.remaining', { count: remaining })
      : t('profile.subscription.quota.used');

    return (
      <View key={item.quotaType} style={{ gap: 6 }}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { gap: 8 }]}>
          <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 12.5 }}>
            {label}
          </Text>
          <Text style={{ color: isAvailable ? Colors.primary200 : Colors.neutral400, fontSize: 12 }}>
            {value}
          </Text>
        </View>
        <View style={{
          backgroundColor: SURFACE.quotaTrack, borderRadius: 3, height: 5, overflow: 'hidden',
        }}
        >
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 3,
            height: 5,
            width: `${isAvailable ? ratio * 100 : 0}%`,
          }}
          />
        </View>
      </View>
    );
  };

  const subscriptionCard = canShowSubscriptionExperience ? (
    <View style={{
      backgroundColor: SURFACE.cardBg,
      borderColor: SURFACE.cardBorder,
      borderRadius: 18,
      borderWidth: 1,
      gap: 14,
      padding: 16,
    }}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { gap: 12 }]}>
        <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 15 }}>
          {t('profile.subscription.title')}
        </Text>
        <View style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            borderRadius: 999,
            borderWidth: 1,
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
          },
          subscriptionChip.container,
        ]}
        >
          {subscriptionChip.showClock ? (
            <Image
              source={Images.clock}
              style={{ height: 11, tintColor: subscriptionChip.textColor, width: 11 }}
            />
          ) : null}
          <Text style={{ color: subscriptionChip.textColor, fontFamily: 'Montserrat-Bold', fontSize: 11 }}>
            {subscriptionChip.label}
          </Text>
        </View>
      </View>

      {visibleSubscriptionQuotaItems.length ? (
        <View style={{ gap: 12 }}>
          {visibleSubscriptionQuotaItems.map(renderQuotaGauge)}
        </View>
      ) : (
        <Text style={{ color: Colors.neutral200, fontSize: 12.5, lineHeight: 18 }}>
          {t(`profile.subscription.status.${subscriptionStatusKey}`)}
        </Text>
      )}

      <View style={{ backgroundColor: SURFACE.divider, height: 1 }} />

      <TouchableOpacity
        accessibilityRole="button"
        onPress={handleOpenSubscriptionOverview}
        style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}
      >
        <Text style={{ color: Colors.primary500, fontFamily: 'Montserrat-Bold', fontSize: 12.5 }}>
          {t('profile.subscription.cta')}
        </Text>
        <Image source={Images.arrowRight} style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]} />
      </TouchableOpacity>
    </View>
  ) : null;

  // ----- Rangées de section -----
  const sectionLabelStyle = {
    color: Colors.neutral300,
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: /** @type {const} */ ('uppercase'),
  };
  const sectionCardStyle = {
    backgroundColor: SURFACE.sectionBg,
    borderColor: SURFACE.sectionBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  };

  /**
   * @param {{ key: string, icon: any, label: string, onPress: () => void,
   *   destructive?: boolean, isLast?: boolean }} params
   */
  const renderAccountRow = ({
    destructive = false, icon, isLast = false, key, label, onPress,
  }) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={key}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          gap: 12,
          minHeight: 48,
          paddingVertical: 12,
        },
        !isLast && { borderBottomColor: SURFACE.divider, borderBottomWidth: 1 },
      ]}
    >
      <View style={{
        alignItems: 'center',
        backgroundColor: destructive ? SURFACE.iconTileClub : SURFACE.iconTileDefault,
        borderRadius: 9,
        height: 30,
        justifyContent: 'center',
        width: 30,
      }}
      >
        <Image
          source={icon}
          style={{ height: 16, tintColor: destructive ? Colors.error300 : Colors.primary200, width: 16 }}
        />
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: destructive ? Colors.error300 : Colors.neutral00,
          flex: 1,
          fontFamily: 'Montserrat-Bold',
          fontSize: 13.5,
        }}
      >
        {label}
      </Text>
      {destructive ? null : (
        <Image source={Images.arrowRight} style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral400]} />
      )}
    </TouchableOpacity>
  );

  const activityRows = [
    {
      icon: Images.trophy, key: 'myCard', label: t('profile.actions.myCard', 'Ma carte de collection'), onPress: handleOpenMyCard,
    },
    {
      icon: Images.users, key: 'view', label: t('profile.actions.view'), onPress: handleViewProfile,
    },
    {
      icon: Images.edit, key: 'edit', label: t('profile.actions.edit'), onPress: handleEditUser,
    },
    ...(canManageClub ? [{
      icon: Images.shield, key: 'manageClub', label: t('profile.actions.manageClub'), onPress: handleOpenClub,
    }] : []),
    ...(canManageMultisportClub && firstMultisportClub ? [{
      icon: Images.shield,
      key: 'manageMultisportClub',
      label: t('profile.actions.manageClub'),
      onPress: () => handleOpenMultisportClub(firstMultisportClub.documentId),
    }] : []),
    {
      icon: Images.bell,
      key: 'alerts',
      label: t('profile.actions.manageAlerts'),
      onPress: () => navigation.navigate(RouteNames.SearchAlerts),
    },
    ...(canManageTeam ? [{
      icon: Images.envelope, key: 'requests', label: t('profile.actions.manageRequests'), onPress: handleOpenRequestsHub,
    }] : []),
  ];

  const profileActivitySection = (
    <View style={{ gap: 10 }}>
      <Text style={sectionLabelStyle}>{t('profile.sections.profileActivity')}</Text>
      <View style={sectionCardStyle}>
        {activityRows.map((row, index) => renderAccountRow({
          ...row,
          isLast: index === activityRows.length - 1,
        }))}
      </View>
    </View>
  );

  const accountNonLogoutRows = [
    {
      icon: Images.share2,
      key: 'switchAccount',
      label: t('profile.actions.switchAccount'),
      onPress: handleToggleAccountSwitcher,
    },
    ...(isSuperAdmin ? [
      {
        icon: Images.shield,
        key: 'adminDashboardClassic',
        label: t('profile.actions.adminDashboardClassic'),
        onPress: () => navigation.navigate(RouteNames.AdminStack, { screen: RouteNames.AdminDashboard }),
      },
      {
        icon: Images.flag,
        key: 'superAdminLeagueDashboard',
        label: t('profile.actions.superAdminLeagueDashboard'),
        onPress: () => navigation.navigate(RouteNames.AdminStack, { screen: RouteNames.SuperAdminHome }),
      },
    ] : []),
  ];

  const logoutRow = renderAccountRow({
    destructive: true,
    icon: Images.arrowRight,
    isLast: true,
    key: 'logout',
    label: t('profile.actions.logout'),
    onPress: handleLogout,
  });

  const accountSection = (
    <View style={{ gap: 10 }}>
      <Text style={sectionLabelStyle}>{t('profile.sections.account')}</Text>
      <View style={sectionCardStyle}>
        {/* Les rangées non destructives gardent toujours un trait (la déconnexion suit). */}
        {accountNonLogoutRows.map((row) => renderAccountRow({ ...row, isLast: false }))}
        {isLogoutTutorial ? (
          <OnboardingWrapper
            description="Ce bouton lance la confirmation de déconnexion de ta session."
            id="profile-logout-action"
            order={2}
            spotlight={{
              borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
            }}
            title="Déconnexion"
          >
            {logoutRow}
          </OnboardingWrapper>
        ) : logoutRow}
      </View>
    </View>
  );

  // ----- Bascule de compte (modal / panneau web) : logique inchangée -----
  const accountSwitcherContent = (
    <View style={[Spaces.gap[12], Spaces.paddingVertical[16]]}>
      {!hasMultipleConnectedAccounts ? (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('profile.accountSwitcher.singleAccountHint')}
        </Text>
      ) : null}
      {safeAuthSessions.map((session, index) => {
        const isCurrent = session?.user?.documentId === userData?.documentId;
        const sessionKey = session?.user?.documentId || session?.user?.id || `session-${index}`;
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
            key={sessionKey}
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
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('profile.accountSwitcher.switching')}</Text>
            )}
            {isCurrent && switchingAccountId !== (session?.user?.documentId || session?.user?.id) && (
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('profile.accountSwitcher.active')}</Text>
            )}
          </TouchableOpacity>
        );
      })}

      <Button
        onPress={handleAddAccount}
        title={t('profile.actions.addAccount')}
        variant="Secondary"
      />
      <Button
        disabled={logoutMutation.isPending}
        isLoading={logoutMutation.isPending}
        onPress={handleLogoutFromAccountSwitcher}
        title={t('profile.actions.logout')}
        variant="Secondary"
      />
    </View>
  );

  const accountSwitcherPanel = (
    <View
      style={[
        Spaces.gap[12],
        Spaces.padding[16],
        ApplicationStyle.borderRadius12,
        ApplicationStyle.borderWidth1,
        ApplicationStyle.borderColor.primary100,
        ApplicationStyle.backgroundColor.primary700,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('profile.accountSwitcher.title')}
        </Text>
        <TouchableOpacity onPress={() => setIsAccountModalVisible(false)}>
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('profile.accountSwitcher.close')}
          </Text>
        </TouchableOpacity>
      </View>
      {accountSwitcherContent}
    </View>
  );

  const accountSwitcherTutorialContent = isAccountSwitcherTutorial ? (
    <OnboardingWrapper
      description="Choisis un compte actif ou ajoute un nouveau compte connecté."
      id="profile-account-switcher-modal"
      order={1}
      spotlight={{
        borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
      }}
      title="Changer de compte"
    >
      {accountSwitcherPanel}
    </OnboardingWrapper>
  ) : accountSwitcherPanel;

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
        bottomInsetMode="screen"
        contentContainerStyle={[
          Spaces.paddingTop[0],
          Spaces.paddingBottom[12],
          Alignments.fill,
        ]}
      >
        {/* En-tête : titre centré. La flèche retour ronde est fournie par le header natif de la stack. */}
        <View style={[Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
            {t('profile.titles.profile').toUpperCase()}
          </Text>
          <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, gap: 18, paddingBottom: 8, paddingTop: 20,
          }}
          refreshControl={(
            <RefreshControl
              onRefresh={() => {
                refetchUserData();
              }}
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
            {identityContent}
          </WithDataWrapper>

          {subscriptionCard}

          {isProfileMainTutorial ? (
            <OnboardingWrapper
              description="Depuis cette zone, tu peux consulter ton profil, gérer tes demandes et changer de compte."
              id="profile-main-actions"
              order={1}
              spotlight={{
                borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
              }}
              title="Actions profil"
            >
              {profileActivitySection}
            </OnboardingWrapper>
          ) : profileActivitySection}

          {accountSection}

          {Platform.OS === 'web' && isAccountModalVisible ? accountSwitcherTutorialContent : null}
        </ScrollView>

        {/* Pied fixe : lien discret, toujours visible sous la liste (design 13c). */}
        <View style={[Alignments.fullWidth, Alignments.alignCenter, { paddingTop: 12 }]}>
          <TouchableOpacity onPress={handleDeleteAccount}>
            <Text style={[Fonts.p2, Fonts.neutral300, Fonts.underlineText]}>
              {t('profile.actions.deleteAccount')}
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? null : (
          <BottomModal
            close={() => setIsAccountModalVisible(false)}
            contentContainerStyle={{ paddingBottom: 8 }}
            hideCloseButton
            isVisible={isAccountModalVisible}
            useSafeAreaBottomInset={false}
          >
            {isAccountSwitcherTutorial ? (
              <OnboardingWrapper
                description="Choisis un compte actif ou ajoute un nouveau compte connecté."
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
        )}
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}
export default Profile;
