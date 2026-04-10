import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Tag from '@/components/atoms/tag/Tag';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTournamentTeam } from '@/services/tournamentTeam/tournamentTeamQueries';
import {
  inviteTournamentTeamMember,
  leaveTournamentTeam,
  removeTournamentTeamMember,
  requestJoinTournamentTeam,
  respondToTournamentInvitation,
  respondToTournamentTeam,
  reviewTournamentJoinRequest,
  toggleTournamentTeamOpenRequests,
  transferTournamentTeamCaptain,
} from '@/services/tournamentTeam/tournamentTeamService';
import { searchScopedUsers, searchUsers } from '@/services/user/userService';

import { createTournamentDesignSystem } from './tournamentDesignSystem';
import {
  getTournamentMemberBuckets,
  getTournamentRosterSummary,
  getTournamentTeamStatusMeta,
  isTournamentActiveMemberStatus,
  normalizeTournamentText,
} from './tournamentUtils';

const getMemberStatusMeta = (status, colors) => {
  const normalized = normalizeTournamentText(status);
  if (normalized === 'present') return { label: 'Present', tone: colors.success500 };
  if (normalized === 'absent') return { label: 'Absent', tone: colors.error500 };
  if (normalized === 'pending') return { label: 'En attente', tone: colors.warning500 };
  if (normalized === 'invited') return { label: 'Invitation envoyee', tone: colors.primary500 };
  if (normalized === 'requested') return { label: 'Demande recue', tone: colors.warning500 };
  if (normalized === 'declined') return { label: 'Refuse', tone: colors.error500 };
  return { label: 'Membre', tone: colors.neutral300 };
};

