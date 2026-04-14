import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import SelectPicker from '@/components/atoms/selectPicker/SelectPicker';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetClubs } from '@/services/club/clubQueries';

/**
 * Admin Revenue screen component
 * @returns {import('react').ReactElement} Admin Revenue screen component
 */
function AdminRevenue() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Fetch partner clubs (isCustomer: true)
  const {
    data: clubsData,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetClubs({
    isCustomer: true,
    pageSize: 20,
  });

  const clubs = useMemo(() => clubsData?.pages
    ?.reduce((acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
        || [], [clubsData]);

  // Calculate total revenue dynamically from the loaded list
  // Note: This is an approximation based on loaded data.
  // Ideally, the backend stats endpoint gives the true total.
  // But per requirements: "Calculé dynamiquement côté client sur la liste chargée"
  const totalRevenue = useMemo(() => clubs.reduce((acc, club) => acc + (club.subscriptionValue || 0), 0), [clubs]);

  if (isLoading && !clubs.length) {
    return (
      <AdminStateView
        description="Nous chargeons les revenus et les clubs partenaires."
        isLoading
        title="Chargement des revenus"
      />
    );
  }

  if (!isLoading && !error && !clubs.length) {
    return (
      <AdminStateView
        actionLabel="Rafraichir"
        description="Aucun club partenaire n'est disponible pour cette vue."
        onAction={refetch}
        title="Aucun revenu disponible"
      />
    );
  }

  const years = [
    { label: '2024', value: '2024' },
    { label: '2025', value: '2025' },
    { label: '2026', value: '2026' },
  ];

  const renderItem = ({ item }) => (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.padding[16],
        Spaces.marginBottom[12],
        ApplicationStyle.backgroundColor.neutral800,
        ApplicationStyle.borderRadius16,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        {item?.logo?.url ? (
          <ProfileAvatar
            imageStyle={{ borderRadius: 40 }}
            imageUrl={item.logo.url}
            size={40}
            variant="logo"
            style={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 40 },
            ]}
          />
        ) : (
          <TeamShield
            initials={item?.name?.substring(0, 2) || 'FC'}
            isSmall
          />
        )}
        <View>
          <Text style={[Fonts.h4, Fonts.neutral00]}>{item?.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{item?.city || 'Ville inconnue'}</Text>
        </View>
      </View>
      <Text style={[Fonts.h3, { color: Colors.success500 }]}>
        {item?.subscriptionValue || 0}
        {' '}
        €
      </Text>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[24]]}>
        <Text style={[Fonts.h1, Fonts.neutral00, Spaces.marginBottom[8]]}>Revenus</Text>
        <Text style={[Fonts.h2, { color: Colors.success500 }]}>
          Total :
          {totalRevenue}
          {' '}
          €
        </Text>
      </View>

      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[24]]}>
        <SelectPicker
          items={years}
          onValueChange={setSelectedYear}
          placeholder="Année"
          value={selectedYear}
        />
      </View>

      <WithDataWrapper
        error={error}
        isLoading={isLoading && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill, Spaces.paddingHorizontal[24]]}>
          <FlashList
            data={clubs}
            estimatedItemSize={80}
            keyExtractor={(item) => item?.documentId || item?.id?.toString() || 'unknown'}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
          />
        </View>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default AdminRevenue;
