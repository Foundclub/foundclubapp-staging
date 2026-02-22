import { differenceInYears, format } from 'date-fns';
import { useCallback, useMemo } from 'react';
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
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetUserById } from '@/services/auth/authQueries';

const toComparableId = (value) => (value === undefined || value === null ? '' : String(value).trim());

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatRoleLabel = (roleName) => {
  const normalized = String(roleName || '').trim().toLowerCase();
  if (!normalized) return 'UTILISATEUR';
  if (normalized.includes('dirigeant')) return 'DIRIGEANT';
  if (normalized.includes('entra') || normalized.includes('coach')) return 'ENTRAINEUR';
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
    try {
      rawAddress = JSON.parse(rawAddress);
    } catch {
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
        Spaces.padding[18],
        Spaces.gap[14],
        {
          backgroundColor: Colors.primary900,
          borderColor: Colors.primary700,
        },
      ]}
    >
      <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{title}</Text>
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
  const isPlaceholder = value === '-';
  const valueLines = fullWidth || compact ? 2 : 1;

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignStart,
        Spaces.gap[10],
        {
          marginBottom: compact ? 12 : 16,
          minHeight: compact ? 46 : 52,
          paddingRight: 4,
          width: fullWidth ? '100%' : '48%',
        },
      ]}
    >
      <View
        style={[
          Alignments.justifyCenter,
          Alignments.alignCenter,
          {
            backgroundColor: Colors.primary700,
            borderRadius: compact ? 16 : 18,
            height: compact ? 32 : 36,
            width: compact ? 32 : 36,
          },
        ]}
      >
        <Image
          source={icon}
          style={{
            height: compact ? 14 : 16,
            tintColor: Colors.primary500,
            width: compact ? 14 : 16,
          }}
        />
      </View>
      <View style={[Spaces.gap[2], { flex: 1 }]}>
        <Text style={[Fonts.p2, Fonts.neutral300]}>{label}</Text>
        <Text
          numberOfLines={valueLines}
          style={[
            isPlaceholder ? Fonts.p1 : Fonts.p1Bold,
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
  const { startWhisperChat } = useMessaging();
  const insets = useSafeAreaInsets();

  const currentUserId = toComparableId(currentUser?.documentId || currentUser?.id);
  const requestedUserId = toComparableId(routeUserId);
  const isSelfProfile = !requestedUserId || requestedUserId === currentUserId;
  const targetUserId = requestedUserId || currentUserId;

  const {
    data: fetchedUser,
    error: fetchedUserError,
    isLoading: fetchedUserLoading,
    refetch: refetchFetchedUser,
  } = useGetUserById(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
  });

  const user = isSelfProfile ? currentUser : fetchedUser;

  const profileError = isSelfProfile ? undefined : fetchedUserError?.message;
  const isProfileLoading = isSelfProfile ? !currentUser : fetchedUserLoading;

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
  const sectionLabel = formatSectionLabel(user?.section?.name || user?.category);
  const fallbackValue = '-';

  const addressLabel = useMemo(() => parseAddressLabel(user?.address), [user?.address]);

  const playerTeams = useMemo(() => {
    const teams = Array.isArray(user?.myTeams) ? user.myTeams : [];
    const seen = new Set();
    return teams.filter((team) => {
      const key = toComparableId(team?.documentId || team?.id || team?.name);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [user?.myTeams]);

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

  const handleRefresh = useCallback(() => {
    if (isSelfProfile) {
      refetchUserData?.();
      return;
    }
    refetchFetchedUser();
  }, [isSelfProfile, refetchFetchedUser, refetchUserData]);

  const handleContactUser = async () => {
    if (!user || !currentUser) return;

    const profileBirthdate = parseDate(user.birthdate);
    const computedAge = profileBirthdate ? differenceInYears(new Date(), profileBirthdate) : 18;

    if (computedAge < 13) {
      if (user.parentAccount?.documentId) {
        const newChat = await startWhisperChat([
          currentUser.documentId,
          user.documentId,
          user.parentAccount.documentId,
        ]);
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

    const newChat = await startWhisperChat([currentUser.documentId, user.documentId]);
    if (newChat?.documentId) {
      navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
    }
  };

  const handleOpenClub = () => {
    if (!user?.club?.documentId) return;
    navigation.navigate(RouteNames.Club, {
      clubId: user.club.documentId,
    });
  };

  const handleTeamPress = (team) => {
    const teamId = team?.documentId || team?.id;
    if (!teamId) return;
    navigation.navigate(RouteNames.TeamDetails, { teamId });
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
        Spaces.padding[10],
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
          Spaces.gap[22],
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
          wrapperStyle={[Spaces.gap[22]]}
        >
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[18],
              Spaces.gap[16],
              {
                backgroundColor: Colors.primary900,
                borderColor: Colors.primary700,
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[18]]}>
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
                    <TeamShield
                      initials={getClubInitials(user.club.name)}
                      isSmall
                    />
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
            title={t('userDetails.sections.sport', 'Profil Sportif')}
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
                value={formatNullableValue(user?.preferredSport, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.shield}
                label={t('userDetails.fields.bestLevel', 'Niveau')}
                Spaces={Spaces}
                value={formatNullableValue(user?.bestLevel, fallbackValue)}
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
                label={t('userDetails.fields.category', 'Categorie')}
                Spaces={Spaces}
                value={formatNullableValue(user?.category, fallbackValue)}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.edit}
                label={t('userDetails.fields.history', 'Historique sportif')}
                Spaces={Spaces}
                value={formatNullableValue(user?.sportsHistory, fallbackValue)}
              />
            </View>
          </SectionCard>

          <SectionCard
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            Spaces={Spaces}
            title={t('userDetails.sections.personal', 'Infos Personnelles')}
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
                label={t('userDetails.fields.birthdate', 'Ne le')}
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
                label={t('userDetails.fields.phone', 'Telephone')}
                Spaces={Spaces}
                value={
                  isSelfProfile
                    ? formatNullableValue(user?.phoneNumber, fallbackValue)
                    : t('userDetails.private', 'Prive')
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
                    : t('userDetails.private', 'Prive')
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
                    : t('userDetails.private', 'Prive')
                }
              />
            </View>
          </SectionCard>

          <SectionCard
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            Spaces={Spaces}
            title={t('userDetails.titles.teams', 'Equipes')}
          >
            <View style={[Spaces.gap[10]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
                {t('userDetails.teamGroups.player', 'Equipes joueur')}
              </Text>
              {playerTeams.length
                ? playerTeams.map((team, index) => renderTeamCard(team, index, 'player'))
                : (
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {t('userDetails.empty.playerTeams', 'Aucune equipe joueur')}
                  </Text>
                )}
            </View>
            <View style={[Spaces.gap[10], Spaces.marginTop[12]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
                {t('userDetails.teamGroups.coach', 'Equipes entrainees')}
              </Text>
              {coachedTeams.length
                ? coachedTeams.map((team, index) => renderTeamCard(team, index, 'coach'))
                : (
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {t('userDetails.empty.coachTeams', 'Aucune equipe entrainee')}
                  </Text>
                )}
            </View>
          </SectionCard>
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
