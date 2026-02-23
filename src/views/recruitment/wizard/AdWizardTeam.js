import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Image, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { getTeamById } from '@/services/team/teamService';

import { getImageUrl } from '@/utils/imageUrl';

import { useAdWizard } from './AdWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function AdWizardTeam({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useAdWizard();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [loadingTeamId, setLoadingTeamId] = useState(null);

  // Handle pre-passed event (e.g. from EventDetails)
  useEffect(() => {
    if (route.params?.event && !state.event && !loading && isFocused) {
      console.log('[AdWizardTeam] Pre-selecting event:', route.params.event.documentId);
      dispatch({ payload: route.params.event, type: 'SET_EVENT' });
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

      dispatch({ payload: fullTeam, type: 'SET_TEAM' });
      navigation.navigate(RouteNames.AdWizardInfo);
    } catch (error) {
      console.error('[AdWizardTeam] Error fetching team:', error);
      // Fall back to using partial data if fetch fails
      dispatch({ payload: team, type: 'SET_TEAM' });
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
        onBack={() => navigation.goBack()}
        subtitle="Vous n'avez pas d'équipe associée"
        title="Créer une annonce"
      >
        <View style={[
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
      subtitle="Sélectionnez l'équipe qui recrute"
      title="Pour quelle équipe ?"
    >
      <View style={[Spaces.gap[16]]}>
        {userTeams.map((team) => {
          const isSelected = state.team?.documentId === team.documentId;
          const isLoading = loadingTeamId === team.documentId;

          const clubName = team.club?.name || '';
          const clubLogo = team.club?.logo?.url;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={loading}
              key={team.documentId || team.id}
              onPress={() => handleSelectTeam(team)}
              style={[
                Spaces.padding[16],
                {
                  alignItems: 'center',
                  backgroundColor: isSelected ? Colors.primary900 : Colors.neutral800,
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                  borderRadius: 20,
                  borderWidth: isSelected ? 2 : 1,
                  flexDirection: 'row',
                  gap: 16,
                  opacity: loading && !isLoading ? 0.5 : 1,
                  // Shadow for depth
                  elevation: 3,
                  shadowColor: '#000',
                  shadowOffset: { height: 2, width: 0 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                },
              ]}
            >
              {/* Left: Club Logo/Shield */}
              <View>
                {clubLogo ? (
                  <ProfileAvatar
                    imageStyle={{ borderRadius: 28 }}
                    imageUrl={clubLogo}
                    size={56}
                    style={{ borderRadius: 28 }}
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
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                    >
                      <Text style={[Fonts.p3Bold, {
                        color: isSelected ? Colors.neutral900 : Colors.neutral200,
                        fontSize: 10,
                        textTransform: 'uppercase',
                      }]}
                      >
                        {team.activities?.[0]?.name}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Right: Selection Indicator */}
              <View style={{
                alignItems: 'center',
                backgroundColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.05)',
                borderRadius: 16,
                height: 32,
                justifyContent: 'center',
                width: 32,
              }}
              >
                {isLoading ? (
                  <ActivityIndicator color={isSelected ? Colors.neutral900 : Colors.neutral00} size="small" />
                ) : (
                  <Text style={{
                    color: isSelected ? Colors.neutral900 : Colors.neutral400,
                    fontSize: 14,
                    fontWeight: 'bold',
                  }}
                  >
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
