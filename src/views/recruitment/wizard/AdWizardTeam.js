import { useIsFocused } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { getTeamById } from '@/services/team/teamService';

import { useAdWizard } from './AdWizardContext';

const getTeamKey = (team) => String(team?.documentId || team?.id || '').trim();

const getEntityLabel = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value?.name || value?.label || '').trim();
  }
  return '';
};

const normalizeComparableText = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const formatSectionLabel = (value) => {
  const normalized = normalizeComparableText(value);
  if (!normalized) return '';
  if (['homme', 'male', 'masculin', 'masculine'].includes(normalized)) return 'Masculin';
  if (['female', 'feminin', 'feminine', 'femme'].includes(normalized)) return 'Féminin';
  if (['mixed', 'mixte'].includes(normalized)) return 'Mixte';
  return String(value || '').trim();
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
    normalizeComparableText(formatSectionLabel(getEntityLabel(team?.section))),
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

    const existingIndex = identityKeys.reduce((foundIndex, identityKey) => (
      foundIndex !== null ? foundIndex : (teamIndexesByKey.has(identityKey) ? teamIndexesByKey.get(identityKey) : null)
    ), null);

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
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function AdWizardTeam({ navigation, route }) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const { dispatch, state } = useAdWizard();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [loadingTeamId, setLoadingTeamId] = useState(null);

  // Handle pre-passed event (e.g. from EventDetails)
  const handleSelectTeam = useCallback(async (team) => {
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
  }, [dispatch, isFocused, navigation]);

  useEffect(() => {
    if (route.params?.event && !state.event && !loading && isFocused) {
      console.log('[AdWizardTeam] Pre-selecting event:', route.params.event.documentId);
      dispatch({ payload: route.params.event, type: 'SET_EVENT' });
      if (route.params.event.team) {
        handleSelectTeam(route.params.event.team);
      }
    }
  }, [dispatch, handleSelectTeam, isFocused, loading, route.params?.event, state.event]);

  // Get user's teams (both myTeams and trainedTeams for coaches)
  const userTeams = useMemo(() => dedupeTeams([
    ...(userData?.myTeams || []),
    ...(userData?.trainedTeams || []),
  ]), [userData?.myTeams, userData?.trainedTeams]);

  // If user has only one team, auto-select and navigate
  useEffect(() => {
    // CRITICAL FIX: Only auto-select if we are the active screen.
    // When AdWizardRecap resets the state, state.team becomes null.
    // If we are in the stack (background), we must NOT react to this and re-navigate.
    if (isFocused && userTeams.length === 1 && !state.team && !loading) {
      handleSelectTeam(userTeams[0]);
    }
  }, [handleSelectTeam, isFocused, loading, state.team, userTeams]);

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
          const teamKey = getTeamKey(team) || `${team.name}-${team.club?.name || 'team'}`;

          const clubName = team.club?.name || '';
          const clubLogo = team.club?.logo?.url;
          const sectionLabel = formatSectionLabel(getEntityLabel(team.section));
          const categoryLabel = getEntityLabel(team.category);
          const levelLabel = getEntityLabel(team.level);
          const sportLabel = getEntityLabel(team.activities?.[0]?.name);
          const teamMetaBadges = [
            categoryLabel,
            levelLabel,
            sportLabel,
          ].filter(Boolean);

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={loading}
              key={teamKey}
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
                    variant="logo"
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

                {sectionLabel ? (
                  <Text style={[Fonts.p2Bold, {
                    color: isSelected ? Colors.primary300 || Colors.primary500 : Colors.neutral100,
                    marginBottom: clubName ? 2 : 0,
                  }]}
                  >
                    {sectionLabel}
                  </Text>
                ) : null}

                {clubName && (
                  <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                    {clubName}
                  </Text>
                )}

                {teamMetaBadges.length > 0 && (
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                  }}
                  >
                    {teamMetaBadges.map((badgeLabel) => (
                      <View
                        key={`${teamKey}-${badgeLabel}`}
                        style={{
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
                          {badgeLabel}
                        </Text>
                      </View>
                    ))}
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
