import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { getImageUrl } from '@/utils/imageUrl';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeams } from '@/services/team/teamQueries';

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
}) {
  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetTeams({
    clubId,
    pageSize: 15,
    playerId,
  });

  // variables
  const teams = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {Team[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);

  const { userData } = useAuth();

  console.log('DEBUG: TeamListContent', {
    clubId,
    userDataClubId: userData?.club?.documentId,
    teamsCount: teams.length,
    myTeamsCount: teams.filter(t => t.trainers?.some(tr => tr.documentId === userData?.documentId)).length
  });

  const { myTeams, otherTeams } = useMemo(() => {
    if (!userData) return { myTeams: [], otherTeams: teams };

    /** @type {Team[]} */
    const my = [];
    /** @type {Team[]} */
    const other = [];

    teams.forEach((team) => {
      const isTrainer = team.trainers?.some((t) => t.documentId === userData.documentId);
      if (isTrainer) {
        my.push(team);
      } else {
        other.push(team);
      }
    });

    return { myTeams: my, otherTeams: other };
  }, [teams, userData]);

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleTeamSelect = useCallback((/** @type {Team} */ team) => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamDetails,
      params: { teamId: team.documentId },
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // renderers
  /**
   * Renders a team item in the list
   * @param {{ item: Team }} param - The item to render
   * @returns {import('react').ReactElement} The rendered item
   */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleTeamSelect(item)}
        style={[
        Spaces.padding[24],
        Spaces.marginVertical[12],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
      ]}
    >
      {item?.activities?.[0]?.name && (
        <View style={[
          Alignments.fullWidth,
          Alignments.alignEnd,
          Alignments.justifyCenter,
        ]}
        >
          <Tag text={item.activities[0].name} />
        </View>
      )}
      <View
        style={[
          Alignments.row,
          Alignments.fullWidth,
          Alignments.alignCenter,
          Spaces.gap[8],
        ]}
      >
        <View>
          {item?.club?.logo?.url ? (
            <ProfileAvatar
              imageUrl={item.club.logo.url}
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
              initials={getClubInitials(item?.club?.name || '')}
              isSmall
            />
          )}
        </View>
        <View style={[
          Alignments.fill,
        ]}
        >
          <Text
            numberOfLines={2}
            style={[
              Fonts.p1Bold,
              Fonts.neutral00]}
          >
            {item.name}
          </Text>
        </View>
      </View>
      <View style={[
        Alignments.fullWidth,
        Spaces.marginVertical[16],
        ApplicationStyle.separator,
        ApplicationStyle.backgroundColor.neutral500,
      ]}
      />
      <View style={[
        Spaces.gap[8],
        Alignments.row,
        Alignments.wrap,
      ]}
      >
        {item?.section ? (
          <Text style={[Fonts.p2Bold, Fonts.primary100]}>
            {t('teamList.fields.section')}
            {' : '}
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {item?.section?.name}
            </Text>
          </Text>
        ) : null}
        {item?.category ? (
          <Text style={[Fonts.p2Bold, Fonts.primary100]}>
            {t('teamList.fields.category')}
            {' : '}
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {item?.category?.name}
            </Text>
          </Text>
        ) : null}
        {item?.level ? (
          <Text style={[Fonts.p2Bold, Fonts.primary100]}>
            {t('teamList.fields.level')}
            {' : '}
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {item?.level?.name}
            </Text>
          </Text>
        ) : null}
      </View>

      {/* Sponsors Section */}
      {(item?.club?.sponsor?.length > 0) && (
        <View style={[Spaces.marginTop[16]]}>
          <ScrollView
            contentContainerStyle={[Spaces.gap[16]]}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {item?.club?.sponsor?.map((sponsor) => (
              <View
                key={sponsor.link || sponsor.title}
                style={[Alignments.relative]}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (sponsor.link) {
                      Linking.openURL(sponsor.link);
                    }
                  }}
                  style={[Alignments.alignCenter]}
                >
                  {sponsor?.logo?.url ? (
                    <Image
                      source={{ uri: getImageUrl(sponsor.logo.url) }}
                      style={[
                        ApplicationStyle.roundIcon55,
                        ApplicationStyle.borderWidth1,
                        ApplicationStyle.borderColor.neutral00,
                      ]}
                    />
                  ) : (
                    <View style={[
                      ApplicationStyle.roundIcon55,
                      ApplicationStyle.borderWidth1,
                      ApplicationStyle.borderColor.neutral00,
                      Alignments.justifyCenter,
                      Alignments.alignCenter,
                      { backgroundColor: '#FFFFFF' },
                    ]}
                    >
                      <Text style={[Fonts.h4Bold, { color: '#000000' }]}>
                        {sponsor.title ? sponsor.title.charAt(0).toUpperCase() : '?'}
                      </Text>
                    </View>
                  )}
                  <Text
                    numberOfLines={1}
                    style={[
                      Fonts.p2Bold,
                      Fonts.neutral00,
                      Spaces.marginTop[4],
                      { maxWidth: 60, textAlign: 'center' },
                    ]}
                  >
                    {sponsor.title}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </TouchableOpacity>
  );

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
    <View style={[Spaces.gap[40], Alignments.fill]}>
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading && !isFetchingNextPage}
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
            ListHeaderComponent={() => (
              <View>
                {/* My Teams Section */}
                {myTeams.length > 0 && (
                  <View>
                    <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16]]}>
                      Mes Équipes
                    </Text>
                    {myTeams.map((team) => (
                      <View key={team.documentId}>
                        {renderItem({ item: team })}
                      </View>
                    ))}
                  </View>
                )}

                {/* Other Teams Title */}
                {myTeams.length > 0 && otherTeams.length > 0 && (
                  <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], Spaces.marginTop[24]]}>
                    Autres Équipes du Club
                  </Text>
                )}
              </View>
            )}
            ListEmptyComponent={myTeams.length === 0 ? renderEmptyList : null}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </WithDataWrapper>
    </View>
  );
}

export default TeamListContent;
