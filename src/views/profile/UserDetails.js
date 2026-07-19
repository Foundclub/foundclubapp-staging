// @ts-nocheck
import { differenceInYears, format } from 'date-fns';
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
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetUserById } from '@/services/auth/authQueries';
import { useUserCurrentLicense } from '@/services/license/licenseQueries';
import { useGetPersonalStats } from '@/services/matchStats/matchStatsQueries';
import {
  useGetMyHistories,
  useGetUserHistories,
} from '@/services/userHistory/userHistoryQueries';

import safeJsonParse from '@/utils/safeJsonParse';

const resolveProfileStatValue = ({
  overallValue,
  selectedStatsSport,
  sportValue,
  teamValue,
}) => {
  if (teamValue !== null && teamValue !== undefined) {
    return Number(teamValue || 0);
  }

  if (selectedStatsSport === 'all') {
    return Number(overallValue || 0);
  }

  return Number(sportValue || 0);
};

const isFlagEnabled = (rawValue, defaultValue = false) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;
  const normalized = String(rawValue).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};
const isGroupChatEnabled = isFlagEnabled(process.env.FC_CHAT_GROUP_V1, true);

const toComparableId = (value) => (
  value === undefined || value === null ? '' : String(value).trim()
);

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatRoleLabel = (roleName) => {
  const normalized = String(roleName || '').trim().toLowerCase();
  if (!normalized) return 'UTILISATEUR';
  if (normalized.includes('dirigeant')) return 'DIRIGEANT';
  if (normalized.includes('entra') || normalized.includes('coach')) return 'Entraîneur';
  if (normalized.includes('super')) return 'SUPERADMIN';
  if (normalized.includes('authenticated') || normalized.includes('joueur')) return 'JOUEUR';
  return String(roleName).toUpperCase();
};

const formatSectionLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['homme', 'male', 'masculin', 'masculine'].includes(normalized)) return 'Masculin';
  if (['female', 'feminin', 'feminine', 'femme'].includes(normalized)) return 'Feminin';
  if (['mixed', 'mixte'].includes(normalized)) return 'Mixte';
  return String(value);
};

const parseAddressLabel = (address) => {
  if (!address) return '';

  let rawAddress = address;
  if (typeof rawAddress === 'string') {
    rawAddress = safeJsonParse(rawAddress, rawAddress);
    if (typeof rawAddress === 'string') {
      return rawAddress;
    }
  }

  if (typeof rawAddress !== 'object' || Array.isArray(rawAddress)) {
    return '';
  }

  const line = rawAddress.address || rawAddress.label || rawAddress.street || '';
  const postcode = rawAddress.postcode || rawAddress.zipCode || '';
  const city = rawAddress.city || rawAddress.town || '';
  const region = rawAddress.region || '';
  return [line, [postcode, city].filter(Boolean).join(' '), region]
    .filter(Boolean)
    .join(', ');
};

const formatNullableValue = (value, fallback) => {
  if (value === 0) return '0';
  if (value === false) return 'Non';
  if (value === true) return 'Oui';
  if (value === undefined || value === null) return fallback;
  const asString = String(value).trim();
  return asString || fallback;
};

const normalizeHeight = (value, fallback) => {
  const normalized = formatNullableValue(value, fallback);
  if (normalized === fallback) return fallback;
  return String(normalized).includes('m') ? normalized : `${normalized} m`;
};

const normalizeWeight = (value, fallback) => {
  const normalized = formatNullableValue(value, fallback);
  if (normalized === fallback) return fallback;
  return String(normalized).includes('kg') ? normalized : `${normalized} kg`;
};

const toTextLabel = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const nested = value?.name || value?.label || value?.title;
    return typeof nested === 'string' ? nested.trim() : '';
  }
  return String(value).trim();
};

