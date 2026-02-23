import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SearchMap from '@/components/organisms/searchMap/SearchMap';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';
import { useSearchClubs } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import { getShortAddress } from '@/utils/location';

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
  const [isMapView] = useState(false);
  const [{ clubFilters }, appDispatch] = useAppContext();
  const { getClubFiltersNumber, getClubInitials } = useClub();
  const activeSearchText = useMemo(
    () => (typeof clubFilters?.name === 'string' ? clubFilters.name.trim() : ''),
    [clubFilters?.name],
  );
  const isSmartSearchEnabled = activeSearchText.length >= 2;
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
  }), {
    enabled: !isSmartSearchEnabled,
  });
  const {
    data: smartClubPages,
    error: smartError,
    fetchNextPage: fetchSmartNextPage,
    hasNextPage: hasSmartNextPage,
    isFetchingNextPage: isFetchingSmartNextPage,
    isLoading: isSmartLoading,
    refetch: refetchSmart,
  } = useSearchClubs({
    activity: clubFilters?.activity,
    lat: clubFilters?.lat,
    lon: clubFilters?.lon,
    pageSize: 30,
    q: activeSearchText,
    radius: clubFilters?.radius,
  }, {
    enabled: isSmartSearchEnabled,
  });
  const navigation = useNavigation();
  const { t } = useTranslation();

  // variables
  const clubs = useMemo(() => clubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [clubPages]);
  const smartClubs = useMemo(() => smartClubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = mapSearchPayload(page);
      return acc.concat(items);
    }, [])
    || [], [smartClubPages]);
  const displayedClubs = isSmartSearchEnabled ? smartClubs : clubs;
  const activeError = isSmartSearchEnabled ? smartError : error;
  const activeIsLoading = isSmartSearchEnabled ? isSmartLoading : isLoading;
  const activeIsFetchingNext = isSmartSearchEnabled ? isFetchingSmartNextPage : isFetchingNextPage;

  // handlers
  const handleEndReached = useCallback(() => {
    if (isSmartSearchEnabled) {
      if (hasSmartNextPage && !isFetchingSmartNextPage) {
        fetchSmartNextPage();
      }
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    fetchSmartNextPage,
    hasNextPage,
    hasSmartNextPage,
    isFetchingNextPage,
    isFetchingSmartNextPage,
    isSmartSearchEnabled,
  ]);

  const handleClubSelection = useCallback((/** @type {string | undefined} */ documentId) => {
    if (documentId) {
      // @ts-expect-error because of react navigation type definitions
      navigation.navigate(RouteNames.ClubStack, {
        params: { clubId: documentId },
        screen: RouteNames.Club,
      });
    }
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.ClubFilters,
    });
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
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.CreateClub,
    });
  };
  // renderers
  /**
   * Handle multisport club selection - navigates to MultisportClubDetails
   * @param {string | undefined} documentId
   */
  const handleMultisportSelection = useCallback((documentId) => {
    if (documentId) {
      // @ts-expect-error because of react navigation type definitions
      navigation.navigate(RouteNames.MultisportClubDetails, {
        cmId: documentId,
      });
    }
  }, [navigation]);

  /**
   * Render the club item
   * @param {object} param
   * @param {Club} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => {
    const isMultisport = item._type === 'multisport';
    const primaryReasonLabel = getMatchReasonLabel(item?.__search?.matchReasons?.[0]);

    return (
      <View style={[Spaces.gap[8]]}>
        {primaryReasonLabel ? (
          <Text style={[Fonts.p3, Fonts.primary500]}>
            {`Tri pertinence: ${primaryReasonLabel}`}
          </Text>
        ) : null}
        <TouchableOpacity
          key={item.id}
          onPress={() => (isMultisport
            ? handleMultisportSelection(item.documentId)
            : handleClubSelection(item.documentId))}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[16],
            Spaces.paddingLeft[16],
            Spaces.paddingVertical[12],
            Spaces.paddingRight[24],
            Spaces.marginVertical[8],
            isMultisport
              ? ApplicationStyle.borderColor.primary500
              : ApplicationStyle.borderColor.primary200,
            ApplicationStyle.borderWidth2,
            ApplicationStyle.borderRadius8,
          ]}
        >
          {item.logo?.url ? (
            <ProfileAvatar
              imageStyle={{ borderRadius: 30 }}
              imageUrl={item.logo.url}
              size={60}
              style={{ borderRadius: 30 }}
            />
          ) : (
            <TeamShield
              initials={getClubInitials(item.name)}
              isSmall
              size={60}
            />
          )}
          <View style={[Spaces.gap[4], { flex: 1, maxWidth: '70%' }]}>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}
              >
                {item.name}
              </Text>
              {isMultisport && (
                <View style={{
                  backgroundColor: '#00BCD4',
                  borderRadius: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
                >
                  <Text style={[Fonts.p3, { color: '#FFFFFF', fontSize: 10 }]}>
                    OMNISPORT
                  </Text>
                </View>
              )}
            </View>
            {item.addressDetails ? (
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {getShortAddress(item.addressDetails)}
              </Text>
            ) : null}
            {isMultisport && item.sectionsCount > 0 && (
              <Text style={[Fonts.p2, Fonts.primary500]}>
                {item.sectionsCount}
                {' '}
                section
                {item.sectionsCount > 1 ? 's' : ''}
              </Text>
            )}
            {!isMultisport && item.sponsor?.length > 0 && (
              <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[12], { flexWrap: 'wrap' }]}>
                {item.sponsor.slice(0, 5).map((sponsor, idx) => (
                  <SponsorLogoTile
                    borderRadius={20}
                    height={40}
                    imageUrl={sponsor.logo?.url}
                    key={sponsor.id || idx}
                    link={sponsor.link}
                    title={sponsor.title || sponsor.name || 'Sponsor'}
                    titleStyle={[
                      Fonts.p4Bold,
                      Fonts.neutral00,
                      { fontSize: 10, textAlign: 'center' },
                    ]}
                    width={40}
                  />
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyList = () => (
    <EmptyState
      actionLabel={t('clubList.actions.createClub')}
      onAction={handleCreateClub}
      title={t('clubList.noData')}
    />
  );

  return (
    <View style={[Spaces.gap[40], Alignments.fill]}>
      <View style={[Spaces.gap[40], Alignments.fill]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
          <View style={{ flex: 1 }}>
            <SearchComponent
              filterNumber={getClubFiltersNumber(clubFilters)}
              handleSearchField={handleSearchField}
              openFilters={handleOpenFilters}
              searchDefaultValue={clubFilters?.name}
            />
          </View>
        </View>
        {isMapView ? (
          <SearchMap
            items={displayedClubs}
            onMarkerPress={handleClubSelection}
            type="club"
          />
        ) : (
          <WithDataWrapper
            error={activeError?.message}
            isLoading={activeIsLoading && !activeIsFetchingNext}
            wrapperStyle={[Alignments.fill]}
          >
            <View style={[
              Alignments.fill,
              ApplicationStyle.borderRadius2,
            ]}
            >
              <FlashList
                data={displayedClubs}
                keyExtractor={(item) => item?.documentId || 'unknown'}
                ListEmptyComponent={renderEmptyList}
                ListHeaderComponent={isSmartSearchEnabled ? (
                  <Text style={[Fonts.p3, Fonts.primary500, Spaces.marginBottom[8]]}>
                    Trie par pertinence
                  </Text>
                ) : null}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                onRefresh={isSmartSearchEnabled ? refetchSmart : refetch}
                refreshing={activeIsLoading && !activeIsFetchingNext}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </WithDataWrapper>
        )}

      </View>
    </View>
  );
}

export default ClubListContent;
