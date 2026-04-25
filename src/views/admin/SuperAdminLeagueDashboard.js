import { useNavigation } from '@react-navigation/native';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AdminStateView from '@/views/admin/components/AdminStateView';
import LeagueCard from '@/views/admin/components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from '@/views/admin/components/SuperAdminLeagueLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSuperadminLeagueDashboard } from '@/services/admin/superadminLeagueQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const formatCount = (value) => {
  const parsedValue = Number(value || 0);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

function MetricCard({ color, label, value }) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <LeagueCard
      style={{
        backgroundColor: Colors.primary900,
        borderColor: `${color || Colors.primary500}55`,
        flexBasis: '48%',
        flexGrow: 1,
        justifyContent: 'center',
        marginBottom: 0,
        minHeight: 88,
      }}
    >
      <Text style={[Fonts.h2Bold, { color: color || Colors.primary500 }]}>
        {value}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[6]]}>
        {label}
      </Text>
    </LeagueCard>
  );
}

function SummaryList({ items, title, valueKey }) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <LeagueCard style={{ marginBottom: 0 }}>
      <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[12]]}>{title}</Text>
      <View style={[Spaces.gap[10]]}>
        {(items || []).length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral300]}>Aucune donnée disponible.</Text>
        ) : (
          items.map((item) => (
            <View
              key={`${item?.sport || item?.division}-${item?.count || item?.squadsCount || 0}`}
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1, marginRight: 12 }]}>
                {item?.sport || item?.division || '-'}
              </Text>
              <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                {formatCount(item?.[valueKey])}
              </Text>
            </View>
          ))
        )}
      </View>
    </LeagueCard>
  );
}

function SuperAdminLeagueDashboard() {
  const navigation = useNavigation();
  const {
    Alignments,
    Colors,
    Spaces,
  } = useTheme();
  const dashboardQuery = useGetSuperadminLeagueDashboard();

  if (dashboardQuery.isLoading && !dashboardQuery.data) {
    return (
      <AdminStateView
        description="Nous consolidons les métriques globales de Found Club League."
        isLoading
        title="Chargement du dashboard League"
      />
    );
  }

  if (dashboardQuery.error && !dashboardQuery.data) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(dashboardQuery.error, 'generic') || 'Impossible de charger le dashboard League.'}
        onAction={dashboardQuery.refetch}
        title="Chargement impossible"
      />
    );
  }

  const payload = dashboardQuery.data || {};
  const stats = payload?.stats || {};
  const metrics = [
    { color: Colors.primary500, label: 'Joueurs uniques', value: formatCount(stats.totalPlayers) },
    { color: Colors.gold500, label: 'Squads', value: formatCount(stats.totalSquads) },
    { color: Colors.success500, label: 'Squads complètes', value: formatCount(stats.squadsComplete) },
    { color: Colors.warning500, label: 'Squads incomplètes', value: formatCount(stats.squadsIncomplete) },
    { color: Colors.primary500, label: 'Matchs', value: formatCount(stats.totalMatches) },
    { color: Colors.primary300, label: 'Matchs confirmés', value: formatCount(stats.matchesConfirmed) },
    { color: Colors.success500, label: 'Matchs joués', value: formatCount(stats.matchesPlayed) },
    { color: Colors.error500, label: 'Matchs annulés', value: formatCount(stats.matchesCancelled) },
    { color: Colors.success500, label: 'Scores validés', value: formatCount(stats.matchesScoreValidated) },
    { color: Colors.error500, label: 'Litiges ouverts', value: formatCount(stats.openDisputes) },
    { color: Colors.primary500, label: 'Litiges résolus', value: formatCount(stats.resolvedDisputes) },
    { color: Colors.gold500, label: 'Recherches lancées', value: formatCount(stats.matchmakingsLaunched) },
  ];

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminHome, RouteNames.SuperAdminDashboard]}
      description="Pilote l'ouverture plateforme, les squads, les matchs League et les litiges depuis un seul espace dédié."
      rightAction={{
        label: 'Admin classique',
        onPress: () => navigation.navigate(RouteNames.AdminDashboard),
        variant: 'Secondary',
      }}
      title="Dashboard League"
    >
      <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
        {metrics.map((metric) => (
          <MetricCard
            color={metric.color}
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </View>

      <View style={[Spaces.gap[12]]}>
        <SummaryList
          items={payload?.squadsBySport || []}
          title="Squads par sport"
          valueKey="count"
        />
        <SummaryList
          items={payload?.squadsByDivision || []}
          title="Squads par division"
          valueKey="count"
        />
      </View>

      <View style={[Spaces.gap[12]]}>
        <Button
          onPress={() => navigation.navigate(RouteNames.SuperAdminSettings)}
          title="Gérer l'ouverture League"
          variant="Primary"
        />
        <Button
          onPress={() => navigation.navigate(RouteNames.SuperAdminLeagueDisputes)}
          title="Ouvrir les litiges League"
          variant="Secondary"
        />
      </View>
    </SuperAdminLeagueLayout>
  );
}

export default SuperAdminLeagueDashboard;
