import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';
import LeagueCard from '@/views/admin/components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from '@/views/admin/components/SuperAdminLeagueLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSuperadminLeagueMatches } from '@/services/admin/superadminLeagueQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

function FilterField({ onChangeText, placeholder, value }) {
  const { Colors, Fonts } = useTheme();

  return (
    <TextInput
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.neutral500}
      style={{
        backgroundColor: Colors.primary900,
        borderColor: Colors.primary700,
        borderRadius: 14,
        borderWidth: 1,
        color: Colors.neutral00,
        minHeight: 46,
        paddingHorizontal: 14,
        ...Fonts.p2,
      }}
      value={value}
    />
  );
}

function SuperAdminLeagueMatches() {
  const { Colors, Fonts, Spaces } = useTheme();
  const [team, setTeam] = useState('');
  const [sport, setSport] = useState('');
  const [status, setStatus] = useState('');
  const [division, setDivision] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = useMemo(() => ({
    division: division || undefined,
    from: from || undefined,
    page: 1,
    pageSize: 50,
    sport: sport || undefined,
    status: status || undefined,
    team: team || undefined,
    to: to || undefined,
  }), [division, from, sport, status, team, to]);

  const matchesQuery = useGetSuperadminLeagueMatches(params);
  const matches = matchesQuery.data?.data || [];

  if (matchesQuery.isLoading && !matches.length) {
    return (
      <AdminStateView
        description="Nous chargeons tous les matchs League de la plateforme."
        isLoading
        title="Chargement des matchs"
      />
    );
  }

  if (matchesQuery.error && !matches.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(matchesQuery.error, 'generic') || 'Impossible de charger les matchs League.'}
        onAction={matchesQuery.refetch}
        title="Chargement impossible"
      />
    );
  }

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminLeagueMatches]}
      description="Suis les matchs League avec leurs statuts métier, leur score, leur terrain et leurs litiges éventuels."
      title="Suivi des matchs"
    >
      <LeagueCard style={{ marginBottom: 0 }}>
        <View style={[Spaces.gap[10]]}>
          <FilterField onChangeText={setTeam} placeholder="Filtre équipe" value={team} />
          <FilterField onChangeText={setSport} placeholder="Filtre sport" value={sport} />
          <FilterField onChangeText={setStatus} placeholder="Filtre statut" value={status} />
          <FilterField onChangeText={setDivision} placeholder="Filtre division" value={division} />
          <FilterField onChangeText={setFrom} placeholder="Date min (2026-04-24)" value={from} />
          <FilterField onChangeText={setTo} placeholder="Date max (2026-04-30)" value={to} />
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {matchesQuery.data?.meta?.pagination?.total || matches.length}
            {' '}
            matchs trouvés
          </Text>
        </View>
      </LeagueCard>

      <View style={[Spaces.gap[12]]}>
        {matches.length === 0 ? (
          <LeagueCard style={{ marginBottom: 0 }}>
            <Text style={[Fonts.p2, Fonts.neutral300]}>Aucun match ne correspond à ces filtres.</Text>
          </LeagueCard>
        ) : (
          matches.map((match) => (
            <LeagueCard key={match?.documentId || `${match?.teamA?.name}-${match?.date}`} style={{ marginBottom: 0 }}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>
                  {match?.teamA?.name || 'Squad A'}
                  {' '}
                  vs
                  {' '}
                  {match?.teamB?.name || 'Squad B'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral300]}>
                  Sport :
                  {' '}
                  {match?.sport || 'Inconnu'}
                  {' · '}
                  Division
                  {' '}
                  {match?.division || 5}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral300]}>
                  Date :
                  {' '}
                  {match?.date || 'Non définie'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Statut :
                  {' '}
                  {match?.derivedStatus || match?.status || 'unknown'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Score :
                  {' '}
                  {match?.score || 'En attente'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Terrain :
                  {' '}
                  {match?.venue || 'Non renseigné'}
                </Text>
                {match?.disputeState && match.disputeState !== 'none' ? (
                  <Text style={[Fonts.p2Bold, { color: Colors.error500 }]}>
                    Litige :
                    {' '}
                    {match.disputeState}
                  </Text>
                ) : null}
              </View>
            </LeagueCard>
          ))
        )}
      </View>
    </SuperAdminLeagueLayout>
  );
}

export default SuperAdminLeagueMatches;
