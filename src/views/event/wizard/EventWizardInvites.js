import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { getTeams } from '@/services/team/teamService';

import { useEventWizard } from './EventWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardInvites({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch, state } = useEventWizard();
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };
  const selectedSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.16)',
    borderColor: Colors.primary500,
    borderWidth: 1,
  };

  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState(state.invitedTeams || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchError, setHasFetchError] = useState(false);

  const selectedOrganizerTeamId = state.team?.documentId;
  const clubId = state.team?.club?.documentId || userData?.club?.documentId;

  useEffect(() => {
    setSelectedTeams(state.invitedTeams || []);
  }, [state.invitedTeams]);

  useEffect(() => {
    const fetchClubTeams = async () => {
      if (!clubId) {
        setAvailableTeams([]);
        return;
      }

      setIsLoading(true);
      setHasFetchError(false);
      try {
        const response = await getTeams({ clubId, pageSize: 100 });
        const allTeams = Array.isArray(response?.data) ? response.data : [];
        const inviteable = allTeams.filter((team) => team.documentId !== selectedOrganizerTeamId);
        setAvailableTeams(inviteable);
      } catch (error) {
        setHasFetchError(true);
        setAvailableTeams([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClubTeams();
  }, [clubId, selectedOrganizerTeamId]);

  const teamsByOwnership = useMemo(() => {
    const myTeamIds = new Set((userData?.trainedTeams || []).map((team) => team.documentId));
    const myTeams = [];
    const otherTeams = [];

    availableTeams.forEach((team) => {
      if (myTeamIds.has(team.documentId)) {
        myTeams.push(team);
      } else {
        otherTeams.push(team);
      }
    });

    return { myTeams, otherTeams };
  }, [availableTeams, userData?.trainedTeams]);

  const toggleTeam = (teamId) => {
    setSelectedTeams((current) => (
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    ));
  };

  const handleNext = () => {
    dispatch({ payload: selectedTeams, type: 'SET_INVITES' });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  const handleSkip = () => {
    dispatch({ payload: [], type: 'SET_INVITES' });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  const renderTeamCard = (team) => {
    const isSelected = selectedTeams.includes(team.documentId);
    return (
      <TouchableOpacity
        key={team.documentId}
        onPress={() => toggleTeam(team.documentId)}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          {
            ...(isSelected ? selectedSurfaceStyle : cardSurfaceStyle),
          },
        ]}
      >
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={[Fonts.h4, isSelected ? Fonts.primary100 : Fonts.neutral00]}>{team.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {team.category?.name || '-'}
            {' - '}
            {team.level?.name || '-'}
          </Text>
        </View>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: isSelected ? Colors.primary500 : 'transparent',
            borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.42)',
            borderRadius: 12,
            borderWidth: 1.5,
            height: 24,
            justifyContent: 'center',
            width: 24,
          }}
        >
          {isSelected ? (
            <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>OK</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleSkip}
      showSkip
      stepCount={10}
      stepIndex={3}
      subtitle={t('eventWizard.steps.invites.subtitle')}
      title={t('eventWizard.steps.invites.title')}
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.primary500} size="large" />
      ) : null}

      {!isLoading && hasFetchError ? (
        <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
          <Text style={[Fonts.p1, Fonts.neutral100]}>
            {t('eventWizard.errors.invitesFetch')}
          </Text>
        </View>
      ) : null}

      {!isLoading && !hasFetchError && availableTeams.length === 0 ? (
        <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
          <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
            {t('eventWizard.errors.noOtherTeams')}
          </Text>
        </View>
      ) : null}

      {!isLoading && !hasFetchError && availableTeams.length > 0 ? (
        <View style={[Spaces.gap[16]]}>
          {teamsByOwnership.myTeams.length > 0 ? (
            <>
              <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                {t('eventWizard.steps.invites.myTeams')}
              </Text>
              <View style={[Spaces.gap[12]]}>
                {teamsByOwnership.myTeams.map(renderTeamCard)}
              </View>
            </>
          ) : null}

          {teamsByOwnership.otherTeams.length > 0 ? (
            <>
              <Text style={[Fonts.p3Bold, Fonts.neutral200, Spaces.marginTop[8]]}>
                {t('eventWizard.steps.invites.otherTeams')}
              </Text>
              <View style={[Spaces.gap[12]]}>
                {teamsByOwnership.otherTeams.map(renderTeamCard)}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </WizardStepLayout>
  );
}

export default EventWizardInvites;
