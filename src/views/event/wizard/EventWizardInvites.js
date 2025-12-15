
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { getTeams } from '@/services/team/teamService';
import Checkbox from '@/components/atoms/checkbox/Checkbox'; // Assuming Checkbox component exists or using alternative

const EventWizardInvites = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { state, dispatch } = useEventWizard();
  
  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Derived logic from EventEdit.js
  const selectedOrganizerTeamId = state.team?.documentId;
  const clubId = state.team?.club?.documentId || userData?.club?.documentId;
  const myTeamIds = userData?.trainedTeams?.map(t => t.documentId) || [];

  useEffect(() => {
    const fetchClubTeams = async () => {
      if (clubId) {
        setIsLoading(true);
        try {
          const response = await getTeams({ clubId, pageSize: 100 });
          // Filter: Exclude the organizer team and explicitly "my teams" if deemed redundant, 
          // but user might want to invite their OTHER teams.
          // EventEdit logic: 
          // - myTeamsOptions = teamOptions.filter(t => t.value !== selectedTeamId);
          // - otherTeamsOptions = clubTeams.filter(t => !myTeamIds.includes(t.documentId) && t.documentId !== selectedTeamId)
          
          // Let's combine all invite-able teams
          const allTeams = response.data || [];
          const inviteable = allTeams.filter(t => t.documentId !== selectedOrganizerTeamId);
          setAvailableTeams(inviteable);
        } catch (error) {
          console.error('Failed to fetch club teams', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchClubTeams();
  }, [clubId, selectedOrganizerTeamId]);

  const toggleTeam = (teamId) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) return prev.filter(id => id !== teamId);
      return [...prev, teamId];
    });
  };

  const handleNext = () => {
    dispatch({ type: 'SET_INVITES', payload: selectedTeams });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  const handleSkip = () => {
    dispatch({ type: 'SET_INVITES', payload: [] });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.invites.title', 'Inviter d\'autres équipes ?')}
      subtitle={t('eventWizard.steps.invites.subtitle', 'Cochez les équipes qui participeront aussi.')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      showSkip={true}
      onSkip={handleSkip}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary500} />
      ) : availableTeams.length === 0 ? (
        <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
           {t('eventWizard.errors.noOtherTeams', 'Aucune autre équipe disponible dans le club.')}
        </Text>
      ) : (
        <View style={[Spaces.gap[12]]}>
          {availableTeams.map((team) => {
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
                    backgroundColor: isSelected ? Colors.primary900 : Colors.neutral800,
                    borderColor: isSelected ? Colors.primary500 : 'transparent',
                    borderWidth: 1
                  }
                ]}
              >
                <View>
                  <Text style={[Fonts.h4, isSelected ? Fonts.primary100 : Fonts.neutral00]}>{team.name}</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{team.category?.name}</Text>
                </View>
                {/* Visual Checkbox */}
                <View style={{
                  width: 24, height: 24, borderRadius: 12, borderWidth: 2, 
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral200,
                  backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  {isSelected && <Text style={{color: Colors.neutral900, fontSize: 16}}>✓</Text>}
                </View>
              </TouchableOpacity>
             );
          })}
        </View>
      )}
    </WizardStepLayout>
  );
};

export default EventWizardInvites;
