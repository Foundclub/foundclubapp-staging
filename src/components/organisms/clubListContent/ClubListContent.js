import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';

import SearchComponent from '../searchComponent/searchComponent';

/**
 * Club list element to inject on home page or a dedicate one
 * @returns {import('react').ReactElement} ClubListContent component
 */
function ClubListContent() {
  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const [{ clubFilters }, appDispatch] = useAppContext();
  const { getClubFiltersNumber, getClubInitials } = useClub();
  const {
    data: clubPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetClubs(Object.assign(clubFilters || {}, {
    pageSize: 30,
  }));
  const navigation = useNavigation();
  const { t } = useTranslation();

  // variables
  const clubs = useMemo(() => clubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
      || [], [clubPages]);

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleClubSelection = useCallback((/** @type {string | undefined} */ documentId) => {
    if (documentId) {
      // @ts-expect-error because of react navigation type definitions
      navigation.navigate(RouteNames.Club, { clubId: documentId });
    }
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    // @ts-expect-error because of react navigation type definitions
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

  const handleCreateClub = () => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.CreateClub);
  };

  // renderers
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
        Spaces.paddingVertical[12],
        Spaces.paddingRight[24],
        Spaces.marginVertical[8],
        ApplicationStyle.borderColor.primary200,
        ApplicationStyle.borderWidth2,
        ApplicationStyle.borderRadius8,
      ]}
    >
      <TeamShield
        initials={getClubInitials(item.name)}
        isSmall
      />
      <View style={[Spaces.gap[4], { maxWidth: '80%' }]}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[Fonts.p1Bold, Fonts.neutral00]}
        >
          {item.name}
        </Text>
        {item.addressDetails ? (
          <Text style={[Fonts.p3, Fonts.neutral00]}>
            {`${JSON.parse(item.addressDetails)?.postcode || ''} ${JSON.parse(item.addressDetails)?.city || ''}`}
          </Text>
        ) : null}
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
        onPress={handleCreateClub}
        style={Spaces.paddingHorizontal[16]}
        title={t('clubList.actions.createClub')}
        variant="Primary"
      />
    </View>
  );

  return (
    <View style={[Spaces.gap[40], Alignments.fill]}>
      <SearchComponent
        filterNumber={getClubFiltersNumber(clubFilters)}
        handleSearchField={handleSearchField}
        openFilters={handleOpenFilters}
        searchDefaultValue={clubFilters?.name}
      />
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[
          Alignments.fill,
          ApplicationStyle.borderRadius2,
        ]}
        >
          <FlashList
            contentContainerStyle={Spaces.paddingBottom[64]}
            data={clubs}
            estimatedItemSize={250}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={renderEmptyList}
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

export default ClubListContent;
