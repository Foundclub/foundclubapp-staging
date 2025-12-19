import React, { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';
import { useGetTeamStats } from '@/services/stats/statsQueries';
import StatRow from '@/components/molecules/statRow/StatRow';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Get dynamic columns based on sport type
 * @param {string} sport - The sport name (normalized to lowercase)
 * @returns {Array<{key: string, label: string, isPrimary?: boolean}>}
 */
const getColumnsForSport = (sport) => {
  // Base columns (always shown)
  const baseColumns = [
    { key: 'attendanceCount', label: 'Prés.', isPrimary: true },
    { key: 'absenceCount', label: 'Abs.' },
    { key: 'convocationCount', label: 'Conv.' },
  ];

  // Sport-specific performance columns (V1: show with 0 values)
  const sportKey = (sport || 'generic').toLowerCase();

  switch (sportKey) {
    case 'football':
      return [
        ...baseColumns,
        { key: 'stat1', label: 'Buts' },
        { key: 'stat2', label: 'Passes' },
      ];
    case 'basket':
    case 'basketball':
      return [
        ...baseColumns,
        { key: 'stat1', label: 'Pts' },
        { key: 'stat2', label: 'Passes' },
      ];
    case 'rugby':
      return [
        ...baseColumns,
        { key: 'stat1', label: 'Essais' },
        { key: 'stat2', label: 'Pts' },
      ];
    case 'handball':
      return [
        ...baseColumns,
        { key: 'stat1', label: 'Buts' },
        { key: 'stat2', label: 'Passes' },
      ];
    case 'volleyball':
    case 'volley':
      return [
        ...baseColumns,
        { key: 'stat1', label: 'Pts' },
        { key: 'stat2', label: 'Aces' },
      ];
    default:
      // Generic sports: only show base columns
      return baseColumns;
  }
};

/**
 * TeamStatsScreen - Displays attendance and performance stats for team players
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function TeamStatsScreen({ route }) {
  const { teamId, teamName: routeTeamName } = route.params || {};
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: statsData, isLoading, error } = useGetTeamStats(teamId);

  const columns = useMemo(() => {
    return getColumnsForSport(statsData?.sport);
  }, [statsData?.sport]);

  const teamName = statsData?.teamName || routeTeamName || 'Équipe';

  const renderHeader = () => (
    <View style={[Spaces.marginBottom[16]]}>
      {/* Stats Summary */}
      <View
        style={[
          Alignments.row,
          Alignments.justifySpaceBetween,
          Spaces.padding[16],
          {
            backgroundColor: Colors.neutral800,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.neutral700,
          },
        ]}
      >
        <View style={[Alignments.alignCenter]}>
          <Text style={[Fonts.h2Bold, { color: Colors.primary500 }]}>
            {statsData?.data?.length || 0}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Joueurs</Text>
        </View>
        <View style={[Alignments.alignCenter]}>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral100 }]}>
            {statsData?.totalEvents || 0}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Événements</Text>
        </View>
        <View style={[Alignments.alignCenter]}>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral100 }]}>
            {statsData?.sport || '-'}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Sport</Text>
        </View>
      </View>

      {/* Column Headers */}
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          Spaces.marginTop[16],
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral400, flex: 1 }]}>
          Joueur
        </Text>
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {columns.map((col) => (
            <View key={col.key} style={[Alignments.alignCenter, { width: 40 }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.neutral400 }]}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
          <Loader />
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
          <Text style={[Fonts.p1, { color: Colors.error }]}>
            {t('common.errors.generic', 'Une erreur est survenue')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[16],
        { paddingBottom: insets.bottom + 16 },
      ]}
    >
      <FlatList
        data={statsData?.data || []}
        keyExtractor={(item) => item.user?.documentId || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
            <Text style={[Fonts.p1, { color: Colors.neutral400 }]}>
              {t('teamStats.empty', 'Aucun joueur dans cette équipe')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[Spaces.marginBottom[8]]}>
            <StatRow player={item} columns={columns} isEven={index % 2 === 0} />
          </View>
        )}
        contentContainerStyle={[Spaces.gap[0]]}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

export default TeamStatsScreen;
