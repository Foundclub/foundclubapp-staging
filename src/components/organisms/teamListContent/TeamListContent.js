import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaskedView from '@react-native-masked-view/masked-view';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { RouteNames } from '@/navigation/routeNames';
import { useGetMyLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { useGetTeams } from '@/services/team/teamQueries';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

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
  clubId = undefined,
  playerId = undefined,
  isLeagueMode = false,
  assignmentTrainerId = undefined,
  assignmentTrainerName = undefined,
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
    isLoading: isLoadingClassic,
    refetch: refetchClassic,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetTeams(classicTeamQueryParams, {
    enabled: !isLeagueMode,
  });

  const {
    data: leagueData,
    isLoading: isLoadingLeague,
    refetch: refetchLeague,
  } = useGetMyLeagueTeam(userData?.documentId || '', { enabled: isLeagueMode && !!userData });

  const teams = useMemo(() => {
    if (isLeagueMode) return (leagueData || []).filter(Boolean);
    return classicData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];
  }, [classicData, leagueData, isLeagueMode]);

  const isLoadingTeams = isLeagueMode ? isLoadingLeague : isLoadingClassic;
  const refetchTeams = isLeagueMode ? refetchLeague : refetchClassic;
  const error = isLeagueMode ? null : classicError;

  const { myTeams, otherTeams, pendingTeams } = useMemo(() => {
    if (!userData) return { myTeams: [], otherTeams: [], pendingTeams: [] };

    if (isLeagueMode) {
      return {
        myTeams: teams,
        otherTeams: [],
        pendingTeams: [],
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
      myTeams: my,
      otherTeams: other,
      pendingTeams: [...pending, ...pendingClubs],
    };
  }, [isLeagueMode, teams, userData]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleTeamSelect = useCallback((/** @type {Team} */ team) => {
    if (team.type === 'club') {
      /** @type {any} */ (navigation).navigate(RouteNames.ClubStack, {
        screen: RouteNames.Club,
        params: { clubId: team.documentId },
      });
      return;
    }

    if (isLeagueMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
        screen: RouteNames.SquadDetails,
        params: { teamId: team.documentId },
      });
      return;
    }

    /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamDetails,
      params: {
        teamId: team.documentId,
        assignmentTrainerId,
        assignmentTrainerName,
      },
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
    /** @type {any} */ (navigation).navigate(RouteNames.TeamFilters);
  }, [isLeagueMode, navigation]);

  const renderTeamCard = useCallback((/** @type {Team} */ item, isPending = false) => {
    const renderContent = () => (
      <>
        <View
          style={[
            Alignments.fullWidth,
            Alignments.row,
            Alignments.justifyEnd,
            Alignments.alignCenter,
            Spaces.gap[8],
            { position: 'absolute', top: 24, right: 24, zIndex: 1 },
          ]}
        >
          {item?.activities?.[0]?.name ? (
            <Tag
              text={item.activities[0].name}
              style={{
                backgroundColor: `${Colors.primary500}1A`,
                borderColor: Colors.primary500,
              }}
              textStyle={Fonts.p3Bold}
            />
          ) : (item.sport && (
            <Tag
              text={item.sport}
              style={{
                backgroundColor: `${Colors.primary500}1A`,
                borderColor: Colors.primary500,
              }}
              textStyle={Fonts.p3Bold}
            />
          ))}
        </View>

        <View
          style={[
            Alignments.row,
            Alignments.fullWidth,
            Alignments.alignCenter,
            Spaces.gap[8],
            isLeagueMode && { flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 16 },
          ]}
        >
          <View>
            {isLeagueMode && item.crest?.url ? (
              <ProfileAvatar
                imageUrl={item.crest.url}
                size={80}
                style={{ borderRadius: 80, borderWidth: 1, borderColor: Colors.gold500 }}
              />
            ) : (item?.club?.logo?.url ? (
              <ProfileAvatar
                imageUrl={item.club.logo.url}
                size={60}
                style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.primary500, { borderRadius: 60 }]}
              />
            ) : (
              <TeamShield
                initials={getClubInitials(item.name)}
                isSmall={!isLeagueMode}
                size={isLeagueMode ? 80 : undefined}
              />
            ))}
          </View>
          <View style={[Alignments.fill, isLeagueMode && { alignItems: 'center' }]}>
            <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, isLeagueMode && Fonts.h2, isLeagueMode && { color: '#FFFFFF' }]}>
              {item.name}
            </Text>
            {isLeagueMode ? (
              <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 4 }]}>Division {item.division || 5}</Text>
            ) : null}
          </View>
        </View>

        {!isLeagueMode ? (
          <View
            style={[
              Alignments.fullWidth,
              Spaces.marginVertical[16],
              ApplicationStyle.separator,
              { backgroundColor: `${Colors.primary500}40` },
            ]}
          />
        ) : null}

        {!isLeagueMode ? (
          <View style={[Spaces.gap[8], Alignments.row, Alignments.wrap]}>
            {item?.section ? (
              <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
                {t('teamList.fields.section')} : <Text style={[Fonts.p2, Fonts.neutral00]}>{item.section.name}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}
      </>
    );

    if (isLeagueMode) {
      return (
        <View style={[{ position: 'relative', marginVertical: 12, height: 250 }]}>
          <TouchableOpacity onPress={() => handleTeamSelect(item)} activeOpacity={0.9} style={{ flex: 1 }}>
            <LinearGradient
              colors={['rgba(165, 239, 255, 0.2)', 'rgba(110, 191, 244, 0.04)', 'rgba(70, 144, 213, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                ApplicationStyle.borderRadius24,
                {
                  flex: 1,
                  justifyContent: 'center',
                },
              ]}
            />

            <MaskedView
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              maskElement={(
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: 'black',
                    backgroundColor: 'transparent',
                  }}
                />
              )}
            >
              <LinearGradient
                colors={['#00C6FB', Colors.gold500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </MaskedView>

            <View style={[Spaces.padding[24], { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center' }]}>
              {renderContent()}
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[{ position: 'relative' }]}>
        <TouchableOpacity
          onPress={() => handleTeamSelect(item)}
          activeOpacity={0.88}
          style={[
            Spaces.marginVertical[12],
            ApplicationStyle.borderRadius24,
            {
              borderColor: isPending ? '#EAB308' : Colors.primary500,
              borderWidth: 1,
              overflow: 'hidden',
              shadowColor: Colors.primary500,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.22,
              shadowRadius: 12,
              elevation: 4,
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(1, 179, 244, 0.20)', 'rgba(1, 179, 244, 0.06)', 'rgba(1, 179, 244, 0.02)']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[
              Spaces.padding[24],
              {
                backgroundColor: 'rgba(7, 35, 52, 0.90)',
              },
            ]}
          >
            {renderContent()}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [Alignments, ApplicationStyle, Colors, Fonts, Spaces, getClubInitials, handleTeamSelect, isLeagueMode, t]);

  const headerComponent = useMemo(() => (
    <View>
      {isLeagueMode ? (
        <View style={[Spaces.marginBottom[16], { flexDirection: 'row', gap: 10 }]}>
          <Button
            title="RECHERCHER UNE SQUAD"
            variant="Secondary"
            onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.SquadSearch)}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      <View style={[Spaces.marginBottom[16]]}>
        <SearchComponent
          filterNumber={filterNumber}
          handleSearchField={setSearchValue}
          openFilters={handleOpenFilters}
          placeholder={t('teamList.searchPlaceholder', 'Rechercher une equipe...')}
          searchDefaultValue={searchValue || teamFilters?.name || ''}
        />
      </View>

      {pendingTeams.length > 0 ? (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16]]}>
            Demandes en attente
          </Text>
          {pendingTeams.map((team) => (
            <View key={team.documentId}>
              {renderTeamCard(team, true)}
            </View>
          ))}
        </View>
      ) : null}

      {myTeams.length > 0 ? (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], pendingTeams.length > 0 && Spaces.marginTop[24]]}>
            Mes equipes
          </Text>
          {myTeams.map((team) => (
            <View key={team.documentId}>
              {renderTeamCard(team, false)}
            </View>
          ))}
        </View>
      ) : null}

      {otherTeams.length > 0 ? (
        <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], (myTeams.length > 0 || pendingTeams.length > 0) && Spaces.marginTop[24]]}>
          Autres equipes du club
        </Text>
      ) : null}
    </View>
  ), [
    filterNumber,
    Fonts,
    Spaces,
    handleOpenFilters,
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
          title="RECHERCHER UNE SQUAD"
          variant="Secondary"
          onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.SquadSearch)}
          style={{ minWidth: 220 }}
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
            data={otherTeams}
            estimatedItemSize={200}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListHeaderComponent={headerComponent}
            ListEmptyComponent={myTeams.length === 0 ? renderEmptyList : null}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetchTeams}
            refreshing={isLoadingTeams && !isFetchingNextPage}
            renderItem={({ item }) => renderTeamCard(item, false)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>

        {isLeagueMode ? (
          <View style={{ position: 'absolute', bottom: 20, width: '100%', alignItems: 'center', zIndex: 100 }}>
            <Button
              title="CREER UNE SQUAD"
              variant="Primary"
              icon="plus"
              onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
              style={{
                backgroundColor: Colors.gold500,
                borderRadius: 30,
                width: '90%',
                shadowColor: Colors.gold500,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
                elevation: 5,
              }}
              textStyle={{ color: Colors.neutral900 }}
            />
          </View>
        ) : null}
      </WithDataWrapper>
    </View>
  );
}

export default TeamListContent;
