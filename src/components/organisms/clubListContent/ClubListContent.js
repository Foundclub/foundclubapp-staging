import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import EmptyState from '@/components/atoms/emptyState/EmptyState';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';

import { getShortAddress } from '@/utils/location';

import SearchComponent from '../searchComponent/searchComponent';
import SearchMap from '@/components/organisms/searchMap/SearchMap';
import MapFloatButton from '@/components/atoms/mapFloatButton/MapFloatButton';

/**
 * Club list element to inject on home page or a dedicate one
 * @returns {import('react').ReactElement} ClubListContent component
 */
function ClubListContent() {
  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const [isMapView, setIsMapView] = useState(false);
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
      navigation.navigate(RouteNames.ClubStack, {
        screen: RouteNames.Club,
        params: { clubId: documentId },
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
    
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => isMultisport 
          ? handleMultisportSelection(item.documentId)
          : handleClubSelection(item.documentId)
        }
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
            imageUrl={item.logo.url}
            size={60}
            style={{ borderRadius: 30 }}
            imageStyle={{ borderRadius: 30 }}
          />
        ) : (
          <TeamShield
            initials={getClubInitials(item.name)}
            isSmall
            size={60}
          />
        )}
        <View style={[Spaces.gap[4], { maxWidth: '70%', flex: 1 }]}>
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
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
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
              {item.sectionsCount} section{item.sectionsCount > 1 ? 's' : ''}
            </Text>
          )}
          {!isMultisport && item.sponsor?.length > 0 && (
            <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[12], { flexWrap: 'wrap' }]}>
              {item.sponsor.slice(0, 5).map((sponsor, idx) => (
                <SponsorLogoTile
                  key={sponsor.id || idx}
                  imageUrl={sponsor.logo?.url}
                  link={sponsor.link}
                  title={sponsor.title || sponsor.name || 'Sponsor'}
                  width={40}
                  height={40}
                  borderRadius={20}
                  titleStyle={[
                    Fonts.p4Bold,
                    Fonts.neutral00,
                    { fontSize: 10, textAlign: 'center' },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <EmptyState
      title={t('clubList.noData')}
      actionLabel={t('clubList.actions.createClub')}
      onAction={handleCreateClub}
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
            items={clubs}
            onMarkerPress={handleClubSelection}
            type="club"
          />
        ) : (
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
                data={clubs}
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
        )}

      </View>
    </View>
  );
}

export default ClubListContent;
