import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeams } from '@/services/team/teamQueries';

import { sortTeamsForDisplay } from '@/utils/teamSort';

import { useEventWizard } from './EventWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardTeam({ navigation }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch } = useEventWizard();
  const [searchQuery, setSearchQuery] = useState('');

  const trainedTeamIds = new Set(
    (userData?.trainedTeams || [])
      .map((team) => team?.documentId)
      .filter(Boolean),
  );

  const { data: teamsData } = useGetTeams(
    {
      clubId: userData?.club?.documentId,
      pageSize: 100,
    },
    {
      enabled: Boolean(userData?.club?.documentId && trainedTeamIds.size > 0),
    },
  );

  const fetchedTeams = teamsData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];
  const fallbackTeams = Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : [];
  const myTeams = fetchedTeams.length > 0
    ? fetchedTeams.filter((team) => (
      trainedTeamIds.has(team?.documentId)
      || team?.trainers?.some((trainer) => trainer?.documentId === userData?.documentId)
    ))
    : fallbackTeams;
  const orderedTeams = useMemo(() => sortTeamsForDisplay(myTeams), [myTeams]);

  const normalizeSearchText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const filteredTeams = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return orderedTeams;

    return orderedTeams.filter((team) => {
      const searchableParts = [
        team?.name,
        team?.club?.name,
        team?.section?.name,
        team?.category?.name || team?.category,
        team?.level?.name || team?.level,
        ...(Array.isArray(team?.activities) ? team.activities.map((activity) => activity?.name) : []),
      ];

      return searchableParts
        .map((part) => normalizeSearchText(part))
        .some((part) => part.includes(normalizedQuery));
    });
  }, [orderedTeams, searchQuery]);
  const hasTeams = orderedTeams.length > 0;
  const hasFilteredTeams = filteredTeams.length > 0;

  const handleSelectTeam = (team) => {
    dispatch({ payload: team, type: 'SET_TEAM' });
    navigation.navigate(RouteNames.EventWizardInvites);
  };

  const renderTeamCard = (team) => (
    <EventWizardTeamCard
      key={team.documentId}
      onPress={() => handleSelectTeam(team)}
      team={team}
    />
  );

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      stepCount={10}
      stepIndex={2}
      subtitle={t('eventWizard.steps.team.subtitle')}
      title={t('eventWizard.steps.team.title')}
    >
      <View style={[Spaces.gap[16]]}>
        {hasTeams ? (
          <Input
            density="compact"
            icon="search"
            onChangeText={setSearchQuery}
            placeholder={t('teamList.searchPlaceholder', 'Rechercher une équipe')}
            value={searchQuery}
          />
        ) : null}

        {!hasTeams ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {t('eventWizard.errors.noTeams')}
            </Text>
          </View>
        ) : null}

        {hasTeams && !hasFilteredTeams ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {t('teamList.noSearchResult', 'Aucune équipe trouvée pour cette recherche')}
            </Text>
          </View>
        ) : null}

        {hasFilteredTeams ? filteredTeams.map(renderTeamCard) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardTeam;