const getOriginLabel = (origin) => {
  const normalized = normalizeTournamentText(origin);
  if (normalized === 'inherited_from_club') return 'Herite de l equipe club';
  if (normalized === 'external_addition') return 'Ajout exceptionnel';
  if (normalized === 'join_request') return 'Demande de rejoindre';
  return 'Invitation tournoi';
};

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function TournamentTeamDetails({ navigation, route }) {
  const { eventId, teamId } = route?.params || {};
  const queryClient = useQueryClient();
  const { userData } = useAuth();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const {
    data: team,
    error,
    isLoading,
    refetch,
  } = useGetTournamentTeam(teamId);

  const currentUserDocumentId = userData?.documentId || '';
  const allMembers = useMemo(
    () => (Array.isArray(team?.members) ? team.members : [])
      .filter((member) => normalizeTournamentText(member?.responseStatus) !== 'removed'),
    [team?.members],
  );
  const memberBuckets = useMemo(() => getTournamentMemberBuckets(allMembers), [allMembers]);
  const {
    activeMembers,
    invitedMembers,
    requestedMembers,
  } = memberBuckets;
  const currentMember = useMemo(
    () => allMembers.find((member) => member?.user?.documentId === currentUserDocumentId) || null,
    [allMembers, currentUserDocumentId],
  );
  const currentMemberStatus = normalizeTournamentText(currentMember?.responseStatus);
  const currentMemberIsCaptain = normalizeTournamentText(currentMember?.role) === 'captain'
    || team?.captainUser?.documentId === currentUserDocumentId;
  const canManageTeam = Boolean(
    team?.captainUser?.documentId === currentUserDocumentId
    || (team?.adminUsers || []).some((user) => user?.documentId === currentUserDocumentId),
  );
  const teamIsArchived = normalizeTournamentText(team?.status) === 'archived' || Boolean(team?.archivedAt);
  const teamIsClosed = normalizeTournamentText(team?.event?.sessionStatus) === 'closed'
    || team?.event?.isActive === false;
  const teamIsLocked = teamIsArchived || teamIsClosed;
  const canManageRoster = canManageTeam && !teamIsLocked;
  const canLeaveTeam = Boolean(
    currentMember
    && isTournamentActiveMemberStatus(currentMember?.responseStatus)
    && !currentMemberIsCaptain
    && !teamIsLocked,
  );
  const canRequestJoinTeam = Boolean(
    !teamIsLocked
    && normalizeTournamentText(team?.sourceType) === 'custom_team'
    && team?.isOpenToJoinRequests === true
    && !canManageTeam
    && (!currentMember || currentMemberStatus === 'declined'),
  );
  const engagedMemberUserIds = useMemo(
    () => new Set(
      allMembers
        .filter((member) => !['declined', 'removed'].includes(normalizeTournamentText(member?.responseStatus)))
        .map((member) => member?.user?.documentId)
        .filter(Boolean),
    ),
    [allMembers],
  );
  const sourceTeamEligibleUsers = useMemo(
    () => (Array.isArray(team?.sourceTeam?.players) ? team.sourceTeam.players : [])
      .filter((player) => player?.documentId && !engagedMemberUserIds.has(player.documentId)),
    [engagedMemberUserIds, team?.sourceTeam?.players],
  );
  const tournamentConfig = useMemo(
    () => (team?.event?.tournamentConfig && typeof team.event.tournamentConfig === 'object'
      ? team.event.tournamentConfig
      : {}),
    [team?.event?.tournamentConfig],
  );
  const rosterSummary = useMemo(
    () => getTournamentRosterSummary(team, tournamentConfig),
    [team, tournamentConfig],
  );
  const teamStatusMeta = useMemo(
    () => getTournamentTeamStatusMeta(team?.status, Colors),
    [Colors, team?.status],
  );
  const allowCrossClubPlayers = tournamentConfig?.allowCrossClubPlayers === true;
  const eligibleScopeClubId = team?.event?.club?.documentId || team?.club?.documentId || '';
  const searchTerm = String(memberSearchQuery || '').trim();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['tournamentTeam', teamId] }),
    ]);
  };

  const {
    data: scopedSearchUsers = [],
    isFetching: isFetchingScopedUsers,
  } = useQuery({
    enabled: Boolean(
      canManageRoster
      && isInviteOpen
      && !allowCrossClubPlayers
      && eligibleScopeClubId
      && searchTerm.length >= 2,
    ),
    queryFn: () => searchScopedUsers({
      clubId: eligibleScopeClubId,
      limit: 20,
      query: searchTerm,
    }),
    queryKey: ['tournament-team-users', 'scoped', teamId, eligibleScopeClubId, searchTerm],
  });

  const {
    data: globalSearchUsers = [],
    isFetching: isFetchingGlobalUsers,
  } = useQuery({
    enabled: Boolean(
      canManageRoster
      && isInviteOpen
      && allowCrossClubPlayers
      && searchTerm.length >= 2,
    ),
    queryFn: async () => {
      const response = await searchUsers({ pageSize: 20, q: searchTerm });
      if (Array.isArray(response)) return response;
      return Array.isArray(response?.data) ? response.data : [];
    },
    queryKey: ['tournament-team-users', 'global', teamId, searchTerm],
  });

  const respondMutation = useMutation({
    mutationFn: (responseStatus) => respondToTournamentTeam(teamId, responseStatus),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre a jour votre reponse.');
    },
    onSuccess: invalidate,
  });

  const respondInvitationMutation = useMutation({
    mutationFn: (status) => respondToTournamentInvitation(teamId, status),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de repondre a cette invitation.');
    },
    onSuccess: invalidate,
  });

  const requestJoinMutation = useMutation({
    mutationFn: () => requestJoinTournamentTeam(teamId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d envoyer cette demande.');
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

  const inviteMemberMutation = useMutation({
    mutationFn: (userDocumentId) => inviteTournamentTeamMember(teamId, userDocumentId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d inviter ce joueur.');
    },
    onSuccess: async () => {
      setMemberSearchQuery('');
      await invalidate();
    },
  });

  const reviewJoinRequestMutation = useMutation({
    mutationFn: ({ memberId, status }) => reviewTournamentJoinRequest(teamId, memberId, status),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de traiter cette demande.');
    },
    onSuccess: invalidate,
  });

  const toggleOpenRequestsMutation = useMutation({
    mutationFn: (isOpenToJoinRequests) => toggleTournamentTeamOpenRequests(teamId, isOpenToJoinRequests),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre a jour cette option.');
    },
    onSuccess: invalidate,
  });

  const leaveTeamMutation = useMutation({
    mutationFn: () => leaveTournamentTeam(teamId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de quitter cette equipe.');
    },
    onSuccess: async () => {
      await invalidate();
      navigation.navigate(RouteNames.EventDetails, { eventId });
    },
  });

  const candidateUsers = useMemo(() => {
    let baseUsers = sourceTeamEligibleUsers;
    if (searchTerm.length >= 2) {
      baseUsers = allowCrossClubPlayers ? globalSearchUsers : scopedSearchUsers;
    }

    return (Array.isArray(baseUsers) ? baseUsers : [])
      .filter((user) => user?.documentId && !engagedMemberUserIds.has(user.documentId))
      .slice(0, 12);
  }, [
    allowCrossClubPlayers,
    engagedMemberUserIds,
    globalSearchUsers,
    scopedSearchUsers,
    searchTerm,
    sourceTeamEligibleUsers,
  ]);

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
      'Le nouveau capitaine gerera cette equipe ephemere uniquement dans le cadre du tournoi.',
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => transferCaptainMutation.mutate(memberId), text: 'Confirmer' },
      ],
    );
  };

  const handleLeaveTeam = () => {
    Alert.alert(
      'Quitter cette equipe ?',
      'Vous serez retire uniquement de cette equipe de tournoi. Votre equipe club restera intacte.',
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => leaveTeamMutation.mutate(), style: 'destructive', text: 'Quitter' },
      ],
    );
  };

  const handleReviewJoinRequest = (memberId, status) => {
    const actionLabel = status === 'accepted' ? 'accepter' : 'refuser';
    Alert.alert(
      'Demande de rejoindre',
      `Voulez-vous ${actionLabel} cette demande ?`,
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => reviewJoinRequestMutation.mutate({ memberId, status }), text: 'Confirmer' },
      ],
    );
  };

  const addMemberPlaceholder = allowCrossClubPlayers
    ? 'Rechercher un joueur FoundClub'
    : 'Rechercher un joueur du club';

  const renderMemberCard = (member, variant) => {
    const isCaptain = normalizeTournamentText(member?.role) === 'captain';
    const memberStatusMeta = getMemberStatusMeta(member?.responseStatus, Colors);
    const isCurrentUserMember = member?.user?.documentId === currentUserDocumentId;

    return (
      <View
        key={member?.documentId || member?.user?.documentId}
        style={tournamentDs.styles.compactPanelCard}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
            <ProfileAvatar imageUrl={member?.user?.avatar?.url} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {[member?.user?.firstname, member?.user?.lastname].filter(Boolean).join(' ') || 'Participant'}
              </Text>
              <Text style={[Fonts.p4, { color: isCaptain ? Colors.primary500 : memberStatusMeta.tone }]}>
                {isCaptain ? 'Capitaine' : memberStatusMeta.label}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral300]}>{getOriginLabel(member?.origin)}</Text>
            </View>
          </View>
          {isCurrentUserMember ? (
            <Tag
              style={{ backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}33` }}
              text="Moi"
              textColor="primary500"
            />
          ) : null}
        </View>

        {variant === 'active' && canManageRoster && !isCaptain ? (
          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <Button onPress={() => handleTransferCaptain(member.documentId)} size="sm" title="Capitaine" variant="Secondary" />
            <Button
              onPress={() => handleRemoveMember(member.documentId)}
              size="sm"
              style={{ borderColor: `${Colors.error500}55` }}
              textStyle={{ color: Colors.error500 }}
              title="Retirer"
              variant="SecondaryLight"
            />
          </View>
        ) : null}

        {variant === 'invited' && canManageRoster ? (
          <Button
            onPress={() => handleRemoveMember(member.documentId)}
            size="sm"
            style={{ alignSelf: 'flex-start', borderColor: `${Colors.neutral300}55` }}
            textStyle={{ color: Colors.neutral100 }}
            title="Annuler l invitation"
            variant="SecondaryLight"
          />
        ) : null}

        {variant === 'requested' && canManageRoster ? (
          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <Button onPress={() => handleReviewJoinRequest(member.documentId, 'accepted')} size="sm" title="Accepter" variant="Primary" />
            <Button
              onPress={() => handleReviewJoinRequest(member.documentId, 'declined')}
              size="sm"
              style={{ borderColor: `${Colors.error500}55` }}
              textStyle={{ color: Colors.error500 }}
              title="Refuser"
              variant="SecondaryLight"
            />
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
        <ScrollView contentContainerStyle={tournamentDs.styles.screenContent}>
          <View style={tournamentDs.styles.screenIntro}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>{team?.name || 'Equipe tournoi'}</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {team?.sourceType === 'club_team'
                ? `Equipe tournoi derivee de ${team?.sourceTeam?.name || 'l equipe club'}`
                : 'Equipe ephemere creee pour ce tournoi'}
            </Text>
          </View>

          {teamIsLocked ? (
            <View
              style={[
                ...tournamentDs.styles.panelCard,
                { borderColor: teamIsArchived ? `${Colors.neutral300}33` : `${Colors.warning500}33` },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{teamIsArchived ? 'Equipe archivee' : 'Tournoi cloture'}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {teamIsArchived
                  ? 'Cette equipe ephemere est archivee. Le roster reste lisible mais n est plus modifiable.'
                  : 'Le tournoi est ferme. Les modifications d equipe et les nouvelles reponses sont maintenant bloquees.'}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              ...tournamentDs.styles.panelCard,
              Spaces.padding[24],
              Spaces.gap[16],
              { borderColor: tournamentDs.colors.borderStrong },
            ]}
          >
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Statut equipe</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{teamStatusMeta.label}</Text>
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

            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
              <Tag style={tournamentDs.getToneTagStyle(teamStatusMeta.tone)} text={teamStatusMeta.label} textColor="neutral00" textStyle={{ color: teamStatusMeta.tone }} />
              <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={`${rosterSummary.totalCount} roster actif`} textColor="primary500" />
              {rosterSummary.invitedCount > 0 ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={`${rosterSummary.invitedCount} invitation${rosterSummary.invitedCount > 1 ? 's' : ''}`} textColor="primary500" />
              ) : null}
              {rosterSummary.requestedCount > 0 ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.warning500)} text={`${rosterSummary.requestedCount} demande${rosterSummary.requestedCount > 1 ? 's' : ''}`} textColor="warning500" />
              ) : null}
            </View>
            {!rosterSummary.meetsMinRoster ? (
              <Text style={[Fonts.p3, Fonts.warning500]}>
                {`Effectif minimum non atteint: ${rosterSummary.totalCount}/${rosterSummary.minRosterSize}`}
              </Text>
            ) : null}
            {!rosterSummary.meetsMaxRoster ? (
              <Text style={[Fonts.p3, Fonts.error500]}>
                {`Effectif maximum depasse: ${rosterSummary.totalCount}/${rosterSummary.maxRosterSize}`}
              </Text>
            ) : null}
            {rosterSummary.hasWarning && normalizeTournamentText(team?.status) === 'accepted' ? (
              <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                Cette equipe reste acceptee, mais un warning roster est maintenant visible pour l organisateur.
              </Text>
            ) : null}

            {currentMember && isTournamentActiveMemberStatus(currentMember?.responseStatus) ? (
              <View style={Spaces.gap[12]}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Ma reponse tournoi</Text>
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  <Button disabled={respondMutation.isPending || teamIsLocked} onPress={() => respondMutation.mutate('present')} size="sm" title="Present" variant={currentMemberStatus === 'present' ? 'Primary' : 'Secondary'} />
                  <Button
                    disabled={respondMutation.isPending || teamIsLocked}
                    onPress={() => respondMutation.mutate('absent')}
                    size="sm"
                    style={currentMemberStatus === 'absent'
                      ? { backgroundColor: `${Colors.error500}12`, borderColor: `${Colors.error500}55` }
                      : { borderColor: `${Colors.error500}55` }}
                    textStyle={{ color: Colors.error500 }}
                    title="Absent"
                    variant="SecondaryLight"
                  />
                </View>
                {canLeaveTeam ? (
                  <Button
                    disabled={leaveTeamMutation.isPending}
                    isLoading={leaveTeamMutation.isPending}
                    onPress={handleLeaveTeam}
                    size="sm"
                    style={{ alignSelf: 'flex-start', borderColor: `${Colors.neutral300}55` }}
                    textStyle={{ color: Colors.neutral100 }}
                    title="Quitter l equipe"
                    variant="SecondaryLight"
                  />
                ) : null}
                {currentMemberIsCaptain ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    Pour quitter cette equipe, transferez d abord le capitanat a un autre membre actif.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {currentMemberStatus === 'invited' ? (
              <View style={Spaces.gap[12]}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Invitation recue</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Cette invitation vous ajoute au roster tournoi uniquement si vous l acceptez.
                </Text>
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  <Button disabled={respondInvitationMutation.isPending || teamIsLocked} onPress={() => respondInvitationMutation.mutate('accepted')} size="sm" title="Accepter" variant="Primary" />
                  <Button
                    disabled={respondInvitationMutation.isPending || teamIsLocked}
                    onPress={() => respondInvitationMutation.mutate('declined')}
                    size="sm"
                    style={{ borderColor: `${Colors.error500}55` }}
                    textStyle={{ color: Colors.error500 }}
                    title="Refuser"
                    variant="SecondaryLight"
                  />
                </View>
              </View>
            ) : null}

            {currentMemberStatus === 'requested' ? (
              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.p4Bold, Fonts.warning500]}>Demande envoyee</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Votre demande est en attente de validation par le capitaine ou un admin de cette equipe tournoi.
                </Text>
              </View>
            ) : null}

            {canRequestJoinTeam ? (
              <View style={Spaces.gap[12]}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Rejoindre cette equipe</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Envoyez une demande de rejoindre. Le capitaine ou un admin pourra ensuite l accepter ou la refuser.
                </Text>
                <Button
                  disabled={requestJoinMutation.isPending}
                  isLoading={requestJoinMutation.isPending}
                  onPress={() => requestJoinMutation.mutate()}
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  title="Demander a rejoindre"
                  variant="Secondary"
                />
              </View>
            ) : null}

            {!canRequestJoinTeam && !currentMember && normalizeTournamentText(team?.sourceType) === 'custom_team' && team?.isOpenToJoinRequests !== true ? (
              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.p4Bold, Fonts.neutral00]}>Demandes fermees</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Le capitaine ou un admin doit ouvrir cette equipe avant de recevoir de nouvelles demandes.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={Spaces.gap[12]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Roster actif</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              Les membres actifs composent l equipe tournoi. Cette composition ne modifie jamais l equipe club permanente.
            </Text>
            {activeMembers.length === 0 ? (
              <View style={tournamentDs.styles.compactPanelCard}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>Aucun membre actif dans le roster pour le moment.</Text>
              </View>
            ) : null}
            {activeMembers.map((member) => renderMemberCard(member, 'active'))}
          </View>

          {canManageRoster ? (
            <View style={tournamentDs.styles.panelCard}>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Inviter un joueur</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {allowCrossClubPlayers
                      ? 'Recherchez un profil FoundClub ou reprenez un joueur du club pour lui envoyer une invitation.'
                      : 'Invitez un joueur du club sans toucher a l equipe club de base.'}
                  </Text>
                </View>
                <Button onPress={() => setIsInviteOpen((current) => !current)} size="sm" title={isInviteOpen ? 'Fermer' : 'Inviter'} variant="Secondary" />
              </View>

              {normalizeTournamentText(team?.sourceType) === 'custom_team' ? (
                <View style={tournamentDs.styles.insetPanelCard}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Demandes de rejoindre</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {team?.isOpenToJoinRequests === true
                      ? 'Les joueurs peuvent envoyer une demande pour rejoindre cette equipe custom.'
                      : 'Les demandes entrantes sont desactivees. Seules vos invitations manuelles sont possibles.'}
                  </Text>
                  <Button
                    isLoading={toggleOpenRequestsMutation.isPending}
                    onPress={() => toggleOpenRequestsMutation.mutate(!(team?.isOpenToJoinRequests === true))}
                    size="sm"
                    style={{ alignSelf: 'flex-start' }}
                    title={team?.isOpenToJoinRequests === true ? 'Fermer les demandes' : 'Ouvrir les demandes'}
                    variant="Secondary"
                  />
                </View>
              ) : null}

              {isInviteOpen ? (
                <View style={Spaces.gap[12]}>
                  <TextInput
                    onChangeText={setMemberSearchQuery}
                    placeholder={addMemberPlaceholder}
                    placeholderTextColor={Colors.neutral500}
                    style={tournamentDs.styles.input}
                    value={memberSearchQuery}
                  />

                  {isFetchingScopedUsers || isFetchingGlobalUsers ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>Recherche en cours...</Text>
                  ) : null}

                  {candidateUsers.length === 0 ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {searchTerm.length >= 2
                        ? 'Aucun profil disponible a inviter pour cette recherche.'
                        : 'Aucun autre joueur disponible a inviter pour le moment.'}
                    </Text>
                  ) : (
                    candidateUsers.map((user) => (
                      <View
                        key={user?.documentId}
                        style={tournamentDs.styles.insetPanelCard}
                      >
                        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
                            <ProfileAvatar imageUrl={user?.avatar?.url} size={38} />
                            <View style={{ flex: 1 }}>
                              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                                {[user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.username || 'Participant'}
                              </Text>
                              <Text style={[Fonts.p4, Fonts.neutral200]}>{user?.club?.name || 'Profil FoundClub'}</Text>
                            </View>
                          </View>
                          <Button disabled={inviteMemberMutation.isPending} onPress={() => inviteMemberMutation.mutate(user?.documentId)} size="sm" title="Inviter" variant="Primary" />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {invitedMembers.length > 0 ? (
            <View style={Spaces.gap[12]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Invitations en attente</Text>
              <Text style={[Fonts.p2, Fonts.primary100]}>
                Ces profils ne font pas encore partie du roster actif tant qu ils n ont pas accepte.
              </Text>
              {invitedMembers.map((member) => renderMemberCard(member, 'invited'))}
            </View>
          ) : null}

          {(requestedMembers.length > 0 || currentMemberStatus === 'requested') ? (
            <View style={Spaces.gap[12]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Demandes de rejoindre</Text>
              <Text style={[Fonts.p2, Fonts.primary100]}>
                Les demandes acceptees passent ensuite dans le roster actif avec un statut initial en attente.
              </Text>
              {requestedMembers.length === 0 ? (
                <View style={tournamentDs.styles.compactPanelCard}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>Aucune demande en attente pour le moment.</Text>
                </View>
              ) : null}
              {requestedMembers.map((member) => renderMemberCard(member, 'requested'))}
            </View>
          ) : null}

          <Button onPress={() => navigation.navigate(RouteNames.EventDetails, { eventId })} title="Revenir au tournoi" variant="Secondary" />
        </ScrollView>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentTeamDetails;
