import MaskedView from '@react-native-masked-view/masked-view';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetInvitedLeagueTeams,
  useGetMyLeagueTeam,
  useGetPendingLeagueTeams,
} from '@/services/leagueTeam/leagueTeamQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import { sortTeamsForDisplay } from '@/utils/teamSort';

/** @typedef {any} Team */
/** @typedef {any} User */
/** @typedef {{ requestId?: string } & Team} PendingTeam */

/**
 * Team list content to be used in home page or dedicated team list screen
 * @param {object} props
 * @param {string} [props.clubId] - The ID of the club to fetch teams for
 * @param {string} [props.playerId] - The ID of the player to fetch teams for
 * @param {boolean} [props.isLeagueMode] - League mode renders squads instead of classic teams.
 * @param {string} [props.assignmentTrainerId] - Optional trainer to preselect on TeamDetails trainer picker.
 * @param {string} [props.assignmentTrainerName] - Optional trainer display name for assignment flow.
 * @returns {import('react').ReactElement} Team list content component
 */
function TeamListContent({
  assignmentTrainerId = undefined,
  assignmentTrainerName = undefined,
  clubId = undefined,
  isLeagueMode = false,
  playerId = undefined,
}) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { getClubInitials } = useClub();

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const { userData } = useAuth();
  const [{ teamFilters }] = useAppContext();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactScreen = width <= 375;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const classicTeamQueryParams = useMemo(() => ({
    activities: teamFilters?.activities || undefined,
    category: Array.isArray(teamFilters?.category) && teamFilters?.category?.length
      ? teamFilters?.category
      : undefined,
    clubId,
    level: Array.isArray(teamFilters?.level) && teamFilters?.level?.length
      ? teamFilters?.level
      : undefined,
    name: debouncedSearch || teamFilters?.name?.trim() || undefined,
    playerId,
    section: teamFilters?.section || undefined,
  }), [
    clubId,
    debouncedSearch,
    playerId,
    teamFilters?.activities,
    teamFilters?.category,
    teamFilters?.level,
    teamFilters?.name,
    teamFilters?.section,
  ]);

  const filterNumber = useMemo(() => {
    if (isLeagueMode) return 0;

    let count = 0;
    if (teamFilters?.activities) count += 1;
    if (teamFilters?.section) count += 1;
    if (Array.isArray(teamFilters?.category) && teamFilters?.category?.length) count += 1;
    if (Array.isArray(teamFilters?.level) && teamFilters?.level?.length) count += 1;
    if (teamFilters?.name?.trim()) count += 1;

    return count;
  }, [
    isLeagueMode,
    teamFilters?.activities,
    teamFilters?.category,
    teamFilters?.level,
    teamFilters?.name,
    teamFilters?.section,
  ]);

  const {
    data: classicData,
    error: classicError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingClassic,
    refetch: refetchClassic,
  } = useGetTeams(classicTeamQueryParams, {
    enabled: !isLeagueMode,
  });

  const {
    data: leagueData,
    error: leagueError,
    isLoading: isLoadingLeague,
    refetch: refetchLeague,
  } = useGetMyLeagueTeam(userData?.documentId || '', { enabled: isLeagueMode && !!userData });

  const {
    data: invitedLeagueData,
    error: invitedLeagueError,
    isLoading: isLoadingInvitedLeague,
    refetch: refetchInvitedLeague,
  } = useGetInvitedLeagueTeams(userData?.documentId || '', { enabled: isLeagueMode && !!userData });

  const {
    data: pendingLeagueData,
    error: pendingLeagueError,
    isLoading: isLoadingPendingLeague,
    refetch: refetchPendingLeague,
  } = useGetPendingLeagueTeams(userData?.documentId || '', { enabled: isLeagueMode && !!userData });

  const teams = useMemo(() => {
    if (isLeagueMode) return (leagueData || []).filter(Boolean);
    return classicData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];
  }, [classicData, leagueData, isLeagueMode]);

  const isLoadingTeams = isLeagueMode
    ? (isLoadingLeague || isLoadingInvitedLeague || isLoadingPendingLeague)
    : isLoadingClassic;
  const refetchTeams = useCallback(() => {
    if (isLeagueMode) {
      return Promise.all([refetchLeague(), refetchInvitedLeague(), refetchPendingLeague()]);
    }
    return refetchClassic();
  }, [isLeagueMode, refetchClassic, refetchInvitedLeague, refetchLeague, refetchPendingLeague]);
  const error = isLeagueMode ? (leagueError || invitedLeagueError || pendingLeagueError) : classicError;

  const {
    invitedTeams,
    myTeams,
    otherTeams,
    pendingTeams,
  } = useMemo(() => {
    if (!userData) {
      return {
        invitedTeams: [],
        myTeams: [],
        otherTeams: [],
        pendingTeams: [],
      };
    }

    if (isLeagueMode) {
      const joinedIds = new Set(
        (teams || [])
          .map((/** @type {Team} */ team) => team?.documentId)
          .filter((documentId) => typeof documentId === 'string' && documentId.length > 0),
      );
      const pendingIds = new Set(
        (pendingLeagueData || [])
          .map((/** @type {Team} */ team) => team?.documentId)
          .filter((documentId) => typeof documentId === 'string' && documentId.length > 0),
      );
      const pendingLeagueTeams = (pendingLeagueData || [])
        .filter(Boolean)
        .filter((/** @type {Team} */ team) => {
          const documentId = String(team?.documentId || '');
          return documentId.length > 0 && !joinedIds.has(documentId);
        });
      const invitedLeagueTeams = (invitedLeagueData || [])
        .filter(Boolean)
        .filter((/** @type {Team} */ team) => {
          const documentId = String(team?.documentId || '');
          return documentId.length > 0 && !joinedIds.has(documentId) && !pendingIds.has(documentId);
        });

      return {
        invitedTeams: sortTeamsForDisplay(invitedLeagueTeams),
        myTeams: sortTeamsForDisplay(teams),
        otherTeams: [],
        pendingTeams: sortTeamsForDisplay(pendingLeagueTeams),
      };
    }

    const my = /** @type {Team[]} */ ([]);
    const other = /** @type {Team[]} */ ([]);

    const teamRequests = userData.teamMembershipRequests || [];
    const pending = teamRequests
      .filter((/** @type {{ state?: string; team?: Team }} */ r) => r.state === 'pending' && r.team)
      .map((/** @type {{ team?: Team; documentId?: string }} */ r) => ({ ...r.team, requestId: r.documentId }));

    const clubRequests = userData.clubMembershipRequests || [];
    const pendingClubs = clubRequests
      .filter((/** @type {{ state?: string; club?: any }} */ r) => r.state === 'pending' && r.club)
      .map((/** @type {{ club?: any }} */ r) => ({
        ...r.club,
        activities: r.club.activities || [],
        club: r.club,
        documentId: r.club.documentId,
        name: r.club.name,
        type: 'club',
      }));

    teams.forEach((/** @type {Team} */ team) => {
      const isTrainer = team.trainers?.some((/** @type {User} */ trainer) => trainer.documentId === userData.documentId);
      const isPlayer = team.players?.some((/** @type {User} */ player) => player.documentId === userData.documentId);
      const isPending = pending.some((/** @type {PendingTeam} */ p) => p.documentId === team.documentId);

      if (isTrainer || isPlayer) {
        my.push(team);
      } else if (!isPending) {
        other.push(team);
      }
    });

    return {
      invitedTeams: [],
      myTeams: sortTeamsForDisplay(my),
      otherTeams: sortTeamsForDisplay(other),
      pendingTeams: sortTeamsForDisplay([...pending, ...pendingClubs]),
    };
  }, [invitedLeagueData, isLeagueMode, pendingLeagueData, teams, userData]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleTeamSelect = useCallback((/** @type {Team} */ team) => {
    if (team.type === 'club') {
      /** @type {any} */ (navigation).navigate(RouteNames.ClubStack, {
        params: { clubId: team.documentId },
        screen: RouteNames.Club,
      });
      return;
    }

    if (isLeagueMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
        params: { teamId: team.documentId },
        screen: RouteNames.SquadDetails,
      });
      return;
    }

    /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
      params: {
        assignmentTrainerId,
        assignmentTrainerName,
        teamId: team.documentId,
      },
      screen: RouteNames.TeamDetails,
    });
  }, [assignmentTrainerId, assignmentTrainerName, isLeagueMode, navigation]);

  useFocusEffect(
    useCallback(() => {
      refetchTeams();
    }, [refetchTeams]),
  );

  const handleOpenFilters = useCallback(() => {
    if (isLeagueMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.SquadFilters);
      return;
    }

    const localRouteNames = navigation.getState?.()?.routeNames || [];
    if (localRouteNames.includes(RouteNames.TeamFilters)) {
      /** @type {any} */ (navigation).navigate(RouteNames.TeamFilters);
      return;
    }

    /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamFilters,
    });
  }, [isLeagueMode, navigation]);

  const listBottomPadding = useMemo(
    () => (isLeagueMode ? 180 : 120) + insets.bottom,
    [insets.bottom, isLeagueMode],
  );

  const renderTeamCard = useCallback((/** @type {Team} */ item, stateVariant = null) => {
    const isPending = stateVariant === 'pending';
    const isInvitation = stateVariant === 'invited';
    const pendingBorderColor = Colors.warning500 || Colors.gold500;
    const invitationBorderColor = Colors.gold500 || Colors.primary500;
    let cardAccentColor = Colors.primary500;
    if (isPending) {
      cardAccentColor = pendingBorderColor;
    } else if (isInvitation) {
      cardAccentColor = invitationBorderColor;
    }
    const cardPadding = isCompactScreen ? 14 : 18;
    const sportLabel = item?.activities?.[0]?.name || item?.sport;
    const isLeagueCard = isLeagueMode;
    let stateLabel = '';
    if (isPending) {
      stateLabel = 'EN ATTENTE';
    } else if (isInvitation) {
      stateLabel = 'INVITATION';
    }

    const activityTag = sportLabel ? (
      <Tag
        style={{
          backgroundColor: `${Colors.primary500}14`,
          borderColor: Colors.primary500,
          maxWidth: isCompactScreen ? 96 : 128,
        }}
        text={sportLabel}
        textStyle={Fonts.p3Bold}
      />
    ) : null;

    let identityAvatar = (
      <TeamShield
        initials={getClubInitials(item.name)}
        isGold={isLeagueCard}
        isSmall={!isLeagueCard}
        size={isLeagueCard ? 80 : undefined}
      />
    );

    if (isLeagueCard && item.crest?.url) {
      identityAvatar = (
        <ProfileAvatar
          imageUrl={item.crest.url}
          shape="rounded"
          size={80}
          style={{
            backgroundColor: Colors.neutral00,
            borderColor: Colors.gold500,
            borderRadius: 20,
            borderWidth: 1,
          }}
          variant="logo"
        />
      );
    } else if (item?.club?.logo?.url) {
      identityAvatar = (
        <ProfileAvatar
          fitMode="cover"
          imageStyle={{ backgroundColor: 'transparent' }}
          imageUrl={item.club.logo.url}
          safeInsetRatio={0}
          shape="rounded"
          size={60}
          style={[
            ApplicationStyle.borderWidth1,
            ApplicationStyle.borderColor.primary500,
            { borderRadius: 16 },
          ]}
          variant="logo"
        />
      );
    }

    const renderClassicContent = () => (
      <>
        <View
          style={[
            Alignments.fullWidth,
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.gap[8],
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], { flex: 1, paddingRight: 8 }]}>
            <View>{identityAvatar}</View>
            <View style={[Alignments.fill]}>
              <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
                {item.name}
              </Text>
            </View>
          </View>
          {activityTag}
        </View>

        <View
          style={[
            Alignments.fullWidth,
            Spaces.marginTop[12],
            Spaces.marginBottom[12],
            ApplicationStyle.separator,
            { backgroundColor: `${cardAccentColor}40` },
          ]}
        />

        <View style={[Alignments.fullWidth, Alignments.row, Alignments.wrap, Spaces.gap[10]]}>
          {(() => {
            const getUniqueMemberCount = () => {
              const ids = new Set();
              const collect = (list = []) => {
                list.forEach((member) => {
                  if (!member) return;
                  const memberId = member.documentId || member.id || member.phoneNumber;
                  if (memberId) ids.add(String(memberId));
                });
              };

              collect(item?.players);
              collect(item?.trainers);
              collect(item?.members);

              if (ids.size > 0) return ids.size;
              return Number(item?.players?.length || 0) + Number(item?.trainers?.length || 0);
            };

            const sectionLabel = item?.section?.name;
            const categoryLabel = item?.category?.name || item?.category;
            const levelLabel = item?.level?.name || item?.level;
            const membersLabel = String(getUniqueMemberCount());
            const allSponsors = Array.isArray(item?.club?.sponsor) ? item.club.sponsor.filter(Boolean) : [];
            const sponsors = allSponsors.slice(0, 5);

            const metaItems = [
              { label: t('teamList.fields.section', 'Section'), value: sectionLabel },
              { label: t('teamList.fields.category', 'Catégorie'), value: categoryLabel },
              { label: t('teamList.fields.level', 'Niveau'), value: levelLabel },
              { label: t('teamList.fields.members', 'Membres'), value: membersLabel },
            ].filter((meta) => String(meta?.value || '').trim().length > 0);

            return (
              <>
                {sponsors.length > 0 ? (
                  <View style={[Alignments.fullWidth, Spaces.marginBottom[12], Spaces.gap[8]]}>
                    <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                      {sponsors.map((sponsor) => (
                        <SponsorLogoTile
                          borderRadius={16}
                          containerStyle={{ minWidth: isCompactScreen ? 86 : 94 }}
                          height={isCompactScreen ? 34 : 38}
                          imageUrl={sponsor?.logo?.url}
                          key={sponsor?.documentId || sponsor?.id || sponsor?.link || sponsor?.title}
                          link={sponsor?.link}
                          title={sponsor?.title || sponsor?.name}
                          titleLines={2}
                          titleStyle={[
                            Fonts.p4Bold,
                            Fonts.neutral100,
                            {
                              lineHeight: 14,
                              marginTop: 4,
                            },
                          ]}
                          width={isCompactScreen ? 86 : 94}
                        />
                      ))}
                    </View>
                    {allSponsors.length > sponsors.length ? (
                      <Text style={[Fonts.p3Bold, Fonts.primary100]}>
                        {`+${allSponsors.length - sponsors.length} autres sponsors`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {metaItems.map((meta) => (
                  <View
                    key={`${meta.label}-${meta.value}`}
                    style={{ minWidth: isCompactScreen ? 128 : 144, width: '47%' }}
                  >
                    <Text style={[Fonts.p3, Fonts.neutral300]}>{meta.label}</Text>
                    <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {meta.value}
                    </Text>
                  </View>
                ))}
              </>
            );
          })()}
        </View>
      </>
    );

    const renderLeagueContent = () => (
      <View style={[Alignments.fullWidth, { flex: 1, position: 'relative' }]}>
        {stateLabel ? (
          <View
            style={{
              backgroundColor: `${cardAccentColor}20`,
              borderColor: cardAccentColor,
              borderRadius: 999,
              borderWidth: 1,
              left: 0,
              paddingHorizontal: 12,
              paddingVertical: 6,
              position: 'absolute',
              top: 0,
              zIndex: 2,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: cardAccentColor }]}>
              {stateLabel}
            </Text>
          </View>
        ) : null}
        <View style={{
          position: 'absolute', right: 0, top: 0, zIndex: 2,
        }}
        >
          {activityTag}
        </View>

        <View
          style={[
            Alignments.fullWidth,
            {
              alignItems: 'center',
              flex: 1,
              gap: 12,
              justifyContent: 'center',
              transform: [{ translateY: -10 }],
            },
          ]}
        >
          <View>{identityAvatar}</View>
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.h2, Fonts.neutral00, { textAlign: 'center' }]}>
              {item.name}
            </Text>
            <Text style={[Fonts.p3Bold, { color: Colors.gold500, marginTop: 4, textAlign: 'center' }]}>
              DIV
              {' '}
              {item.division || 5}
            </Text>
          </View>
        </View>
      </View>
    );

    if (isLeagueCard) {
      return (
        <View style={[{ height: 250, marginVertical: 12, position: 'relative' }]}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => handleTeamSelect(item)} style={{ flex: 1 }}>
            <LinearGradient
              colors={[`${Colors.primary200}33`, `${Colors.primary200}0A`, `${Colors.primary200}00`]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[
                ApplicationStyle.borderRadius24,
                {
                  flex: 1,
                  justifyContent: 'center',
                },
              ]}
            />

            <MaskedView
              maskElement={(
                <View
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'black',
                    borderRadius: 24,
                    borderWidth: 2,
                    height: '100%',
                    width: '100%',
                  }}
                />
              )}
              style={{
                height: '100%', left: 0, position: 'absolute', top: 0, width: '100%',
              }}
            >
              <LinearGradient
                colors={[Colors.primary500, Colors.gold500]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={{ flex: 1 }}
              />
            </MaskedView>

            <View
              style={[
                {
                  height: '100%',
                  justifyContent: 'center',
                  padding: cardPadding,
                  position: 'absolute',
                  width: '100%',
                },
              ]}
            >
              {renderLeagueContent()}
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[{ position: 'relative' }]}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => handleTeamSelect(item)}
          style={[
            Spaces.marginVertical[12],
            {
              borderRadius: 24,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: Colors.primary700,
              borderColor: cardAccentColor,
              borderRadius: 24,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: isCompactScreen ? 138 : 150,
              padding: cardPadding,
            }}
          >
            {renderClassicContent()}
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [Alignments, ApplicationStyle, Colors, Fonts, Spaces, getClubInitials, handleTeamSelect, isCompactScreen, isLeagueMode, t]);

  const headerComponent = useMemo(() => (
    <View>
      {isLeagueMode ? (
        <View style={[Spaces.marginBottom[16], { flexDirection: 'row', gap: 10 }]}>
          <Button
            onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.SquadSearch)}
            style={{ flex: 1 }}
            title="RECHERCHER UNE SQUAD"
            variant="Secondary"
          />
        </View>
      ) : null}

      <View style={[Spaces.marginBottom[16]]}>
        <SearchComponent
          filterNumber={filterNumber}
          handleSearchField={setSearchValue}
          openFilters={handleOpenFilters}
          placeholder={t('teamList.searchPlaceholder', 'Mes équipes')}
          searchDefaultValue={searchValue || teamFilters?.name || ''}
        />
      </View>

      {invitedTeams.length > 0 ? (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16]]}>
            Invitations recues
          </Text>
          {invitedTeams.map((team) => (
            <View key={`invited-${team.documentId}`}>
              {renderTeamCard(team, 'invited')}
            </View>
          ))}
        </View>
      ) : null}

      {pendingTeams.length > 0 ? (
        <View>
          <Text style={[
            Fonts.h3,
            Fonts.neutral00,
            Spaces.marginBottom[16],
            invitedTeams.length > 0 && Spaces.marginTop[24],
          ]}
          >
            Demandes en attente
          </Text>
          {pendingTeams.map((team) => (
            <View key={`pending-${team.documentId}`}>
              {renderTeamCard(team, 'pending')}
            </View>
          ))}
        </View>
      ) : null}

      {myTeams.length > 0 ? (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], (pendingTeams.length > 0 || invitedTeams.length > 0) && Spaces.marginTop[24]]}>
            Mes équipes
          </Text>
          {myTeams.map((team) => (
            <View key={`joined-${team.documentId}`}>
              {renderTeamCard(team)}
            </View>
          ))}
        </View>
      ) : null}

      {otherTeams.length > 0 ? (
        <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], (myTeams.length > 0 || pendingTeams.length > 0 || invitedTeams.length > 0) && Spaces.marginTop[24]]}>
          Autres équipes du club
        </Text>
      ) : null}
    </View>
  ), [
    filterNumber,
    Fonts,
    Spaces,
    handleOpenFilters,
    invitedTeams,
    isLeagueMode,
    myTeams,
    navigation,
    otherTeams.length,
    pendingTeams,
    renderTeamCard,
    searchValue,
    teamFilters?.name,
    t,
  ]);

  const renderEmptyList = () => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius16,
        Alignments.alignCenter,
        Spaces.gap[32],
        Spaces.padding[24],
        Spaces.marginVertical[24],
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('teamList.noData')}
      </Text>
      {isLeagueMode ? (
        <Button
          onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.SquadSearch)}
          style={{ minWidth: 220 }}
          title="RECHERCHER UNE SQUAD"
          variant="Secondary"
        />
      ) : null}
    </View>
  );

  return (
    <View style={[Spaces.gap[40], Alignments.fill, { position: 'relative' }]}>
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoadingTeams && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill, ApplicationStyle.borderRadius2]}>
          <FlashList
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
            data={otherTeams}
            estimatedItemSize={200}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={myTeams.length === 0 && pendingTeams.length === 0 && invitedTeams.length === 0 ? renderEmptyList : null}
            ListHeaderComponent={headerComponent}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetchTeams}
            refreshing={isLoadingTeams && !isFetchingNextPage}
            renderItem={({ item }) => renderTeamCard(item, false)}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {isLeagueMode ? (
          <View style={{
            alignItems: 'center', bottom: 20, position: 'absolute', width: '100%', zIndex: 100,
          }}
          >
            <Button
              icon="plus"
              onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
              style={{
                backgroundColor: Colors.gold500,
                borderRadius: 30,
                elevation: 5,
                shadowColor: Colors.gold500,
                shadowOffset: { height: 4, width: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
                width: '90%',
              }}
              textStyle={{ color: Colors.neutral900 }}
              title="Créer UNE SQUAD"
              variant="Primary"
            />
          </View>
        ) : null}
      </WithDataWrapper>
    </View>
  );
}

export default TeamListContent;
