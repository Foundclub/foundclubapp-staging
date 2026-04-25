import { useEffect, useMemo, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';
import LeagueCard from '@/views/admin/components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from '@/views/admin/components/SuperAdminLeagueLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetSuperadminLeagueSquadDetail,
  useGetSuperadminLeagueSquads,
} from '@/services/admin/superadminLeagueQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 *
 * @param root0
 * @param root0.onChangeText
 * @param root0.placeholder
 * @param root0.value
 */
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

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.tone
 */
function SquadChip({ label, tone = 'neutral' }) {
  const { Colors, Fonts } = useTheme();
  let toneColor = Colors.primary500;

  if (tone === 'success') {
    toneColor = Colors.success500;
  } else if (tone === 'warning') {
    toneColor = Colors.warning500;
  }

  return (
    <View
      style={{
        backgroundColor: `${toneColor}18`,
        borderColor: `${toneColor}66`,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={[Fonts.p3Bold, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

/**
 *
 */
function SuperAdminLeagueSquads() {
  const {
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [division, setDivision] = useState('');
  const [status, setStatus] = useState('');
  const [selectedSquadId, setSelectedSquadId] = useState('');

  const params = useMemo(() => ({
    division: division || undefined,
    page: 1,
    pageSize: 50,
    q: query || undefined,
    sport: sport || undefined,
    status: status || undefined,
  }), [division, query, sport, status]);

  const squadsQuery = useGetSuperadminLeagueSquads(params);
  const squads = useMemo(() => squadsQuery.data?.data || [], [squadsQuery.data]);
  const detailQuery = useGetSuperadminLeagueSquadDetail(selectedSquadId || undefined);

  useEffect(() => {
    if (squads.length === 0) return;
    const selectedStillExists = squads.some((squad) => squad?.documentId === selectedSquadId);
    if (!selectedSquadId || !selectedStillExists) {
      setSelectedSquadId(squads[0]?.documentId || '');
    }
  }, [selectedSquadId, squads]);

  if (squadsQuery.isLoading && !squads.length) {
    return (
      <AdminStateView
        description="Nous chargeons la console Squad League."
        isLoading
        title="Chargement des squads"
      />
    );
  }

  if (squadsQuery.error && !squads.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(squadsQuery.error, 'generic') || 'Impossible de charger les squads League.'}
        onAction={squadsQuery.refetch}
        title="Chargement impossible"
      />
    );
  }

  const selectedSquad = detailQuery.data || null;

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminLeagueSquads]}
      description="Recherche, filtre et inspecte les squads League, leur capitaine, leur Elo, leur division et leur dynamique récente."
      title="Suivi des squads"
    >
      <LeagueCard style={{ marginBottom: 0 }}>
        <View style={[Spaces.gap[10]]}>
          <FilterField onChangeText={setQuery} placeholder="Recherche par squad ou capitaine" value={query} />
          <FilterField onChangeText={setSport} placeholder="Filtre sport (Football à 5, Padel...)" value={sport} />
          <FilterField onChangeText={setDivision} placeholder="Filtre division (1 à 5)" value={division} />
          <FilterField onChangeText={setStatus} placeholder="Filtre statut (complete / incomplete)" value={status} />
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {squadsQuery.data?.meta?.pagination?.total || squads.length}
            {' '}
            squads trouvées
          </Text>
        </View>
      </LeagueCard>

      <View style={[Spaces.gap[12]]}>
        {squads.map((squad) => {
          const isSelected = selectedSquadId === squad?.documentId;
          return (
            <TouchableOpacity
              key={squad?.documentId || squad?.name}
              onPress={() => setSelectedSquadId(squad?.documentId || '')}
            >
              <LeagueCard
                style={{
                  backgroundColor: isSelected ? Colors.primary700 : Colors.primary900,
                  borderColor: isSelected ? Colors.primary500 : Colors.primary700,
                  marginBottom: 0,
                }}
              >
                <View style={[Spaces.gap[10]]}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[Fonts.h4, Fonts.neutral00, { flex: 1, marginRight: 12 }]}>
                      {squad?.name || 'Squad'}
                    </Text>
                    <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                      Elo
                      {' '}
                      {squad?.elo || 0}
                    </Text>
                  </View>
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    Capitaine :
                    {' '}
                    {squad?.captain?.name || 'Inconnu'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <SquadChip label={squad?.sport || 'Sport inconnu'} />
                    <SquadChip label={`Division ${squad?.division || 5}`} />
                    <SquadChip
                      label={squad?.status === 'complete' ? 'Squad complète' : 'Squad incomplète'}
                      tone={squad?.status === 'complete' ? 'success' : 'warning'}
                    />
                    <SquadChip label={`${squad?.membersCount || 0} membres`} />
                  </View>
                </View>
              </LeagueCard>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedSquad ? (
        <LeagueCard style={{ marginBottom: 0 }}>
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.h3, Fonts.neutral00]}>
              Détail squad :
              {' '}
              {selectedSquad?.name || 'Squad'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral300]}>
              Division
              {' '}
              {selectedSquad?.division || 5}
              {' · '}
              Elo
              {' '}
              {selectedSquad?.elo || 0}
              {' · '}
              Sport
              {' '}
              {selectedSquad?.sport || 'Inconnu'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Capitaine :
              {' '}
              {selectedSquad?.captain?.name || 'Inconnu'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Dynamique :
              {' '}
              {selectedSquad?.recentFormLabel || 'Aucune donnée récente'}
            </Text>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Membres</Text>
              {(selectedSquad?.members || []).map((member) => (
                <Text key={member?.documentId || member?.name} style={[Fonts.p2, Fonts.neutral200]}>
                  -
                  {' '}
                  {member?.name || 'Utilisateur'}
                </Text>
              ))}
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Historique récent</Text>
              {(selectedSquad?.recentMatches || []).length === 0 ? (
                <Text style={[Fonts.p2, Fonts.neutral300]}>Aucun match récent.</Text>
              ) : (
                selectedSquad.recentMatches.map((match) => (
                  <Text
                    key={match?.documentId || `${match?.teamA?.name}-${match?.date}`}
                    style={[Fonts.p2, Fonts.neutral200]}
                  >
                    -
                    {' '}
                    {match?.teamA?.name || 'Squad A'}
                    {' '}
                    vs
                    {' '}
                    {match?.teamB?.name || 'Squad B'}
                    {' - '}
                    {match?.score || match?.status || 'Sans score'}
                  </Text>
                ))
              )}
            </View>
          </View>
        </LeagueCard>
      ) : null}
    </SuperAdminLeagueLayout>
  );
}

export default SuperAdminLeagueSquads;
