import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardTeam({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch } = useEventWizard();
  const { getClubInitials } = useClub();
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const myTeams = Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : [];

  const handleSelectTeam = (team) => {
    dispatch({ payload: team, type: 'SET_TEAM' });
    navigation.navigate(RouteNames.EventWizardInvites);
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      stepCount={10}
      stepIndex={2}
      subtitle={t('eventWizard.steps.team.subtitle')}
      title={t('eventWizard.steps.team.title')}
    >
      <View style={[Spaces.gap[16]]}>
        {myTeams.length === 0 ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {t('eventWizard.errors.noTeams')}
            </Text>
          </View>
        ) : null}

        {myTeams.map((team) => (
          <TouchableOpacity
            key={team.documentId}
            onPress={() => handleSelectTeam(team)}
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Alignments.row,
              Alignments.alignCenter,
              cardSurfaceStyle,
            ]}
          >
            {team.club?.logo?.url ? (
              <ProfileAvatar
                imageUrl={team.club.logo.url}
                size={50}
                style={{ marginRight: 16 }}
              />
            ) : (
              <TeamShield
                initials={getClubInitials(team.club?.name || '')}
                size={50}
                style={{ marginRight: 16 }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>{team.name}</Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {team.category?.name || '-'}
                {' - '}
                {team.level?.name || '-'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardTeam;
