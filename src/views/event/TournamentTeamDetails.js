import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTournamentTeam } from '@/services/tournamentTeam/tournamentTeamQueries';
import {
  addTournamentTeamMember,
  removeTournamentTeamMember,
  respondToTournamentTeam,
  transferTournamentTeamCaptain,
} from '@/services/tournamentTeam/tournamentTeamService';
import { searchScopedUsers } from '@/services/user/userService';

const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getStatusMeta = (status, colors) => {
  const normalized = normalizeText(status);
  if (normalized === 'accepted' || normalized === 'present') {
    return { label: 'Valide', textColor: colors.success500 };
  }
  if (normalized === 'absent' || normalized === 'declined') {
    return { label: 'Absent', textColor: colors.error500 };
  }
  if (normalized === 'pending') {
    return { label: 'En attente', textColor: colors.warning500 };
  }
  if (normalized === 'removed') {
    return { label: 'Retire', textColor: colors.neutral300 };
  }
  return { label: 'Equipe', textColor: colors.primary500 };
};

/**
 * Detail d'une equipe ephemere de tournoi.
 */
function TournamentTeamDetails({ navigation, route }) {
  const { eventId, teamId } = route?.params || {};
  const queryClient = useQueryClient();
  const { userData } = useAuth();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const {
    data: team,
    error,
    isLoading,
    refetch,
  } = useGetTournamentTeam(teamId);

  const currentUserDocumentId = userData?.documentId || '';
  const members = useMemo(
    () => (Array.isArray(team?.members) ? team.members : [])
      .filter((member) => normalizeText(member?.responseStatus) !== 'removed'),
    [team?.members],
  );
  const currentMember = useMemo(
    () => members.find((member) => member?.user?.documentId === currentUserDocumentId) || null,
    [currentUserDocumentId, members],
  );
  const canManageTeam = Boolean(
    team?.captainUser?.documentId === currentUserDocumentId
    || (team?.adminUsers || []).some((user) => user?.documentId === currentUserDocumentId),
  );
  const activeMemberUserIds = useMemo(
    () => new Set(
      members
        .filter((member) => !['declined', 'removed'].includes(normalizeText(member?.responseStatus)))
        .map((member) => member?.user?.documentId)
        .filter(Boolean),
    ),
    [members],
  );
  const sourceTeamEligibleUsers = useMemo(
    () => (Array.isArray(team?.sourceTeam?.players) ? team.sourceTeam.players : [])
      .filter((player) => player?.documentId && !activeMemberUserIds.has(player.documentId)),
    [activeMemberUserIds, team?.sourceTeam?.players],
  );
  const eligibleScopeClubId = team?.event?.club?.documentId || team?.club?.documentId || '';

  const {
    data: scopedSearchUsers = [],
    isFetching: isFetchingScopedUsers,
  } = useQuery({
    enabled: Boolean(
      canManageTeam
      && isAddMemberOpen
      && eligibleScopeClubId
      && String(memberSearchQuery || '').trim().length >= 2,
    ),
    queryFn: () => searchScopedUsers({
      clubId: eligibleScopeClubId,
      limit: 20,
      query: memberSearchQuery,
    }),
    queryKey: ['tournament-team-users', teamId, eligibleScopeClubId, memberSearchQuery],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['tournamentTeam', teamId] });
  };

  const respondMutation = useMutation({
    mutationFn: (responseStatus) => respondToTournamentTeam(teamId, responseStatus),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre a jour votre reponse.');
    },
    onSuccess: invalidate,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => removeTournamentTeamMember(teamId, memberId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de retirer ce membre.');
    },
    onSuccess: invalidate,
  });

  const transferCaptainMutation = useMutation({
    mutationFn: (memberId) => transferTournamentTeamCaptain(teamId, memberId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de transferer le capitanat.');
    },
    onSuccess: invalidate,
  });
  const addMemberMutation = useMutation({
    mutationFn: (userDocumentId) => addTournamentTeamMember(teamId, userDocumentId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d ajouter ce joueur.');
    },
    onSuccess: () => {
      setMemberSearchQuery('');
      invalidate();
    },
  });

  const handleRemoveMember = (memberId) => {
    Alert.alert(
      'Retirer ce membre',
      'Cette action ne retire le joueur que de cette equipe de tournoi.',
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => removeMemberMutation.mutate(memberId), style: 'destructive', text: 'Retirer' },
      ],
    );
  };

  const handleTransferCaptain = (memberId) => {
    Alert.alert(
      'Nommer capitaine',
      'Le nouveau capitaine gerera cette equipe ephemere dans le cadre du tournoi uniquement.',
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => transferCaptainMutation.mutate(memberId), text: 'Confirmer' },
      ],
    );
  };

  const candidateUsers = useMemo(() => {
    const baseUsers = String(memberSearchQuery || '').trim().length >= 2
      ? scopedSearchUsers
      : sourceTeamEligibleUsers;

    return (Array.isArray(baseUsers) ? baseUsers : [])
      .filter((user) => user?.documentId && !activeMemberUserIds.has(user.documentId))
      .slice(0, 12);
  }, [activeMemberUserIds, memberSearchQuery, scopedSearchUsers, sourceTeamEligibleUsers]);

  const handleAddMember = (userDocumentId) => {
    addMemberMutation.mutate(userDocumentId);
  };

  const renderMember = (member) => {
    const memberStatus = getStatusMeta(member?.responseStatus, Colors);
    const isCaptain = normalizeText(member?.role) === 'captain';

    return (
      <View
        key={member?.documentId || member?.user?.documentId}
        style={[
          ApplicationStyle.backgroundColor.primary900,
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.padding[12],
          Spaces.gap[10],
          {
            borderColor: `${Colors.primary500}33`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
            <ProfileAvatar imageUrl={member?.user?.avatar?.url} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {[member?.user?.firstname, member?.user?.lastname].filter(Boolean).join(' ') || 'Participant'}
              </Text>
              <Text style={[Fonts.p4, { color: memberStatus.textColor }]}>
                {isCaptain ? 'Capitaine' : memberStatus.label}
              </Text>
            </View>
          </View>
        </View>

        {canManageTeam ? (
          <View style={[Alignments.row, Spaces.gap[10]]}>
            {!isCaptain ? (
              <Button
                onPress={() => handleTransferCaptain(member.documentId)}
                size="sm"
                title="Capitaine"
                variant="Secondary"
              />
            ) : null}
            {!isCaptain ? (
              <Button
                onPress={() => handleRemoveMember(member.documentId)}
                size="sm"
                style={{ borderColor: `${Colors.error500}55` }}
                textStyle={{ color: Colors.error500 }}
                title="Retirer"
                variant="SecondaryLight"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[24], Spaces.paddingBottom[12]]}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
      </View>
      <WithDataWrapper data={team} error={error} isLoading={isLoading} onRetry={refetch}>
        <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[40], Spaces.gap[20]]}>
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>{team?.name || 'Equipe tournoi'}</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {team?.sourceType === 'club_team'
                ? `Equipe tournoi derivee de ${team?.sourceTeam?.name || 'l equipe club'}`
                : 'Equipe ephemere creee pour ce tournoi'}
            </Text>
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary800,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[20],
              Spaces.gap[16],
              {
                borderColor: `${Colors.primary500}44`,
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Statut</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {getStatusMeta(team?.status, Colors).label}
                </Text>
              </View>
              {team?.captainUser ? (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <ProfileAvatar imageUrl={team?.captainUser?.avatar?.url} size={36} />
                  <Text style={[Fonts.p4, Fonts.neutral100]}>
                    {[team?.captainUser?.firstname, team?.captainUser?.lastname].filter(Boolean).join(' ') || 'Capitaine'}
                  </Text>
                </View>
              ) : null}
            </View>

            {currentMember ? (
              <View style={[Spaces.gap[10]]}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Ma reponse</Text>
                <View style={[Alignments.row, Spaces.gap[10]]}>
                  <Button
                    disabled={respondMutation.isPending}
                    onPress={() => respondMutation.mutate('present')}
                    size="sm"
                    title="Present"
                    variant={normalizeText(currentMember?.responseStatus) === 'present' ? 'Primary' : 'Secondary'}
                  />
                  <Button
                    disabled={respondMutation.isPending}
                    onPress={() => respondMutation.mutate('absent')}
                    size="sm"
                    style={normalizeText(currentMember?.responseStatus) === 'absent'
                      ? { backgroundColor: `${Colors.error500}12`, borderColor: `${Colors.error500}55` }
                      : { borderColor: `${Colors.error500}55` }}
                    textStyle={{ color: Colors.error500 }}
                    title="Absent"
                    variant="SecondaryLight"
                  />
                </View>
              </View>
            ) : null}
          </View>

          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Effectif tournoi</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              Cette composition reste limitee a ce tournoi. Elle ne modifie jamais l equipe club permanente.
            </Text>

            {canManageTeam ? (
              <View
                style={[
                  ApplicationStyle.backgroundColor.primary900,
                  ApplicationStyle.borderRadius24,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  {
                    borderColor: `${Colors.primary500}33`,
                  },
                ]}
              >
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Ajuster l effectif tournoi</Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      Ajoute ou remets un joueur dans cette equipe sans toucher a l equipe club de base.
                    </Text>
                  </View>
                  <Button
                    onPress={() => setIsAddMemberOpen((current) => !current)}
                    size="sm"
                    title={isAddMemberOpen ? 'Fermer' : 'Ajouter'}
                    variant="Secondary"
                  />
                </View>

                {isAddMemberOpen ? (
                  <View style={[Spaces.gap[12]]}>
                    <TextInput
                      onChangeText={setMemberSearchQuery}
                      placeholder={team?.sourceType === 'club_team'
                        ? 'Rechercher un joueur du club ou reprendre un joueur de l equipe source'
                        : 'Rechercher un joueur du club'}
                      placeholderTextColor={Colors.neutral500}
                      style={[
                        ApplicationStyle.card,
                        Spaces.paddingHorizontal[16],
                        Spaces.paddingVertical[12],
                        Fonts.p2,
                        {
                          backgroundColor: 'rgba(1, 179, 244, 0.08)',
                          borderColor: 'rgba(1, 179, 244, 0.26)',
                          color: Colors.neutral00,
                        },
                      ]}
                      value={memberSearchQuery}
                    />

                    {isFetchingScopedUsers ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>Recherche en cours...</Text>
                    ) : null}

                    {candidateUsers.length === 0 ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {String(memberSearchQuery || '').trim().length >= 2
                          ? 'Aucun profil disponible pour cette recherche.'
                          : 'Aucun autre joueur disponible a ajouter pour le moment.'}
                      </Text>
                    ) : (
                      candidateUsers.map((user) => (
                        <View
                          key={user?.documentId}
                          style={[
                            ApplicationStyle.backgroundColor.primary800,
                            ApplicationStyle.borderRadius16,
                            ApplicationStyle.borderWidth1,
                            Spaces.padding[12],
                            {
                              borderColor: `${Colors.primary500}22`,
                            },
                          ]}
                        >
                          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10], { flex: 1 }]}>
                              <ProfileAvatar imageUrl={user?.avatar?.url} size={38} />
                              <View style={{ flex: 1 }}>
                                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                                  {[user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.username || 'Participant'}
                                </Text>
                                <Text style={[Fonts.p4, Fonts.neutral200]}>
                                  {user?.club?.name || 'Profil FoundClub'}
                                </Text>
                              </View>
                            </View>
                            <Button
                              disabled={addMemberMutation.isPending}
                              onPress={() => handleAddMember(user?.documentId)}
                              size="sm"
                              title="Ajouter"
                              variant="Primary"
                            />
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {members.map(renderMember)}
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.EventDetails, { eventId })}
            style={[
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[14],
              {
                borderColor: `${Colors.primary500}44`,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>Revenir au tournoi</Text>
          </TouchableOpacity>
        </ScrollView>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentTeamDetails;
