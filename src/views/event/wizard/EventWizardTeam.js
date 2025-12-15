
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import useClub from '@/domains/club/useClub';

const EventWizardTeam = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch } = useEventWizard();
  const { getClubInitials } = useClub();

  const myTeams = userData?.trainedTeams || [];

  const handleSelectTeam = (team) => {
    dispatch({ type: 'SET_TEAM', payload: team });
    navigation.navigate(RouteNames.EventWizardInvites);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.team.title', 'Pour quelle équipe ?')}
      subtitle={t('eventWizard.steps.team.subtitle', 'Sélectionnez l\'équipe organisatrice.')}
      onBack={() => navigation.goBack()}
    >
      <View style={[Spaces.gap[16]]}>
        {myTeams.length === 0 ? (
          <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
             {t('eventWizard.errors.noTeams', 'Vous n\'avez aucune équipe assignée.')}
          </Text>
        ) : (
          myTeams.map((team) => (
            <TouchableOpacity
              key={team.documentId}
              onPress={() => handleSelectTeam(team)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Alignments.row,
                Alignments.alignCenter,
                { backgroundColor: Colors.neutral800 }
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
              <View>
                <Text style={[Fonts.h3, Fonts.neutral00]}>{team.name}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>{team.category?.name} - {team.level?.name}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardTeam;
