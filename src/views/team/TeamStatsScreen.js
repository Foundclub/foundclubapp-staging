import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList, RefreshControl, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import StatRow from '@/components/molecules/statRow/StatRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeamStats } from '@/services/stats/statsQueries';

/**
 * Get dynamic columns based on sport type
 * @param {string} sport - The sport name (normalized to lowercase)
 * @returns {Array<{key: string, label: string, isPrimary?: boolean}>}
 */
const getColumnsForSport = (sport) =>
  // We only show Presence, Absence, Retard for ALL sports as requested
  [
    { key: 'attendanceCount', label: 'Prés.' },
    { key: 'absenceCount', label: 'Abs.' },
    { key: 'retardCount', label: 'Ret.' }, // Retard
  ]
;

/**
 * TeamStatsScreen - Displays attendance and performance stats for team players
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function TeamStatsScreen({ navigation, route }) {
  const { teamId, teamName: routeTeamName } = route.params || {};
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    data: statsData,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetTeamStats(teamId, { enabled: Boolean(teamId) });

  const columns = useMemo(() => getColumnsForSport(statsData?.sport), [statsData?.sport]);

  const teamName = statsData?.teamName || routeTeamName || 'Équipe';

  const isMissingTeamId = !teamId;
  const isRefreshing = isFetching && !isLoading;

  const renderHeader = () => (
    <View style={[Spaces.marginBottom[24], Spaces.paddingHorizontal[4]]}>
      {/* Stats Summary Card with Glass effect */}
      <View
        style={[
          Alignments.row,
          Alignments.justifySpaceBetween,
          Spaces.paddingHorizontal[24],
          Spaces.paddingVertical[16],
          {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            borderWidth: 1,
          },
        ]}
      >
        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h1, {
            color: Colors.primary500, fontSize: 32, lineHeight: 40, textAlign: 'center',
          }]}
          >
            {statsData?.data?.length || 0}
          </Text>
          <Text style={[Fonts.p2, {
            color: Colors.neutral200, letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase',
          }]}
          >
            Joueurs
          </Text>
        </View>

        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', height: '100%', width: 1 }} />

        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h1, {
            color: Colors.neutral00, fontSize: 32, lineHeight: 40, textAlign: 'center',
          }]}
          >
            {statsData?.totalEvents || 0}
          </Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[Fonts.p2, {
              color: Colors.neutral200, letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase',
            }]}
          >
            Événements
          </Text>
        </View>

        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', height: '100%', width: 1 }} />

        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[Fonts.h3Bold, { color: Colors.neutral00, textAlign: 'center', textTransform: 'capitalize' }]}
          >
            {statsData?.sport || '-'}
          </Text>
          <Text style={[Fonts.p2, {
            color: Colors.neutral200, letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase',
          }]}
          >
            Sport
          </Text>
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
        <Text style={[Fonts.p3Bold, {
          color: Colors.neutral300, flex: 1, letterSpacing: 0.5, textTransform: 'uppercase',
        }]}
        >
          Joueur
        </Text>
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {columns.map((col) => (
            <View key={col.key} style={[Alignments.alignCenter, { justifyContent: 'center', width: 44 }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.neutral300, textAlign: 'center', textTransform: 'uppercase' }]}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  if (isMissingTeamId) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter, Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            Équipe introuvable
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Aucun identifiant d équipe n a été fourni.
          </Text>
          <Button
            onPress={() => navigation.navigate(RouteNames.TeamList)}
            title="Retour aux équipes"
            variant="Secondary"
          />
        </View>
      </ScreenContainer>
    );
  }

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
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter, Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            Impossible de charger les statistiques
          </Text>
          <Text style={[Fonts.p1, { color: Colors.error500 }]}>
            {error?.message || t('common.errors.generic', 'Une erreur est survenue')}
          </Text>
          <Button onPress={() => refetch()} title="Réessayer" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      // Retrait bas systeme deja applique au contenu ci-dessous : pas de plancher
      // conteneur, sinon insets.bottom serait compte deux fois.
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[16],
        { paddingBottom: insets.bottom + 16 },
      ]}
    >
      <FlatList
        contentContainerStyle={[Spaces.gap[0]]}
        data={statsData?.data || []}
        keyExtractor={(item, index) => item.user?.documentId || `team-stat-row-${index}`}
        ListEmptyComponent={(
          <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
            <Text style={[Fonts.p1, { color: Colors.neutral400 }]}>
              {t('teamStats.empty', 'Aucun joueur dans cette équipe')}
            </Text>
          </View>
        )}
        ListHeaderComponent={renderHeader}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => refetch()}
            refreshing={isRefreshing}
            tintColor={Colors.primary500}
          />
        )}
        renderItem={({ index, item }) => (
          <View style={[Spaces.marginBottom[8]]}>
            <StatRow columns={columns} isEven={index % 2 === 0} player={item} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

export default TeamStatsScreen;
