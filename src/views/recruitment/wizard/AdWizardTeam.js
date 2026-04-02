import { useIsFocused } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { getTeamById } from '@/services/team/teamService';

import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';

const getTeamKey = (team) => String(team?.documentId || team?.id || '').trim();

const normalizeComparableText = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const getEntityLabel = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value?.name || value?.label || '').trim();
  }
  return '';
};

const getTeamIdentityKeys = (team) => {
  const keys = [];
  const documentId = String(team?.documentId || '').trim();
  const numericId = String(team?.id || '').trim();

  if (documentId) keys.push(`doc:${documentId}`);
  if (numericId) keys.push(`id:${numericId}`);

  const compositeKey = [
    normalizeComparableText(team?.name),
    normalizeComparableText(team?.club?.documentId || team?.club?.id || team?.club?.name),
    normalizeComparableText(getEntityLabel(team?.section)),
    normalizeComparableText(getEntityLabel(team?.category)),
    normalizeComparableText(getEntityLabel(team?.level)),
  ].join('|');

  if (compositeKey.replace(/\|/g, '')) {
    keys.push(`meta:${compositeKey}`);
  }

  return keys;
};

const mergeTeamSummary = (previousTeam, nextTeam) => ({
  ...previousTeam,
  ...nextTeam,
  activities: nextTeam?.activities?.length ? nextTeam.activities : previousTeam?.activities,
  category: nextTeam?.category || previousTeam?.category,
  club: nextTeam?.club || previousTeam?.club,
  level: nextTeam?.level || previousTeam?.level,
  section: nextTeam?.section || previousTeam?.section,
});

const dedupeTeams = (teams) => {
  const uniqueTeams = [];
  const teamIndexesByKey = new Map();

  teams.forEach((team) => {
    const identityKeys = getTeamIdentityKeys(team);
    if (!identityKeys.length) return;

    const existingIndex = identityKeys.reduce((foundIndex, identityKey) => {
      if (foundIndex !== null) return foundIndex;
      if (teamIndexesByKey.has(identityKey)) {
        return teamIndexesByKey.get(identityKey);
      }
      return null;
    }, null);

    if (existingIndex !== null && existingIndex !== undefined) {
      uniqueTeams[existingIndex] = mergeTeamSummary(uniqueTeams[existingIndex], team);
      identityKeys.forEach((identityKey) => {
        teamIndexesByKey.set(identityKey, existingIndex);
      });
      return;
    }

    const nextIndex = uniqueTeams.push(team) - 1;
    identityKeys.forEach((identityKey) => {
      teamIndexesByKey.set(identityKey, nextIndex);
    });
  });

  return uniqueTeams;
};

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardTeam({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useAdWizard();
  const { userData } = useAuth();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [loadingTeamId, setLoadingTeamId] = useState(null);

  const handleSelectTeam = useCallback(async (team) => {
    const nextTeamId = String(team?.documentId || '').trim();
    try {
      setLoading(true);
      setLoadingTeamId(nextTeamId || null);

      const fullTeam = nextTeamId ? await getTeamById(nextTeamId) : team;

      dispatch({ payload: fullTeam || team, type: 'SET_TEAM' });
      navigation.navigate(RouteNames.AdWizardInfo);
    } catch (error) {
      console.error('[AdWizardTeam] Error fetching team:', error);
      dispatch({ payload: team, type: 'SET_TEAM' });
      navigation.navigate(RouteNames.AdWizardInfo);
    } finally {
      if (isFocused) {
        setLoading(false);
        setLoadingTeamId(null);
      }
    }
  }, [dispatch, isFocused, navigation]);

  useEffect(() => {
    if (route.params?.event && !state.event && !loading && isFocused) {
      dispatch({ payload: route.params.event, type: 'SET_EVENT' });
      if (route.params.event.team) {
        handleSelectTeam(route.params.event.team);
      }
    }
  }, [dispatch, handleSelectTeam, isFocused, loading, route.params?.event, state.event]);

  const userTeams = useMemo(() => dedupeTeams([
    ...(userData?.myTeams || []),
    ...(userData?.trainedTeams || []),
  ]), [userData?.myTeams, userData?.trainedTeams]);

  useEffect(() => {
    if (isFocused && userTeams.length === 1 && !state.team && !loading) {
      handleSelectTeam(userTeams[0]);
    }
  }, [handleSelectTeam, isFocused, loading, state.team, userTeams]);

  if (userTeams.length === 0) {
    return (
      <WizardStepLayout
        onBack={() => navigation.goBack()}
        stepCount={getAdWizardStepCount(state)}
        stepIndex={1}
        subtitle="Vous n'avez pas d'équipe associée"
        title="Créer une annonce"
      >
        <View
          style={[
            Spaces.padding[24],
            {
              backgroundColor: Colors.neutral800,
              borderColor: Colors.neutral700,
              borderRadius: 16,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p1, { color: Colors.neutral200, textAlign: 'center' }]}>
            Vous devez être associé à une équipe pour créer une annonce de recrutement.
          </Text>
        </View>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={1}
      subtitle="Sélectionnez l'équipe qui recrute"
      title="Pour quelle équipe ?"
    >
      <View style={[Spaces.gap[16]]}>
        {userTeams.map((team) => {
          const teamKey = getTeamKey(team) || `${team.name}-${team.club?.name || 'team'}`;
          const teamId = String(team?.documentId || '').trim();
          const isSelected = state.team?.documentId === team?.documentId;
          const isTeamLoading = loadingTeamId === teamId;

          return (
            <EventWizardTeamCard
              disabled={loading}
              isLoading={isTeamLoading}
              isSelected={isSelected}
              key={teamKey}
              onPress={() => handleSelectTeam(team)}
              showSelectionIndicator
              team={team}
            />
          );
        })}
      </View>

      <View style={[Spaces.marginTop[16]]}>
        <Text style={[Fonts.p2, { color: Colors.neutral400, textAlign: 'center' }]}>
          {userTeams.length}
          {' '}
          équipe
          {userTeams.length > 1 ? 's' : ''}
          {' '}
          disponible
          {userTeams.length > 1 ? 's' : ''}
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardTeam;
