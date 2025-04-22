import { FlashList } from '@shopify/flash-list';
import {
  useCallback, useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';

/**
 * User avatar selection screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User avatar screen component
 */
function ClubList({ navigation }) {
  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { getClubFiltersNumber, getClubInitials } = useClub();

  const [{ clubFilters }, appDispatch] = useAppContext();

  const {
    data: clubPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetClubs(Object.assign(clubFilters || {}, {
    pageSize: 7,
  }));

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleClubSelection = useCallback((/** @type {string | undefined} */ documentId) => {
    if (documentId) {
      navigation.navigate(
        RouteNames.Club,
        { clubId: documentId },
      );
    }
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    navigation.navigate(RouteNames.ClubFilters);
  }, [navigation]);

  /**
   * Handles the search field input
   * @param {string} name
   */
  const handleSearchField = (name) => {
    appDispatch({
      payload: Object.assign(clubFilters || {}, { name }),
      type: 'SET_CLUB_FILTERS',
    });
  };

  const clubs = useMemo(() => clubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [clubPages]);

  /**
   * Render the club item
   * @param {object} param
   * @param {Club} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => handleClubSelection(item.documentId)}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[16],
        Spaces.paddingVertical[8],
        Spaces.paddingHorizontal[16],
      ]}
    >
      <TeamShield
        initials={getClubInitials(item.name)}
        isSmall
      />
      <View style={[Spaces.gap[4]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {item.name}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral00]}>
          {item.city}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius32,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.paddingHorizontal[12],
      Spaces.paddingVertical[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('clubList.noData')}
      </Text>
      <Button
        onPress={() => navigation.navigate(RouteNames.CreateClub)}
        style={Spaces.paddingHorizontal[16]}
        title={t('clubList.actions.createClub')}
        variant="Primary"
      />
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40]]}>
        <SearchComponent
          filterNumber={getClubFiltersNumber(clubFilters)}
          handleSearchField={handleSearchField}
          openFilters={handleOpenFilters}
        />
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading && !isFetchingNextPage}
        >
          <View style={[Alignments.fill, { minHeight: 300 }]}>
            <FlashList
              contentContainerStyle={{ paddingBottom: 20 }}
              data={clubs}
              estimatedItemSize={100}
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
      </View>
    </ScreenContainer>
  );
}

export default ClubList;
