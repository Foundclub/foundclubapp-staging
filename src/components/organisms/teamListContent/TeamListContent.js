import { useFocusEffect, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import Button from '@/components/atoms/button/Button';

import useClub from '@/domains/club/useClub';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import { getImageUrl } from '@/utils/imageUrl';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMyLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { useGetTeams } from '@/services/team/teamQueries';
import { deleteTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';
import { useMutation } from '@tanstack/react-query';
import { Alert } from 'react-native';

/**
 * Team list content to be used in home page or dedicated team list screen
 * @param {object} props
 * @param {string} [props.clubId] - The ID of the club to fetch teams for
 * @param {string} [props.playerId] - The ID of the player to fetch teams for
 * @returns {import('react').ReactElement} Team list content component
 */

function TeamListContent({
  clubId = undefined,
  playerId = undefined,
  isLeagueMode = false,
}) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const { getClubInitials } = useClub();

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  
  const { userData } = useAuth();
  const navigation = useNavigation();

  // Queries
  // 1. Classic Teams Query
  const {
    data: classicData,
    error: classicError,
    isLoading: isLoadingClassic,
    refetch: refetchClassic,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetTeams({
    filters: { club: clubId, players: playerId },
    enabled: !isLeagueMode // Disable if league mode
  });

  // 2. League Teams Query
  const {
    data: leagueData, // Array of LeagueTeams
    isLoading: isLoadingLeague,
    refetch: refetchLeague,
  } = useGetMyLeagueTeam(userData?.documentId, { enabled: isLeagueMode && !!userData });

  const teams = useMemo(() => {
      if (isLeagueMode) return leagueData || [];
      return classicData?.pages?.flatMap((page) => page.data) || [];
  }, [classicData, leagueData, isLeagueMode]);

  const isLoadingTeams = isLeagueMode ? isLoadingLeague : isLoadingClassic;
  const refetchTeams = isLeagueMode ? refetchLeague : refetchClassic;
  // Define error variable to avoid ReferenceError in JSX
  const error = isLeagueMode ? null : classicError;

  // ... delete mutation ...
  
  // Data Separation Logic
  const { myTeams, otherTeams, pendingTeams } = useMemo(() => {
    if (!userData) return { myTeams: [], otherTeams: [], pendingTeams: [] };

    if (isLeagueMode) {
        // In League Mode, 'teams' ARE 'myTeams' (from getMyLeagueTeam)
        // We don't have 'pending' or 'other' in this specific view yet (unless we add search later)
        return {
            myTeams: teams, // arrays of LeagueTeam
            otherTeams: [],
            pendingTeams: []
        };
    }

    // Classic Logic (unchanged)
    // ...
    // Copy existing classic logic here or keep it if I can verify I'm editing the right block.
    // Since I'm replacing a large block, I must replicate the classic logic.
    
    const my = [];
    const other = [];
    // ... classic filtering logic ...
    const teamRequests = userData.teamMembershipRequests || [];
    const pending = teamRequests
      .filter((r) => r.state === 'pending' && r.team)
      .map((r) => ({ ...r.team, requestId: r.documentId }));
    
    const clubRequests = userData.clubMembershipRequests || [];
    const pendingClubs = clubRequests
      .filter((r) => r.state === 'pending' && r.club)
      .map((r) => ({ ...r.club, name: r.club.name, club: r.club, documentId: r.club.documentId, activities: r.club.activities || [] }));

    teams.forEach((team) => {
      const isTrainer = team.trainers?.some((t) => t.documentId === userData.documentId);
      const isPlayer = team.players?.some((p) => p.documentId === userData.documentId);
      const isPending = pending.some((p) => p.documentId === team.documentId);

      if (isTrainer || isPlayer) {
        my.push(team);
      } else if (!isPending) { 
        other.push(team);
      }
    });

    return { myTeams: my, otherTeams: other, pendingTeams: [...pending, ...pendingClubs] };

  }, [teams, userData, isLeagueMode]);
  
  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleTeamSelect = useCallback((/** @type {Team} */ team) => {
    // @ts-expect-error because of react navigation type definitions
    if (team.type === 'club') {
        navigation.navigate(RouteNames.ClubStack, {
            screen: RouteNames.Club,
            params: { clubId: team.documentId },
        });
        return;
    }

    if (isLeagueMode) {
        // League Mode -> SquadDetails
        navigation.navigate(RouteNames.TeamStack, {
            screen: RouteNames.SquadDetails,
            params: { teamId: team.documentId },
        });
        return;
    }

    // Classic Mode -> TeamDetails
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamDetails,
      params: { teamId: team.documentId },
    });
  }, [navigation, isLeagueMode]);

  useFocusEffect(
    useCallback(() => {
      refetchTeams();
    }, [refetchTeams]),
  );


  // Update renderItem to handle crest

  const renderItem = useCallback(({ item, isPending }) => {
    
    // Inner Content Renderer to avoid duplication if possible, 
    // but structure differs enough that we might just inline or separate blocks.
    const renderContent = () => (
        <>
         <View style={[
          Alignments.fullWidth,
          Alignments.row,
          Alignments.justifyEnd,
          Alignments.alignCenter,
          Spaces.gap[8],
          { position: 'absolute', top: 24, right: 24, zIndex: 1 },
        ]}
        >
          {item?.activities?.[0]?.name ? (
            <Tag text={item.activities[0].name} />
          ) : (item.sport && <Tag text={item.sport} />)} 
        </View>

        <View style={[Alignments.row, Alignments.fullWidth, Alignments.alignCenter, Spaces.gap[8], isLeagueMode && { flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 16 }]}>
          <View>
            {/* LEAGUE TEAM CREST HANDLING */}
            {isLeagueMode && item.crest?.url ? (
                 <ProfileAvatar
                    imageUrl={item.crest.url}
                    size={80} // Larger Avatar for Big Card
                    style={{ borderRadius: 80, borderWidth: 1, borderColor: Colors.gold500 }}
                 />
            ) : (item?.club?.logo?.url ? (
              <ProfileAvatar
                imageUrl={item.club.logo.url}
                size={60}
                style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 60 }]}
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
             {isLeagueMode && (
                <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 4 }]}>Division {item.division || 10}</Text>
             )}
          </View>
        </View>
        
        {/* Classic Footer */}
        {!isLeagueMode && (
             <View style={[Alignments.fullWidth, Spaces.marginVertical[16], ApplicationStyle.separator, ApplicationStyle.backgroundColor.neutral500]} />
        )}
        
        {!isLeagueMode && (
            <View style={[Spaces.gap[8], Alignments.row, Alignments.wrap]}>
                 {item?.section && <Text style={[Fonts.p2Bold, Fonts.primary100]}>{t('teamList.fields.section')} : <Text style={[Fonts.p2, Fonts.primary100]}>{item.section.name}</Text></Text>}
            </View>
        )}
        </>
    );

    if (isLeagueMode) {
        return (
            <View style={[{ position: 'relative', marginVertical: 12, height: 250 }]}>
                 <TouchableOpacity onPress={() => handleTeamSelect(item)} activeOpacity={0.9} style={{ flex: 1 }}>
                    {/* 1. Glass Background Layer */}
                    <LinearGradient
                        colors={['rgba(165, 239, 255, 0.2)', 'rgba(110, 191, 244, 0.04)', 'rgba(70, 144, 213, 0)']}
                        start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                        style={[
                            ApplicationStyle.borderRadius24,
                            { 
                                flex: 1,
                                justifyContent: 'center',
                            }
                        ]}
                    />

                    {/* 2. Gradient Border Overlay (using MaskedView) */}
                    <MaskedView
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                        maskElement={
                            <View
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 24,
                                    borderWidth: 2,
                                    borderColor: 'black', // The mask opacity (keeps the border)
                                    backgroundColor: 'transparent',
                                }}
                            />
                        }
                    >
                        <LinearGradient
                            colors={['#00C6FB', Colors.gold500]}
                            start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                            style={{ flex: 1 }}
                        />
                    </MaskedView>

                    {/* 3. Content Layer (Absolute to sit on top of background) */}
                    <View style={[Spaces.padding[24], { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center' }]}>
                        {renderContent()}
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    // Classic Card
    return (
    <View style={[{ position: 'relative' }]}>
      <TouchableOpacity
        onPress={() => handleTeamSelect(item)}
        style={[
          Spaces.padding[24],
          Spaces.marginVertical[12],
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          isPending && { borderColor: '#EAB308', borderWidth: 1 },
        ]}
      >
        {renderContent()}
      </TouchableOpacity>
      {/* Pending Badge Logic would specifically go here if needed, but simplified for now */}
    </View>
  )}, [Alignments, ApplicationStyle, Fonts, Spaces, getClubInitials, handleTeamSelect, t, isLeagueMode, Colors]);

  const headerComponent = useMemo(() => (
    <View>
      {/* Search Bar */}
      <View style={[Spaces.marginBottom[16]]}>
        {/* Create Team Button - Persistent in League Mode */}

        <SearchComponent
          handleSearchField={setSearchValue}
          openFilters={() => {}}
          placeholder={t('teamList.searchPlaceholder', 'Rechercher une équipe...')}
          searchDefaultValue={searchValue}
        />
      </View>

      {/* Pending Teams Section */}
      {pendingTeams.length > 0 && (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16]]}>
            Demandes en attente
          </Text>
          {pendingTeams.map((team) => (
            <View key={team.documentId}>
              {renderItem({ item: team, isPending: true })}
            </View>
          ))}
        </View>
      )}

      {/* My Teams Section */}
      {myTeams.length > 0 && (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], pendingTeams.length > 0 && Spaces.marginTop[24]]}>
            Mes Équipes
          </Text>
          {myTeams.map((team) => (
            <View key={team.documentId}>
              {renderItem({ item: team })}
            </View>
          ))}
        </View>
      )}

      {/* Other Teams Title - Simplified condition */}
      {otherTeams.length > 0 && (
        <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], (myTeams.length > 0 || pendingTeams.length > 0) && Spaces.marginTop[24]]}>
          Autres Équipes du Club
        </Text>
      )}
    </View>
  ), [pendingTeams, myTeams, otherTeams.length, Fonts, Spaces, renderItem, searchValue, t]);

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius16,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.padding[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('teamList.noData')}
      </Text>
    </View>
  );

  return (
    <View style={[Spaces.gap[40], Alignments.fill, { position: 'relative' }]}>
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoadingTeams && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[
          Alignments.fill,
          ApplicationStyle.borderRadius2]}
        >
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
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
        
        {/* Floating Action Button for League Mode */}
        {isLeagueMode && (
             <View style={{ position: 'absolute', bottom: 20, width: '100%', alignItems: 'center', zIndex: 100 }}>
                 <Button
                    title="CRÉER UNE SQUAD"
                    variant="Primary"
                    icon="plus"
                    onPress={() => navigation.navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
                    style={{
                        backgroundColor: Colors.gold500,
                        borderRadius: 30,
                        width: '90%',
                        shadowColor: Colors.gold500,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 5,
                        elevation: 5
                    }}
                    textStyle={{ color: Colors.neutral900 }}
                 />
             </View>
        )}

      </WithDataWrapper>
    </View>
  );
}

export default TeamListContent;