/**
 * Render a themed section card for profile blocks.
 * @param {object} props
 * @param {import('@/theme/types').ApplicationStyle} props.ApplicationStyle
 * @param {import('react').ReactNode} props.children
 * @param {import('@/theme/types').Colors} props.Colors
 * @param {import('@/theme/types').Fonts} props.Fonts
 * @param {import('@/theme/types').Spaces} props.Spaces
 * @param {string} props.title
 * @returns {import('react').ReactElement}
 */
function SectionCard({
  ApplicationStyle,
  children,
  Colors,
  Fonts,
  Spaces,
  title,
}) {
  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: `${Colors.primary700}73`,
          borderColor: `${Colors.primary500}80`,
        },
      ]}
    >
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
        <View
          style={[
            ApplicationStyle.separator,
            { backgroundColor: `${Colors.primary500}3D` },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

/**
 * Render one profile information row with icon, label and value.
 * @param {object} props
 * @param {import('@/theme/types').Alignments} props.Alignments
 * @param {import('@/theme/types').Colors} props.Colors
 * @param {import('@/theme/types').Fonts} props.Fonts
 * @param {boolean} [props.fullWidth]
 * @param {any} props.icon
 * @param {string} props.label
 * @param {import('@/theme/types').Spaces} props.Spaces
 * @param {string} props.value
 * @param {boolean} [props.compact]
 * @returns {import('react').ReactElement}
 */
function InfoItem({
  Alignments,
  Colors,
  compact = false,
  Fonts,
  fullWidth = false,
  icon,
  label,
  Spaces,
  value,
}) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const isPlaceholder = (
    !normalizedValue
    || normalizedValue === '-'
    || normalizedValue === 'non renseigne'
    || normalizedValue === 'non renseigné'
  );
  const valueLines = fullWidth || compact ? 2 : 1;

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignStart,
        Spaces.gap[12],
        {
          marginBottom: compact ? 16 : 20,
          minHeight: compact ? 54 : 60,
          paddingRight: 6,
          width: fullWidth ? '100%' : '48%',
        },
      ]}
    >
      <View
        style={[
          Alignments.justifyCenter,
          Alignments.alignCenter,
          {
            backgroundColor: `${Colors.primary700}BF`,
            borderColor: `${Colors.primary500}80`,
            borderRadius: compact ? 18 : 20,
            borderWidth: 1,
            height: compact ? 36 : 40,
            width: compact ? 36 : 40,
          },
        ]}
      >
        <Image
          source={icon}
          style={{
            height: compact ? 16 : 18,
            tintColor: Colors.primary500,
            width: compact ? 16 : 18,
          }}
        />
      </View>
      <View style={[Spaces.gap[4], { flex: 1 }]}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{label}</Text>
        <Text
          numberOfLines={valueLines}
          style={[
            isPlaceholder ? Fonts.p2 : Fonts.p1Bold,
            isPlaceholder ? Fonts.neutral300 : Fonts.neutral00,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * User profile view component for displaying profile details.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User profile screen
 */
function UserDetails({ navigation, route }) {
  const routeUserId = route?.params?.userId;
  const { width: screenWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
  const {
    refetchUserData,
    USER_ROLES,
    userData: currentUser,
  } = useAuth();
  const { startGroupChat, startWhisperChat } = useMessaging();
  const insets = useSafeAreaInsets();

  const currentUserId = toComparableId(currentUser?.documentId || currentUser?.id);
  const requestedUserId = toComparableId(routeUserId);
  const isSelfProfile = !requestedUserId || requestedUserId === currentUserId;
  const targetUserId = requestedUserId || currentUserId;
  const [selectedStatsSport, setSelectedStatsSport] = useState('all');
  const [selectedStatsTeamKey, setSelectedStatsTeamKey] = useState('all');

  const {
    data: fetchedUser,
    error: fetchedUserError,
    isLoading: fetchedUserLoading,
    refetch: refetchFetchedUser,
  } = useGetUserById(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
  });

  const user = isSelfProfile ? currentUser : fetchedUser;

  const { refetch: refetchOwnHistories } = useGetMyHistories({
    enabled: isSelfProfile,
  });

  const { refetch: refetchTargetHistories } = useGetUserHistories(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
  });

  const profileError = isSelfProfile ? undefined : fetchedUserError?.message;
  const isProfileLoading = isSelfProfile ? !currentUser : fetchedUserLoading;
  const {
    data: personalStats,
    isLoading: isPersonalStatsLoading,
    refetch: refetchPersonalStats,
  } = useGetPersonalStats(targetUserId, {
    enabled: Boolean(targetUserId),
  });
  const {
    data: currentLicenseAssignment,
    refetch: refetchCurrentLicense,
  } = useUserCurrentLicense(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
    retry: false,
  });

  const displayName = useMemo(() => {
    const first = String(user?.firstname || '').trim();
    const last = String(user?.lastname || '').trim();
    if (first || last) return `${first} ${last}`.trim();
    if (user?.username) return String(user.username);
    if (user?.phoneNumber) return String(user.phoneNumber);
    return t('common.user', 'Utilisateur');
  }, [t, user?.firstname, user?.lastname, user?.phoneNumber, user?.username]);

  const canContact = useMemo(() => {
    if (!currentUser || !user || isSelfProfile) return false;
    const roleName = String(currentUser?.role?.name || '').toLowerCase();
    const coachRole = String(USER_ROLES.coach || '').toLowerCase();
    const presidentRole = String(USER_ROLES.president || '').toLowerCase();
    return roleName === coachRole || roleName === presidentRole;
  }, [USER_ROLES.coach, USER_ROLES.president, currentUser, isSelfProfile, user]);
  const isCompactScreen = screenWidth <= 375;
  const scrollBottomPadding = canContact ? insets.bottom + 128 : insets.bottom + 24;

  const birthdate = parseDate(user?.birthdate);
  const age = birthdate ? differenceInYears(new Date(), birthdate) : null;
  const roleLabel = formatRoleLabel(user?.role?.name);
  const sectionLabel = formatSectionLabel(user?.section?.name);
  const fallbackValue = t('userDetails.notSet', 'Non renseigné');
  const preferredSportValue = toTextLabel(user?.preferredSport);
  const bestLevelValue = toTextLabel(user?.bestLevel);

  const addressLabel = useMemo(() => parseAddressLabel(user?.address), [user?.address]);
  const availableStatSports = useMemo(() => {
    const sports = Array.isArray(personalStats?.bySport) ? personalStats.bySport : [];
    return sports.map((entry) => entry?.sport).filter(Boolean);
  }, [personalStats?.bySport]);
  const filteredPersonalTeamStats = useMemo(() => {
    const items = Array.isArray(personalStats?.byTeam) ? personalStats.byTeam : [];
    if (selectedStatsSport === 'all') return items;
    return items.filter((entry) => entry?.sport === selectedStatsSport);
  }, [personalStats?.byTeam, selectedStatsSport]);
  const availableStatTeams = useMemo(() => {
    const seen = new Set();
    return filteredPersonalTeamStats.reduce((accumulator, entry) => {
      const key = `${entry?.teamType || 'team'}:${entry?.teamDocumentId || entry?.teamName || 'team'}`;
      if (seen.has(key)) return accumulator;
      seen.add(key);
      accumulator.push({
        key,
        label: entry?.teamName || 'Equipe',
      });
      return accumulator;
    }, []);
  }, [filteredPersonalTeamStats]);
  const filteredStatsByTeamSelection = useMemo(() => {
    if (selectedStatsTeamKey === 'all') return filteredPersonalTeamStats;

    return filteredPersonalTeamStats.filter((entry) => (
      `${entry?.teamType || 'team'}:${entry?.teamDocumentId || entry?.teamName || 'team'}`
      === selectedStatsTeamKey
    ));
  }, [filteredPersonalTeamStats, selectedStatsTeamKey]);
  const selectedTeamSummary = useMemo(
    () => (selectedStatsTeamKey === 'all' ? null : filteredStatsByTeamSelection[0] || null),
    [filteredStatsByTeamSelection, selectedStatsTeamKey],
  );
  const filteredSportSummary = useMemo(() => {
    if (selectedStatsSport === 'all') return null;
    const items = Array.isArray(personalStats?.bySport) ? personalStats.bySport : [];
    return items.find((entry) => entry?.sport === selectedStatsSport) || null;
  }, [personalStats?.bySport, selectedStatsSport]);
  const profileSummaryCards = useMemo(() => {
    const matches = resolveProfileStatValue({
      overallValue: personalStats?.overall?.matches,
      selectedStatsSport,
      sportValue: filteredSportSummary?.matches,
      teamValue: selectedTeamSummary?.matches,
    });
    const wins = resolveProfileStatValue({
      overallValue: personalStats?.overall?.wins,
      selectedStatsSport,
      sportValue: filteredSportSummary?.wins,
      teamValue: selectedTeamSummary?.wins,
    });
    const losses = resolveProfileStatValue({
      overallValue: personalStats?.overall?.losses,
      selectedStatsSport,
      sportValue: filteredSportSummary?.losses,
      teamValue: selectedTeamSummary?.losses,
    });
    const minutes = resolveProfileStatValue({
      overallValue: personalStats?.overall?.minutesPlayed,
      selectedStatsSport,
      sportValue: filteredSportSummary?.minutesPlayed,
      teamValue: selectedTeamSummary?.minutesPlayed,
    });
    const primaryLabel = selectedStatsSport === 'basketball' ? 'Points' : 'Buts';
    let primaryValue;
    if (selectedTeamSummary) {
      primaryValue = Number(
        selectedTeamSummary?.sport === 'basketball'
          ? selectedTeamSummary?.points || 0
          : selectedTeamSummary?.goals || 0,
      );
    } else {
      primaryValue = resolveProfileStatValue({
        overallValue: personalStats?.overall?.football?.goals,
        selectedStatsSport,
        sportValue: selectedStatsSport === 'basketball'
          ? filteredSportSummary?.points
          : filteredSportSummary?.goals,
      });
    }
    const assists = resolveProfileStatValue({
      overallValue: personalStats?.overall?.football?.assists,
      selectedStatsSport,
      sportValue: filteredSportSummary?.assists,
      teamValue: selectedTeamSummary?.assists,
    });

    return [
      { label: 'Matchs', value: matches },
      { label: 'Victoires', value: wins },
      { label: 'Defaites', value: losses },
      { label: 'Minutes', value: minutes },
      { label: primaryLabel, value: primaryValue },
      { label: 'Passes D', value: assists },
    ];
  }, [
    filteredSportSummary,
    personalStats?.overall?.football?.assists,
    personalStats?.overall?.football?.goals,
    personalStats?.overall?.losses,
    personalStats?.overall?.matches,
    personalStats?.overall?.minutesPlayed,
    personalStats?.overall?.wins,
    selectedStatsSport,
    selectedTeamSummary,
  ]);
  const recentCoachFeedback = useMemo(() => {
    let items = [];
    if (Array.isArray(personalStats?.recentCoachFeedback)) {
      items = personalStats.recentCoachFeedback;
    } else if (Array.isArray(personalStats?.coachComments)) {
      items = personalStats.coachComments;
    }
    return items.slice(0, 5);
  }, [personalStats?.coachComments, personalStats?.recentCoachFeedback]);
  const shouldShowSportFilter = availableStatSports.length > 1;

  const coachedTeams = useMemo(() => {
    const teams = Array.isArray(user?.trainedTeams) ? user.trainedTeams : [];
    const seen = new Set();
    return teams.filter((team) => {
      const key = toComparableId(team?.documentId || team?.id || team?.name);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [user?.trainedTeams]);

  const coachedTeamIds = useMemo(
    () => new Set(
      coachedTeams
        .map((team) => toComparableId(team?.documentId || team?.id || team?.name))
        .filter(Boolean),
    ),
    [coachedTeams],
  );

  const playerTeams = useMemo(() => {
    const teams = Array.isArray(user?.myTeams) ? user.myTeams : [];
    const seen = new Set();
    return teams.filter((team) => {
      const key = toComparableId(team?.documentId || team?.id || team?.name);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);

      // Avoid showing the same team as both player and coach on profile.
      return !coachedTeamIds.has(key);
    });
  }, [coachedTeamIds, user?.myTeams]);
  const shouldShowTeamsSection = isSelfProfile || playerTeams.length > 0 || coachedTeams.length > 0;

  useEffect(() => {
    if (selectedStatsSport === 'all') return;
    if (availableStatSports.includes(selectedStatsSport)) return;
    setSelectedStatsSport('all');
  }, [availableStatSports, selectedStatsSport]);

  useEffect(() => {
    if (selectedStatsTeamKey === 'all') return;
    if (availableStatTeams.some((entry) => entry.key === selectedStatsTeamKey)) return;
    setSelectedStatsTeamKey('all');
  }, [availableStatTeams, selectedStatsTeamKey]);

  const handleRefresh = useCallback(() => {
    if (isSelfProfile) {
      refetchUserData?.();
      refetchOwnHistories?.();
      refetchPersonalStats?.();
      return;
    }
    refetchFetchedUser();
    refetchTargetHistories?.();
    refetchPersonalStats?.();
    refetchCurrentLicense?.();
  }, [
    refetchCurrentLicense,
    isSelfProfile,
    refetchFetchedUser,
    refetchOwnHistories,
    refetchPersonalStats,
    refetchTargetHistories,
    refetchUserData,
  ]);

  const handleContactUser = async () => {
    if (!user || !currentUser) return;

    const profileBirthdate = parseDate(user.birthdate);
    const computedAge = profileBirthdate ? differenceInYears(new Date(), profileBirthdate) : 18;

    if (computedAge < 13) {
      if (user.parentAccount?.documentId) {
        const participants = [user.documentId, user.parentAccount.documentId];
        const newChat = isGroupChatEnabled
          ? await startGroupChat({
            groupName: 'Contact mineur',
            participants,
          })
          : await startWhisperChat(participants);
        if (newChat?.documentId) {
          navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
        }
        return;
      }

      Alert.alert(
        t('common.errors.error', 'Erreur'),
        t(
          'userDetails.errors.minorNoParent',
          "Impossible de contacter ce joueur mineur car aucun compte parent n'est lie.",
        ),
      );
      return;
    }

    const newChat = await startWhisperChat([user.documentId]);
    if (newChat?.documentId) {
      navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
    }
  };

  const handleOpenLicense = useCallback(() => {
    const assignmentId = currentLicenseAssignment?.documentId || currentLicenseAssignment?.id;
    if (!assignmentId) return;
    navigation.navigate(RouteNames.ClubLicenseMemberDetail, {
      assignmentId,
      routeScope: 'coach',
    });
  }, [currentLicenseAssignment?.documentId, currentLicenseAssignment?.id, navigation]);

  const handleOpenClub = () => {
    if (!user?.club?.documentId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: user.club.documentId },
      screen: RouteNames.Club,
    });
  };

  const handleTeamPress = (team) => {
    const teamId = team?.documentId || team?.id;
    if (!teamId) return;
    navigation.navigate(RouteNames.TeamStack, {
      params: { teamId },
      screen: RouteNames.TeamDetails,
    });
  };

  const renderTeamCard = (team, index, prefix = 'team') => (
    <TouchableOpacity
      key={`${prefix}-${String(team?.documentId || team?.id || team?.name || index)}`}
      onPress={() => handleTeamPress(team)}
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.padding[12],
        Spaces.gap[12],
      ]}
    >
      <View style={[Alignments.row, Spaces.gap[12], Alignments.alignCenter, { flex: 1 }]}>
        <TeamShield
          initials={team?.name ? getClubInitials(team?.name) : ''}
          isNeutral
          isSmall
        />
        <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
          {team?.name || fallbackValue}
        </Text>
      </View>
      <Image
        source={Images.arrowRight}
        style={{
          height: 16, marginRight: 8, tintColor: Colors.neutral00, width: 16,
        }}
      />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.gap[24],
        Spaces.paddingBottom[0],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View
        style={[
          Alignments.justifyCenter,
          Alignments.alignCenter,
          Spaces.gap[8],
          Spaces.marginTop[8],
        ]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('userDetails.title', 'Infos profil').toUpperCase()}
        </Text>
        <View
          style={[
            ApplicationStyle.separator,
            ApplicationStyle.backgroundColor.neutral00,
            { width: 88 },
          ]}
        />
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>{roleLabel}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          Spaces.gap[24],
          { paddingBottom: scrollBottomPadding },
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={isProfileLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <WithDataWrapper
          error={profileError}
          isLoading={isProfileLoading}
          wrapperStyle={[Spaces.gap[24]]}
        >
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[16],
              {
                backgroundColor: `${Colors.primary700}73`,
                borderColor: `${Colors.primary500}80`,
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
              <ProfileAvatar
                enablePreview
                imageStyle={{ borderRadius: 72 }}
                imageUrl={user?.avatar?.url}
                size={72}
                style={[
                  ApplicationStyle.borderColor.primary500,
                  ApplicationStyle.borderWidth1,
                  { borderRadius: 72 },
                ]}
              />
              <View style={[Spaces.gap[8], { flex: 1, paddingLeft: 2 }]}>
                <Text numberOfLines={2} style={[Fonts.h4Black, Fonts.neutral00]}>
                  {displayName}
                </Text>
                {user?.club?.name ? (
                  <TouchableOpacity
                    onPress={handleOpenClub}
                    style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
                  >
                    <ClubLogoMark club={user.club} size={60} />
                    <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral200, { flex: 1 }]}>
                      {user.club.name}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {t('userDetails.empty.club', 'Aucun club renseigne')}
                  </Text>
                )}
              </View>
            </View>

            {user?.isLookingForClub ? (
              <View
                style={[
                  Alignments.selfStart,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[6],
                  ApplicationStyle.borderRadius16,
                  { backgroundColor: Colors.primary500 },
                ]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('userDetails.badges.lookingForClub', 'En recherche de club')}
                </Text>
              </View>
            ) : null}
          </View>

          <SectionCard
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            Spaces={Spaces}
            title="Stats de match"
          >
            <View style={[Spaces.gap[12]]}>
              {shouldShowSportFilter ? (
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p4Bold, Fonts.primary100]}>Sport</Text>
                  <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    <TabButton
                      isFocused={selectedStatsSport === 'all'}
                      onPress={() => setSelectedStatsSport('all')}
                      title="Tous"
                    />
                    {availableStatSports.map((sportKey) => (
                      <TabButton
                        isFocused={selectedStatsSport === sportKey}
                        key={sportKey}
                        onPress={() => {
                          setSelectedStatsSport(sportKey);
                          setSelectedStatsTeamKey('all');
                        }}
                        title={sportKey === 'basketball' ? 'Basket' : 'Football'}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {availableStatTeams.length > 1 ? (
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p4Bold, Fonts.primary100]}>Équipe</Text>
                  <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    <TabButton
                      isFocused={selectedStatsTeamKey === 'all'}
                      onPress={() => setSelectedStatsTeamKey('all')}
                      title="Toutes"
                    />
                    {availableStatTeams.map((teamOption) => (
                      <TabButton
                        isFocused={selectedStatsTeamKey === teamOption.key}
                        key={teamOption.key}
                        onPress={() => setSelectedStatsTeamKey(teamOption.key)}
                        title={teamOption.label}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {isPersonalStatsLoading ? (
                <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement des statistiques...</Text>
              ) : (
                <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
                  {profileSummaryCards.map((stat) => (
                    <View
                      key={stat.label}
                      style={[
                        ApplicationStyle.card,
                        Spaces.padding[12],
                        Spaces.gap[8],
                        {
                          backgroundColor: `${Colors.primary700}BF`,
                          borderColor: `${Colors.primary500}52`,
                          marginBottom: 12,
                          minHeight: isCompactScreen ? 92 : 98,
                          width: '48%',
                        },
                      ]}
                    >
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary500,
                          ApplicationStyle.borderRadius16,
                          { height: 4, width: isCompactScreen ? 26 : 32 },
                        ]}
                      />
                      <Text style={[Fonts.p4Bold, Fonts.primary100]}>{stat.label}</Text>
                      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{stat.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </SectionCard>

          {isSelfProfile ? (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title="Retours du coach"
            >
              <View style={[Spaces.gap[12]]}>
                {recentCoachFeedback.length ? recentCoachFeedback.map((feedback, index) => {
                  const feedbackDate = feedback?.submittedAt ? parseDate(feedback.submittedAt) : null;
                  return (
                    <View
                      key={`${feedback?.sourceType || 'feedback'}:${feedback?.sourceDocumentId || index}:${feedback?.submittedAt || 'no-date'}`}
                      style={[
                        ApplicationStyle.card,
                        Spaces.padding[12],
                        Spaces.gap[8],
                        {
                          backgroundColor: `${Colors.primary700}BF`,
                          borderColor: `${Colors.primary500}52`,
                        },
                      ]}
                    >
                      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                            {feedback?.matchLabel || feedback?.teamName || 'Match'}
                          </Text>
                          <Text style={[Fonts.p4, Fonts.neutral200]}>
                            {feedbackDate ? format(feedbackDate, 'dd/MM/yyyy') : 'Date à confirmer'}
                          </Text>
                        </View>
                        <View
                          style={[
                            Alignments.selfStart,
                            Spaces.paddingHorizontal[10],
                            Spaces.paddingVertical[6],
                            ApplicationStyle.borderRadius16,
                            { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}40`, borderWidth: 1 },
                          ]}
                        >
                          <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                            {feedback?.rating != null ? `${feedback.rating}/10` : 'Commentaire'}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={3} style={[Fonts.p3, Fonts.neutral100]}>
                        {feedback?.comment || 'Pas de commentaire detaille pour ce retour.'}
                      </Text>
                    </View>
                  );
                }) : (
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Aucun retour individuel du coach pour le moment.
                  </Text>
                )}
              </View>
            </SectionCard>
          ) : null}

          <UserHistorySection
            bestLevel={bestLevelValue || undefined}
            isOwnProfile={isSelfProfile}
            onAddPress={
              isSelfProfile
                ? () => navigation.navigate(RouteNames.HistoryWizardCategory, {
                  resetContext: true,
                  returnRoute: RouteNames.Profile,
                })
                : undefined
            }
            onEditPress={
              isSelfProfile
                ? (entry) => navigation.navigate(RouteNames.HistoryWizardCategory, {
                  editingEntry: entry,
                  returnRoute: RouteNames.Profile,
                })
                : undefined
            }
            preferredSport={preferredSportValue || undefined}
            userId={isSelfProfile ? undefined : targetUserId}
          />

          <SectionCard
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            Spaces={Spaces}
            title={t('userDetails.sections.sport', 'Profil sportif')}
          >
            <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.running}
                label={t('userDetails.fields.sport', 'Sport')}
                Spaces={Spaces}
                value={formatNullableValue(preferredSportValue, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.shield}
                label={t('userDetails.fields.bestLevel', 'Niveau')}
                Spaces={Spaces}
                value={formatNullableValue(bestLevelValue, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.pin}
                label={t('userDetails.fields.position', 'Poste')}
                Spaces={Spaces}
                value={formatNullableValue(user?.position, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.users}
                label={t('userDetails.fields.section', 'Section')}
                Spaces={Spaces}
                value={formatNullableValue(sectionLabel, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.edit}
                label={t('userDetails.fields.category', 'Catégorie')}
                Spaces={Spaces}
                value={formatNullableValue(user?.category, fallbackValue)}
              />
            </View>
          </SectionCard>

          <SectionCard
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            Spaces={Spaces}
            title={t('userDetails.sections.personal', 'Infos personnelles')}
          >
            <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.calendar}
                label={t('userDetails.fields.age', 'Age')}
                Spaces={Spaces}
                value={age === null ? fallbackValue : `${age} ans`}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.calendar}
                label={t('userDetails.fields.birthdate', 'Date de naissance')}
                Spaces={Spaces}
                value={birthdate ? format(birthdate, 'dd/MM/yyyy') : fallbackValue}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.check}
                label={t('userDetails.fields.height', 'Taille')}
                Spaces={Spaces}
                value={normalizeHeight(user?.height, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.check}
                label={t('userDetails.fields.weight', 'Poids')}
                Spaces={Spaces}
                value={normalizeWeight(user?.weight, fallbackValue)}
              />
              <View
                style={[
                  ApplicationStyle.separator,
                  ApplicationStyle.backgroundColor.primary700,
                  Spaces.marginBottom[12],
                  { opacity: 0.6 },
                ]}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.phone}
                label={t('userDetails.fields.phone', 'Téléphone')}
                Spaces={Spaces}
                value={
                  isSelfProfile
                    ? formatNullableValue(user?.phoneNumber, fallbackValue)
                    : t('userDetails.private', 'Privé')
                }
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.envelope}
                label={t('userDetails.fields.email', 'Email')}
                Spaces={Spaces}
                value={
                  isSelfProfile
                    ? formatNullableValue(user?.email, fallbackValue)
                    : t('userDetails.private', 'Privé')
                }
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.pin}
                label={t('userDetails.fields.address', 'Adresse')}
                Spaces={Spaces}
                value={
                  isSelfProfile
                    ? formatNullableValue(addressLabel, fallbackValue)
                    : t('userDetails.private', 'Privé')
                }
              />
            </View>
          </SectionCard>

          {shouldShowTeamsSection ? (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title={t('userDetails.titles.teams', 'Équipes')}
            >
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
                  {t('userDetails.teamGroups.player', 'Équipes joueur')}
                </Text>
                {playerTeams.length
                  ? playerTeams.map((team, index) => renderTeamCard(team, index, 'player'))
                  : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {t('userDetails.empty.playerTeams', 'Aucune équipe joueur')}
                    </Text>
                  )}
              </View>
              <View style={[Spaces.gap[12], Spaces.marginTop[12]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
                  {t('userDetails.teamGroups.coach', 'Équipes entraînées')}
                </Text>
                {coachedTeams.length
                  ? coachedTeams.map((team, index) => renderTeamCard(team, index, 'coach'))
                  : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {t('userDetails.empty.coachTeams', 'Aucune équipe entraînée')}
                    </Text>
                  )}
              </View>
            </SectionCard>
          ) : null}

          {!isSelfProfile && currentLicenseAssignment ? (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title="Licence"
            >
              <View style={[Spaces.gap[12]]}>
                {currentLicenseAssignment?.officialLicenseDocument?.file?.url ? (
                  <>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      Une licence officielle est disponible pour ce joueur.
                    </Text>
                    <Button
                      onPress={handleOpenLicense}
                      title="Voir la licence"
                      variant="Secondary"
                    />
                  </>
                ) : (
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    La licence officielle n est pas encore disponible pour ce joueur.
                  </Text>
                )}
              </View>
            </SectionCard>
          ) : null}
        </WithDataWrapper>
      </ScrollView>

      {canContact ? (
        <View
          style={[
            Alignments.absolute,
            Spaces.padding[16],
            {
              backgroundColor: Colors.transparent,
              bottom: insets.bottom + 8,
              left: 0,
              right: 0,
            },
          ]}
        >
          <Button
            icon="envelope"
            iconPosition="before"
            onPress={handleContactUser}
            title={t('userDetails.actions.contact', 'Contacter')}
            variant="Primary"
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

export default UserDetails;
