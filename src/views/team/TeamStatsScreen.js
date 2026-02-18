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
  // We only show Presence, Absence, Retard for ALL sports as requested
  return [
    { key: 'attendanceCount', label: 'Prés.' },
    { key: 'absenceCount', label: 'Abs.' },
    { key: 'retardCount', label: 'Ret.' }, // Retard
  ];
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
    <View style={[Spaces.marginBottom[24], Spaces.paddingHorizontal[4]]}>
      {/* Stats Summary Card with Glass effect */}
      <View
        style={[
          Alignments.row,
          Alignments.justifySpaceBetween,
          Spaces.paddingHorizontal[24],
          Spaces.paddingVertical[20],
          {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      >
        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h1, { color: Colors.primary500, fontSize: 32, lineHeight: 40, textAlign: 'center' }]}>
            {statsData?.data?.length || 0}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }]}>Joueurs</Text>
        </View>
        
        <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, fontSize: 32, lineHeight: 40, textAlign: 'center' }]}>
            {statsData?.totalEvents || 0}
          </Text>
          <Text 
            adjustsFontSizeToFit 
            numberOfLines={1} 
            style={[Fonts.p2, { color: Colors.neutral200, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }]}
          >
            Événements
          </Text>
        </View>
        
        <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text 
            adjustsFontSizeToFit 
            numberOfLines={1}
            style={[Fonts.h3Bold, { color: Colors.neutral00, textTransform: 'capitalize', textAlign: 'center' }]}
          >
            {statsData?.sport || '-'}
          </Text>
           <Text style={[Fonts.p2, { color: Colors.neutral200, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }]}>Sport</Text>
        </View>
      </View>

      {/* Column Headers */}
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[12],
          Spaces.marginTop[24],
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral300, flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          Joueur
        </Text>
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {columns.map((col) => (
            <View key={col.key} style={[Alignments.alignCenter, { width: 44, justifyContent: 'center' }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.neutral300, textTransform: 'uppercase', textAlign: 'center' }]}>
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
          <Text style={[Fonts.p1, { color: Colors.error500 }]}>
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
