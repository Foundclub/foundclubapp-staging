import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

import { removeTrainerFromClub } from '@/services/auth/authService';
import { getImageUrl } from '@/utils/imageUrl';
import { useGetTeam } from '@/services/team/teamQueries';
import { leaveTeam } from '@/services/team/teamService';
import { createTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';

/**
 * Team details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team details screen component
 */
function TeamDetails({ navigation, route }) {
  const { teamId } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    canEditClub,
    canJoinTeam,
    canManageTeam,
    inviteTeamPlayers,
    refetchUserData,
    userData: currentUser,
  } = useAuth();
  const { getClubInitials } = useClub();
  const { startTeamChat } = useMessaging();

  const {
    data: team, error, isLoading, refetch,
  } = useGetTeam(teamId);

  const allMembers = useMemo(() => {
    const allTrainers = team?.trainers || [];
    const allPlayers = team?.players || [];
    return allTrainers.concat(allPlayers);
  }, [team]);

  const isMyClub = useMemo(
    () => team?.club?.documentId === currentUser?.club?.documentId,
    [team?.club?.documentId, currentUser?.club?.documentId],
  );

  const createTeamMembershipRequestMutation = useMutation({
    mutationFn: createTeamMembershipRequest,
    onSuccess: () => {
      Alert.alert(
        t('teamDetails.alerts.joinRequest.title'),
        t('teamDetails.alerts.joinRequest.description'),
        [{ onPress: () => navigation.goBack(), text: t('teamDetails.alerts.joinRequest.actions.ok') }],
      );
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: leaveTeam,
    onSuccess: () => {
      refetchUserData();
      refetch();
    },
  });

  const deleteTrainerMutation = useMutation({
    mutationFn: removeTrainerFromClub,
    onSuccess: () => {
      refetch();
    },
  });

  const trainersCount = useMemo(() => team?.trainers?.length || 0, [team?.trainers]);
  const playersCount = useMemo(() => team?.players?.length || 0, [team?.players]);
  const isMyTeam = useMemo(
    () => {
      const allMyTeams = (currentUser?.myTeams || [])?.concat(currentUser?.trainedTeams || []);
      return !!allMyTeams?.some((/** @type {Team} */ item) => item.documentId === teamId);
    },
    [currentUser?.trainedTeams, currentUser?.myTeams, teamId],
  );

  // handlers
  const handleEditTeam = useCallback(() => {
    if (currentUser) {
      navigation.navigate(RouteNames.TeamEdit, { clubId: team?.club?.documentId, teamId });
    }
  }, [navigation, team?.club?.documentId, teamId, currentUser]);

  const handleJoinTeam = useCallback(() => {
    if (teamId && currentUser?.documentId) {
      createTeamMembershipRequestMutation.mutate({
        team: teamId,
        user: currentUser.documentId,
      });
    }
  }, [teamId, createTeamMembershipRequestMutation, currentUser?.documentId]);

  const handleLeaveTeam = useCallback(() => {
    if (teamId && currentUser?.documentId) {
      leaveTeamMutation.mutate(teamId);
    }
  }, [teamId, currentUser?.documentId, leaveTeamMutation]);

  const handleAskToLeave = useCallback(() => {
    Alert.alert(
      t('teamDetails.alerts.leave.title'),
      t('teamDetails.alerts.leave.description'),
      [
        {
          text: t('teamDetails.alerts.leave.actions.cancel'),
        },
        {
          onPress: handleLeaveTeam,
          text: t('teamDetails.alerts.leave.actions.confirm'),
        },
      ],
    );
  }, [t, handleLeaveTeam]);

  /**
   * Handle user press
   * @param {User} user
   */
  const handleUserPress = (user) => {
    if (user?.documentId) {
      if (user?.documentId === currentUser?.documentId) {
        navigation.navigate(RouteNames.ProfileStack);
      } else {
        navigation.navigate(RouteNames.ProfileStack, {
          screen: RouteNames.UserDetails,
          params: { userId: user.documentId },
        });
      }
    }
  };

  const handleStartChat = async () => {
    if (team?.documentId) {
      const newChat = await startTeamChat(team?.documentId);
      if (newChat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
      }
    }
  };

  /**
   * Handle delete trainer action
   * @param {string} trainerId
   */
  const handleDeleteTrainer = (trainerId) => {
    Alert.alert(
      t('teamDetails.alerts.deleteTrainer.title'),
      t('teamDetails.alerts.deleteTrainer.description'),
      [
        {
          text: t('teamDetails.alerts.deleteTrainer.actions.cancel'),
        },
        {
          onPress: () => {
            deleteTrainerMutation.mutate(trainerId);
          },
          text: t('teamDetails.alerts.deleteTrainer.actions.confirm'),
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[32],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.gap[8],
        Alignments.justifyCenter,
        Alignments.alignCenter]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t(`teamDetails.${isMyTeam ? 'myTitle' : 'title'}`).toUpperCase()}
        </Text>
        <View style={[
          ApplicationStyle.separator,
          ApplicationStyle.backgroundColor.neutral00,
          { width: 120 }]}
        />
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {team?.activities?.[0]?.name?.toUpperCase()}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[32],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Alignments.fill]}
        >
          <View
            key={team?.documentId}
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Alignments.alignCenter,
              Alignments.relative,
              Spaces.gap[24],
              Spaces.padding[24],
              Spaces.marginTop[64],
            ]}
          >
            <View style={[{ marginTop: -45 }, Alignments.absolute]}>
              {team?.club?.logo?.url ? (
                <ProfileAvatar
                  imageUrl={team.club.logo.url}
                  size={90}
                  style={[
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral00,
                    { borderRadius: 90 },
                  ]}
                  imageStyle={{ borderRadius: 90 }}
                />
              ) : (
                <TeamShield
                  initials={team?.club?.name ? getClubInitials(team?.club?.name || '') : ''}
                />
              )}
            </View>
            <View style={[
              Spaces.marginTop[32],
              Spaces.gap[4],
              Alignments.alignCenter]}
            >
              <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                {team?.name}
              </Text>
            </View>
            {team?.description ? (
              <View style={[Alignments.alignCenter]}>
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  {team?.description}
                </Text>
              </View>
            ) : null}
            <View style={[
              Alignments.fullWidth,
              ApplicationStyle.separator,
              ApplicationStyle.backgroundColor.neutral500,
            ]}
            />
            <View style={[
              Spaces.gap[8],
              Alignments.row,
              Alignments.wrap,
              Alignments.justifyCenter,
            ]}
            >
              {team?.section ? (
                <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                  {t('teamList.fields.section')}
                  {' : '}
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {team?.section?.name}
                  </Text>
                </Text>
              ) : null}
              {team?.category ? (
                <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                  {t('teamList.fields.category')}
                  {' : '}
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {team?.category?.name}
                  </Text>
                </Text>
              ) : null}
              {team?.level ? (
                <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                  {t('teamList.fields.level')}
                  {' : '}
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {team?.level?.name}
                  </Text>
                </Text>
              ) : null}
            </View>
          </View>
          <View
            style={[
              Spaces.gap[40],
              Spaces.marginTop[24],
              Spaces.paddingBottom[24],
            ]}
          >
            {/* Sponsors */}
            {(team?.club?.sponsor?.length > 0) && (
              <ScrollView
                contentContainerStyle={[Spaces.gap[16]]}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {team?.club?.sponsor?.map((/** @type {Sponsor} */ sponsor) => (
                  <View
                    key={sponsor.link}
                    style={[Alignments.relative, Spaces.marginTop[8]]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (sponsor.link) {
                          Linking.openURL(sponsor.link);
                        }
                      }}
                      style={[
                        Alignments.alignCenter,
                      ]}
                    >
                      <Image
                        source={{ uri: getImageUrl(sponsor?.logo?.url) }}
                        style={[
                          ApplicationStyle.roundIcon55,
                          ApplicationStyle.borderWidth1,
                          ApplicationStyle.borderColor.neutral00,
                        ]}
                      />
                      <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                        {sponsor.title}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {/* Trainers */}
            {trainersCount ? (
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row,
                Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                >
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    {t('teamDetails.sections.trainers', { count: trainersCount })}
                  </Text>
                </View>
                {
                  team?.trainers?.map((/** @type {User} */ trainer) => (
                    <TouchableOpacity
                      key={trainer.documentId}
                      onPress={() => handleUserPress(trainer)}
                      style={[
                        ApplicationStyle.borderRadius24,
                        ApplicationStyle.backgroundColor.primary700,
                        Alignments.row,
                        Alignments.fill,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        Spaces.padding[16],
                        Spaces.gap[16]]}
                    >
                      <View
                        style={[
                          Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                      >
                        <ProfileAvatar
                          imageUrl={trainer?.avatar?.url}
                          size={40}
                          style={[
                            ApplicationStyle.borderWidth1,
                            ApplicationStyle.borderColor.neutral00,
                            { borderRadius: 40 },
                          ]}
                          imageStyle={{ borderRadius: 40 }}
                        />
                        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
                          {`${trainer.firstname} ${trainer.lastname}`}
                        </Text>
                      </View>
                      {team?.club?.documentId && canEditClub(team?.club?.documentId)
                        && trainer?.role?.name === USER_ROLES.coach ? (
                        <View style={[Alignments.row, Spaces.gap[8]]}>
                          <Button
                            icon="trash"
                            isOption
                            onPress={() => handleDeleteTrainer(trainer.documentId || '')}
                            variant="SecondaryLight"
                          />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  ))
                }
              </View>
            ) : null}
            {/* Players */}
            {playersCount || canManageTeam ? (
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row,
                Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                >
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    {t('teamDetails.sections.players', { count: playersCount })}
                  </Text>
                  {canManageTeam && (
                    <Button
                      icon="share"
                      isOption
                      onPress={() => inviteTeamPlayers({
                        clubName: team?.club?.name,
                        teamName: team?.name,
                      })}
                      variant="Primary"
                    />
                  )}
                </View>
                {
                  team?.players?.map((/** @type {User} */ player) => (
                    <TouchableOpacity
                      key={player.documentId}
                      onPress={() => handleUserPress(player)}
                      style={[
                        ApplicationStyle.borderRadius24,
                        ApplicationStyle.backgroundColor.primary700,
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        Alignments.fill,
                        Spaces.padding[16],
                        Spaces.gap[16],
                      ]}
                    >
                      <View style={[
                        Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                      >
                        <ProfileAvatar
                          imageUrl={player?.avatar?.url}
                          size={40}
                          style={[
                            ApplicationStyle.borderWidth1,
                            ApplicationStyle.borderColor.neutral00,
                            { borderRadius: 40 },
                          ]}
                          imageStyle={{ borderRadius: 40 }}
                        />
                        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
                          {`${player.firstname} ${player.lastname}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                }
              </View>
            ) : null}
            {/* Next events */}
            <View style={[Spaces.gap[16]]}>
              <View style={[Alignments.row,
              Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
              >
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                  {t('teamDetails.sections.nextEvents')}
                </Text>
              </View>
              <EventListContent
                additionalFilters={{
                  ...(!isMyTeam ? { sessionStatus: 'open' } : {}),
                  teamIds: [team?.documentId || ''],
                }}
                showFilters={false}
              />
            </View>
          </View>
        </WithDataWrapper>
      </ScrollView>
      <View style={[Alignments.row, Spaces.gap[16]]}>
        {/* Only show Edit button if user is a manager AND (it's their team OR they are club admin) */}
        {canManageTeam && isMyClub && (isMyTeam || canEditClub(team?.club?.documentId)) && (
          <Button
            onPress={handleEditTeam}
            style={[Alignments.fill, Spaces.paddingHorizontal[16]]}
            title={t('teamDetails.actions.edit')}
            variant="Primary"
          />
        )}
        {/* Only show Contact button if user is a manager AND it's their team */}
        {canManageTeam && allMembers?.length > 1 && isMyTeam && (
          <Button
            onPress={handleStartChat}
            style={[Alignments.fill, Spaces.paddingHorizontal[16]]}
            title={t('teamDetails.actions.contactTeam')}
            variant="PrimaryLight"
          />
        )}
      </View>
      {/* Statistics button for coaches */}
      {canManageTeam && isMyTeam && (
        <Button
          onPress={() => navigation.navigate(RouteNames.TeamStats, { 
            teamId: team?.documentId, 
            teamName: team?.name 
          })}
          style={Spaces.paddingHorizontal[16]}
          title={t('teamDetails.actions.stats', 'Statistiques')}
          variant="Secondary"
        />
      )}
      {
        isMyTeam && (
          <Button
            onPress={handleAskToLeave}
            style={Spaces.paddingHorizontal[16]}
            title={t('teamDetails.actions.leave')}
            variant="Secondary"
          />
        )
      }
      {canJoinTeam(teamId) && (
        <Button
          onPress={handleJoinTeam}
          style={Spaces.paddingHorizontal[16]}
          title={t('teamDetails.actions.join')}
          variant="Primary"
        />
      )}
    </ScreenContainer>
  );
}

export default TeamDetails;
