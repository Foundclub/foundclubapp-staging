import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useAdWizard } from './AdWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { getTeamById } from '@/services/team/teamService';
import { getImageUrl } from '@/utils/imageUrl';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { useIsFocused } from '@react-navigation/native';

const AdWizardTeam = ({ navigation, route }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useAdWizard();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const isFocused = useIsFocused();
  
  const [loading, setLoading] = useState(false);
  const [loadingTeamId, setLoadingTeamId] = useState(null);

  // Handle pre-passed event (e.g. from EventDetails)
  useEffect(() => {
    if (route.params?.event && !state.event && !loading && isFocused) {
      console.log('[AdWizardTeam] Pre-selecting event:', route.params.event.documentId);
      dispatch({ type: 'SET_EVENT', payload: route.params.event });
      if (route.params.event.team) {
        handleSelectTeam(route.params.event.team);
      }
    }
  }, [route.params?.event, isFocused]);

  // Get user's teams (both myTeams and trainedTeams for coaches)
  const userTeams = [
    ...(userData?.myTeams || []),
    ...(userData?.trainedTeams || []),
  ];

  // Fetch complete team data and navigate
  const handleSelectTeam = async (team) => {
    try {
      setLoading(true);
      setLoadingTeamId(team.documentId);
      
      // Fetch complete team data with all relations populated
      const fullTeam = await getTeamById(team.documentId);
      
      console.log('[AdWizardTeam] Full team data:', fullTeam);
      
      dispatch({ type: 'SET_TEAM', payload: fullTeam });
      navigation.navigate(RouteNames.AdWizardInfo);
    } catch (error) {
      console.error('[AdWizardTeam] Error fetching team:', error);
      // Fall back to using partial data if fetch fails
      dispatch({ type: 'SET_TEAM', payload: team });
      navigation.navigate(RouteNames.AdWizardInfo);
    } finally {
      if (isFocused) {
          setLoading(false);
          setLoadingTeamId(null);
      }
    }
  };

  // If user has only one team, auto-select and navigate
  useEffect(() => {
    // CRITICAL FIX: Only auto-select if we are the active screen.
    // When AdWizardRecap resets the state, state.team becomes null. 
    // If we are in the stack (background), we must NOT react to this and re-navigate.
    if (isFocused && userTeams.length === 1 && !state.team && !loading) {
      handleSelectTeam(userTeams[0]);
    }
  }, [userTeams, state.team, loading, isFocused]);

  // No teams state
  if (userTeams.length === 0) {
    return (
      <WizardStepLayout
        title="Créer une annonce"
        subtitle="Vous n'avez pas d'équipe associée"
        onBack={() => navigation.goBack()}
      >
        <View style={[
          Spaces.padding[24],
          {
            backgroundColor: Colors.neutral800,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: Colors.neutral700,
          }
        ]}>
          <Text style={[Fonts.p1, { color: Colors.neutral200, textAlign: 'center' }]}>
            Vous devez être associé à une équipe pour créer une annonce de recrutement.
          </Text>
        </View>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      title="Pour quelle équipe ?"
      subtitle="Sélectionnez l'équipe qui recrute"
      onBack={() => navigation.goBack()}
    >
      <View style={[Spaces.gap[16]]}>
        {userTeams.map((team) => {
          const isSelected = state.team?.documentId === team.documentId;
          const isLoading = loadingTeamId === team.documentId;
          
          const clubName = team.club?.name || '';
          const clubLogo = team.club?.logo?.url;
          
          return (
            <TouchableOpacity
              key={team.documentId || team.id}
              onPress={() => handleSelectTeam(team)}
              disabled={loading}
              activeOpacity={0.8}
              style={[
                Spaces.padding[16],
                {
                  backgroundColor: isSelected ? Colors.primary900 : Colors.neutral800,
                  borderRadius: 20,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  opacity: loading && !isLoading ? 0.5 : 1,
                  // Shadow for depth
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }
              ]}
            >
              {/* Left: Club Logo/Shield */}
              <View>
                {clubLogo ? (
                    <ProfileAvatar
                        imageUrl={clubLogo}
                        size={56}
                        style={{ borderRadius: 28 }}
                        imageStyle={{ borderRadius: 28 }}
                    />
                ) : (
                    <TeamShield
                        initials={clubName ? getClubInitials(clubName) : ''}
                        size={56}
                    />
                )}
              </View>

              {/* Center: Team Info */}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={[Fonts.h4, { color: Colors.neutral00, marginBottom: 4 }]}>
                  {team.name}
                </Text>
                
                {clubName && (
                  <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                    {clubName}
                  </Text>
                )}

                {/* Sport badge */}
                {(team.activities?.[0]?.name) && (
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <View style={{
                        backgroundColor: isSelected ? Colors.primary500 : Colors.neutral700,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                    }}>
                        <Text style={[Fonts.p3Bold, { 
                            color: isSelected ? Colors.neutral900 : Colors.neutral200,
                            fontSize: 10,
                            textTransform: 'uppercase'
                        }]}>
                        {team.activities?.[0]?.name}
                        </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Right: Selection Indicator */}
              <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.05)',
                  justifyContent: 'center',
                  alignItems: 'center',
              }}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={isSelected ? Colors.neutral900 : Colors.neutral00} />
                ) : (
                  <Text style={{ 
                      color: isSelected ? Colors.neutral900 : Colors.neutral400, 
                      fontSize: 14,
                      fontWeight: 'bold'
                  }}>
                    {isSelected ? '✓' : '→'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Teams count info */}
      <View style={[Spaces.marginTop[24]]}>
        <Text style={[Fonts.p2, { color: Colors.neutral400, textAlign: 'center' }]}>
          {userTeams.length} équipe{userTeams.length > 1 ? 's' : ''} disponible{userTeams.length > 1 ? 's' : ''}
        </Text>
      </View>
    </WizardStepLayout>
  );
};

export default AdWizardTeam;
