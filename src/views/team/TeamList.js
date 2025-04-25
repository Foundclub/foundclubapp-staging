import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Linking, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeams } from '@/services/team/teamQueries';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function TeamList({ navigation, route }) {
  const { clubId } = route?.params ?? {};
  const { getClubInitials } = useClub();
  const { userData } = useAuth();

  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetTeams(clubId, {
    pageSize: 10,
  });

  // lifecycle
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const canAddTeam = useMemo(() => {
    if (userData?.club?.maxTeamNumber) {
      const totalTeams = requestPages?.pages?.[0]?.meta?.pagination?.total || 0;
      return totalTeams < userData.club.maxTeamNumber;
    }
    return false;
  }, [userData, requestPages]);

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * @type {Team[]}
   */
  const teams = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {Team[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);

  const handleAddTeam = () => {
    if (canAddTeam) {
      navigation.navigate(RouteNames.TeamEdit, { clubId });
    } else {
      Alert.alert(
        t('teamList.alerts.maxTeamLimitReached.title'),
        t('teamList.alerts.maxTeamLimitReached.description'),
        [
          {
            style: 'cancel',
            text: t('teamList.alerts.maxTeamLimitReached.actions.cancel'),
          },
          {
            onPress: () => Linking.openURL(process.env.CONTACT_URL || ''),
            text: t('teamList.alerts.maxTeamLimitReached.actions.contact'),
          },
        ],
      );
    }
  };

  /**
   * Handles the team selection action
   * @param {Team} team
   * @returns {void}
   */
  const handleTeamSelect = (team) => {
    navigation.navigate(RouteNames.TeamDetails, { teamId: team.documentId });
  };

  // renderers

  /**
   * Render the team item
   * @param {object} param
   * @param {Team} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleTeamSelect(item)}
      style={[
        Alignments.alignStart,
        Alignments.justifySpaceBetween,
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
        ]}
        >
          <Tag text={item.activities[0].name} />
        </View>
      )}
      <View
        style={[
          Alignments.row,
          Alignments.fill,
          Alignments.fullWidth,
          Alignments.alignCenter,
          Spaces.gap[8],
        ]}
      >
        <View>
          <TeamShield
            initials={getClubInitials(item?.club?.name || '')}
            isSmall
          />
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
        Alignments.fill,
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
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[32],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[
          Alignments.fill,
          ApplicationStyle.borderRadius2,
          { minHeight: 500 }]}
        >
          <FlashList
            contentContainerStyle={{ paddingBottom: 20 }}
            data={teams}
            estimatedItemSize={120}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={renderEmptyList}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
          />
        </View>
      </WithDataWrapper>
      <Button
        icon="plus"
        onPress={handleAddTeam}
        style={Spaces.paddingHorizontal[16]}
        title={t('teamList.actions.add')}
        variant="Primary"
      />
    </ScreenContainer>
  );
}

export default TeamList;
