import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';
import LeagueCard from '@/views/admin/components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from '@/views/admin/components/SuperAdminLeagueLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSuperadminLeagueDivisions } from '@/services/admin/superadminLeagueQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 *
 */
function SuperAdminLeagueDivisions() {
  const { Fonts, Spaces } = useTheme();
  const divisionsQuery = useGetSuperadminLeagueDivisions();
  const divisions = divisionsQuery.data?.data || [];

  if (divisionsQuery.isLoading && !divisions.length) {
    return (
      <AdminStateView
        description="Nous chargeons la répartition des squads par division League."
        isLoading
        title="Chargement des divisions"
      />
    );
  }

  if (divisionsQuery.error && !divisions.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(divisionsQuery.error, 'generic') || 'Impossible de charger les divisions League.'}
        onAction={divisionsQuery.refetch}
        title="Chargement impossible"
      />
    );
  }

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminLeagueDivisions]}
      description="Visualise les divisions 1 à 5, l'effectif des squads, l'Elo moyen et le volume de matchs par sport."
      title="Divisions League"
    >
      <View style={[Spaces.gap[12]]}>
        {divisions.length === 0 ? (
          <LeagueCard style={{ marginBottom: 0 }}>
            <Text style={[Fonts.p2, Fonts.neutral300]}>Aucune donnée de division disponible.</Text>
          </LeagueCard>
        ) : (
          divisions.map((divisionGroup) => (
            <LeagueCard key={`${divisionGroup?.sport}-${divisionGroup?.division}`} style={{ marginBottom: 0 }}>
              <View style={[Spaces.gap[10]]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>
                  Division
                  {' '}
                  {divisionGroup?.division || 5}
                  {' · '}
                  {divisionGroup?.sport || 'Sport inconnu'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral300]}>
                  Squads :
                  {' '}
                  {divisionGroup?.squadsCount || 0}
                  {' · '}
                  Elo moyen :
                  {' '}
                  {divisionGroup?.averageElo || 0}
                  {' · '}
                  Matchs joués :
                  {' '}
                  {divisionGroup?.matchesPlayed || 0}
                </Text>

                <View style={[Spaces.gap[6]]}>
                  {(divisionGroup?.squads || []).map((squad) => (
                    <Text key={squad?.documentId || squad?.name} style={[Fonts.p2, Fonts.neutral200]}>
                      -
                      {' '}
                      {squad?.name || 'Squad'}
                      {' - Elo '}
                      {squad?.elo || 0}
                      {' - '}
                      {squad?.membersCount || 0}
                      {' joueurs'}
                    </Text>
                  ))}
                </View>
              </View>
            </LeagueCard>
          ))
        )}
      </View>
    </SuperAdminLeagueLayout>
  );
}

export default SuperAdminLeagueDivisions;
