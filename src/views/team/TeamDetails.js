import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
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
import TeamSlotList from '@/components/molecules/teamSlotList/TeamSlotList';

import { RouteNames } from '@/navigation/routeNames';

import { removeTrainerFromClub } from '@/services/auth/authService';
import { getImageUrl } from '@/utils/imageUrl';
import {
  removePlayerFromTeam, 
  leaveTeam,
  refreshTeamScraping,
  setTeamFFBBUrl,
  selectTeamFFBBTeam,
  createFFBBErrorReport
} from '@/services/team/teamService';
import { useGetTeam } from '@/services/team/teamQueries';
import { createTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';

/**
 * @typedef {{ teamId: string; teamName: string }} FFBBTeamOption
 * @typedef {{ message?: string; response?: { data?: { code?: string; remainingSeconds?: number } } }} ApiError
 */

/**
 * Team details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team details screen component
 */
function TeamDetails({ navigation, route }) {
  const { teamId, invite } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
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

  const [activeTab, setActiveTab] = useState('infos');
  const [selectedRound, setSelectedRound] = useState(/** @type {string | number | null} */ (null));
  
  // FFBB Modal states
  const [showFFBBUrlModal, setShowFFBBUrlModal] = useState(false);
  const [showFFBBTeamModal, setShowFFBBTeamModal] = useState(false);
  const [showFFBBErrorModal, setShowFFBBErrorModal] = useState(false);
  const [ffbbUrl, setFfbbUrl] = useState('');
  const [ffbbTeamsList, setFfbbTeamsList] = useState(/** @type {FFBBTeamOption[]} */ ([]));
  const [ffbbLoading, setFfbbLoading] = useState(false);
  const [ffbbErrorType, setFfbbErrorType] = useState('wrong_data');
  const [ffbbErrorDescription, setFfbbErrorDescription] = useState('');

  /**
   * @param {unknown} error
   * @param {string} [fallback]
   * @returns {string}
   */
  const getErrorMessage = (error, fallback = 'Erreur') => {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if (typeof error === 'string') return error;
    return fallback;
  };

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

  const removePlayerMutation = useMutation({
    mutationFn: (/** @type {{ teamId: string; playerId: string }} */ payload) =>
      removePlayerFromTeam(payload.teamId, payload.playerId),
    onSuccess: () => {
      refetch();
    },
  });

  const refreshScrapingMutation = useMutation({
    mutationFn: refreshTeamScraping,
    onSuccess: () => {
      Alert.alert(t('common.success'), t('teamDetails.alerts.scrapingSuccess.description', 'Classement mis à jour avec succès.'));
      refetch();
    },
    onError: (/** @type {ApiError} */ err) => {
      const apiError = err;
      if (apiError?.response?.data?.code === 'RATE_LIMITED') {
        const seconds = apiError.response.data.remainingSeconds || 0;
        Alert.alert(t('common.error'), t('teamDetails.ffbb.rateLimit', `Veuillez patienter ${seconds} secondes.`));
      } else {
        Alert.alert(t('common.error'), t('teamDetails.alerts.scrapingError.description', `Erreur lors de la mise à jour : ${getErrorMessage(apiError)}`));
      }
    },
  });

  // Handler for FFBB URL configuration
  const handleSetFFBBUrl = async () => {
    if (!ffbbUrl || !teamId) return;
    setFfbbLoading(true);
    try {
      const result = await setTeamFFBBUrl(teamId, ffbbUrl);
      setFfbbTeamsList(result.teams || []);
      setShowFFBBUrlModal(false);
      setShowFFBBTeamModal(true);
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('teamDetails.ffbb.urlError', 'Erreur lors de la configuration: ') + getErrorMessage(error)
      );
    } finally {
      setFfbbLoading(false);
    }
  };

  // Handler for FFBB team selection
  const handleSelectFFBBTeam = async (/** @type {FFBBTeamOption} */ selectedTeam) => {
    if (!teamId) return;
    try {
      await selectTeamFFBBTeam(teamId, selectedTeam.teamId, selectedTeam.teamName);
      setShowFFBBTeamModal(false);
      refetch();
      Alert.alert(t('common.success'), t('teamDetails.ffbb.teamSelected', 'Équipe associée avec succès!'));
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error));
    }
  };

  // Handler for FFBB error reporting
  const handleReportError = async () => {
    if (!teamId) return;
    setFfbbLoading(true);
    try {
      await createFFBBErrorReport({
        teamId,
        problemType: ffbbErrorType,
        description: ffbbErrorDescription
      });
      setShowFFBBErrorModal(false);
      setFfbbErrorDescription('');
      Alert.alert(t('common.success'), t('teamDetails.ffbb.errorReported', 'Signalement envoyé, merci!'));
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error));
    } finally {
      setFfbbLoading(false);
    }
  };

  const trainersCount = useMemo(() => team?.trainers?.length || 0, [team?.trainers]);
  const playersCount = useMemo(() => team?.players?.length || 0, [team?.players]);
  const isMyTeam = useMemo(
    () => {
      const allMyTeams = (currentUser?.myTeams || [])?.concat(currentUser?.trainedTeams || []);
      return !!allMyTeams?.some((/** @type {Team} */ item) => item.documentId === teamId);
    },
    [currentUser?.trainedTeams, currentUser?.myTeams, teamId],
  );

  // Calculate team's rank and points from FFBB data
  const myTeamRanking = useMemo(() => {
    if (!team?.externalStandingData || !team?.externalTeamName) return null;
    const index = team.externalStandingData.findIndex(row => row.teamName === team.externalTeamName);
    if (index === -1) return null;
    const row = team.externalStandingData[index];
    return {
      rank: index + 1,
      points: row.points,
      total: team.externalStandingData.length
    };
  }, [team?.externalStandingData, team?.externalTeamName]);

  // handlers
  const handleEditTeam = useCallback(() => {
    if (currentUser) {
      navigation.navigate(RouteNames.TeamStack, {
        screen: RouteNames.TeamEdit,
        params: { clubId: team?.club?.documentId, teamId },
      });
    }
  }, [navigation, team?.club?.documentId, teamId, currentUser]);

  const pendingRequest = useMemo(() => {
    if (!currentUser?.teamMembershipRequests) {
        return null;
    }
    return currentUser.teamMembershipRequests.find(
      (r) => r.team?.documentId === teamId && r.state === 'pending'
    );
  }, [currentUser, teamId]);

  const handleJoinTeam = useCallback(() => {
    const userId = currentUser?.documentId;
    if (teamId && userId) {
      Alert.alert(
        t('teamDetails.alerts.joinRequest.title'),
        t('teamDetails.alerts.joinRequest.description'),
        [
          {
            style: 'cancel',
            text: t('common.actions.cancel'),
          },
          {
            onPress: () => {
              createTeamMembershipRequestMutation.mutate({
                team: teamId,
                user: userId,
              });
            },
            text: t('common.actions.confirm'),
          },
        ],
      );
    }
  }, [teamId, createTeamMembershipRequestMutation, currentUser?.documentId, t]);

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

  const handleUserPress = (/** @type {User} */ user) => {
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

  const handleDeleteTrainer = (/** @type {string} */ trainerId) => {
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

  const handleRemovePlayer = (/** @type {string} */ playerId) => {
    Alert.alert(
      t('teamDetails.alerts.removePlayer.title', 'Supprimer le joueur'),
      t('teamDetails.alerts.removePlayer.description', 'Voulez-vous vraiment retirer ce joueur de l\'équipe ?'),
      [
        {
          text: t('common.actions.cancel'),
          style: 'cancel',
        },
        {
          onPress: () => {
            const currentTeamId = teamId;
            if (currentTeamId) {
              removePlayerMutation.mutate({ teamId: currentTeamId, playerId });
            }
          },
          text: t('common.actions.confirm'),
          style: 'destructive',
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  useFocusEffect(
    useCallback(() => {
     if (invite && canJoinTeam(teamId) && !pendingRequest) {
        handleJoinTeam();
      }
    }, [invite, canJoinTeam, teamId, pendingRequest, handleJoinTeam])
  );

  const renderTab = (/** @type {string} */ key, /** @type {string} */ label) => {
      const isActive = activeTab === key;
      return (
          <TouchableOpacity
              onPress={() => setActiveTab(key)}
              style={[
                  Spaces.paddingVertical[8],
                  Spaces.paddingHorizontal[16],
                  isActive && {
                      borderBottomWidth: 2,
                      borderBottomColor: Colors.primary500
                  }
              ]}
          >
              <Text style={[
                  isActive ? Fonts.p1Bold : Fonts.p1,
                  isActive ? Fonts.primary500 : Fonts.neutral00
              ]}>
                  {label}
              </Text>
          </TouchableOpacity>
      );
  };

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

      <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[16]]}>
           {renderTab('infos', t('teamDetails.tabs.infos', 'Infos'))}
           {renderTab('standings', t('teamDetails.tabs.standings', 'Classement'))}
           {renderTab('calendar', t('teamDetails.tabs.calendar', 'Calendrier'))}
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
        
        {/* TAB CONTENT: INFOS */}
        {activeTab === 'infos' && (
          <View>
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
              {myTeamRanking && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                    {myTeamRanking.rank === 1 ? '🥇' : myTeamRanking.rank === 2 ? '🥈' : myTeamRanking.rank === 3 ? '🥉' : `${myTeamRanking.rank}${myTeamRanking.rank === 1 ? 'er' : 'ème'}`}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>•</Text>
                  <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                    {myTeamRanking.points} pts
                  </Text>
                </View>
              )}
            </View>
            {team?.description ? (
              <View style={[Alignments.alignCenter]}>
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  {team?.description}
                </Text>
              </View>
            ) : null}
            {(team?.city || team?.address?.properties?.label || team?.club?.address?.properties?.label || team?.club?.city) && (
                 <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                    <Text style={{ fontSize: 16 }}>📍</Text>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                        {team?.address?.properties?.label || team?.city || team?.club?.address?.properties?.label || team?.club?.city}
                    </Text>
                 </View>

            )}
            
            {/* Team Availability Slots (League Mode) */}
            <TeamSlotList 
                slots={team?.slots || []}
                isCaptain={canManageTeam}
                onAddSlot={() => Alert.alert('TODO', 'Ouvrir modal création slot')}
                onCheckIn={(slot) => Alert.alert('TODO', 'Check-in logic')}
            />

            <View style={[
              Alignments.fullWidth,
              ApplicationStyle.separator,
              ApplicationStyle.backgroundColor.neutral00,
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
            {((team?.club?.sponsor?.length ?? 0) > 0) && (
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
                    <View
                      key={player.documentId}
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
                      <TouchableOpacity
                        onPress={() => handleUserPress(player)}
                        style={[
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
                      </TouchableOpacity>
                      {canManageTeam && (
                        <View style={[Alignments.row, Spaces.gap[8]]}>
                          <Button
                            icon="trash"
                            isOption
                            onPress={() => handleRemovePlayer(player.documentId || '')}
                            variant="SecondaryLight"
                          />
                        </View>
                      )}
                    </View>
                  ))
                }
              </View>
            ) : null}
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
          </View>
        )}

      {/* TAB CONTENT: STANDINGS */}
        {activeTab === 'standings' && (
             <View style={[Spaces.padding[16], Alignments.alignCenter]}>
                 {team?.externalStandingData && team.externalStandingData.length > 0 ? (
                    <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[16], Alignments.fullWidth]}>
                        <View style={[Alignments.row, Spaces.paddingBottom[8], { borderBottomWidth: 1, borderBottomColor: '#FFFFFF33' }]}>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 25 }]}>#</Text>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>Équipe</Text>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 25, textAlign: 'center' }]}>Pts</Text>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 25, textAlign: 'center' }]}>J</Text>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 25, textAlign: 'center' }]}>M</Text>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 25, textAlign: 'center' }]}>E</Text>
                             <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 30, textAlign: 'center' }]}>D</Text>
                        </View>
                        {team.externalStandingData
                            .slice()
                            .sort((a, b) => Number(a.rank) - Number(b.rank))
                            .map((row, index) => {
                            const isMyTeam = team?.externalTeamName && row.teamName === team.externalTeamName;
                            return (
                            <View key={`${row.teamName}-${index}`} style={[
                                Alignments.row, 
                                Spaces.paddingVertical[8], 
                                { borderBottomWidth: 1, borderBottomColor: '#FFFFFF11' },
                                isMyTeam && { backgroundColor: Colors.primary500 + '33', borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8 }
                            ]}>
                                <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { width: 25 }]}>{row.rank}</Text>
                                <Text style={[Fonts.p2Bold, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { flex: 1 }]} numberOfLines={1}>
                                    {isMyTeam && '★ '}{row.teamName}
                                </Text>
                                <Text style={[Fonts.p2Bold, Fonts.primary500, { width: 25, textAlign: 'center' }]}>{row.points}</Text>
                                <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { width: 25, textAlign: 'center' }]}>{row.played}</Text>
                                <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { width: 25, textAlign: 'center', fontSize: 10 }]}>{row.goalFor || '-'}</Text>
                                <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { width: 25, textAlign: 'center', fontSize: 10 }]}>{row.goalAgainst || '-'}</Text>
                                <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { width: 30, textAlign: 'center', fontSize: 10 }]}>{row.goalDiff || '-'}</Text>
                            </View>
                            );
                        })}
                    </View>
                 ) : (
                    <View style={[Alignments.alignCenter, Spaces.gap[16]]}>
                       <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>
                         {t('teamDetails.ffbb.noData', 'Aucun classement externe configuré')}
                       </Text>
                       {isMyTeam && (
                         <Button
                           title={t('teamDetails.ffbb.configure', 'Configurer le classement FFBB')}
                           variant="Primary"
                           onPress={() => setShowFFBBUrlModal(true)}
                         />
                       )}
                    </View>
                 )}
                 {/* Refresh Button for Staff */}
                 {canManageTeam && (
                    <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[24]]}>
                      <Button 
                         title={t('teamDetails.ffbb.refresh', 'Actualiser')}
                         variant="Secondary"
                         style={{ flex: 1 }}
                         onPress={() => {
                             if (teamId) refreshScrapingMutation.mutate(teamId);
                         }}
                         isLoading={refreshScrapingMutation.isPending}
                      />
                      <Button 
                         title={t('teamDetails.ffbb.reportError', 'Signaler')}
                         variant="SecondaryLight"
                         icon="flag"
                         style={{ flex: 1 }}
                         onPress={() => setShowFFBBErrorModal(true)}
                      />
                    </View>
                 )}
             </View>
        )}

      {/* TAB CONTENT: CALENDAR */}
        {activeTab === 'calendar' && (
             <View style={[Spaces.padding[16]]}>
                 {team?.externalCalendarData && team.externalCalendarData.length > 0 ? (
                    <View>
                        {/* Round Selector */}
                        {(() => {
                            const rounds = [...new Set(team.externalCalendarData.map(m => m.round).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
                            // Auto-select NEXT round (first round with unplayed matches or last played + 1)
                            const roundsNum = rounds.map(Number);
                            const playedRounds = team.externalCalendarData
                                .filter(m => m.played && m.round)
                                .map(m => Number(m.round));
                                
                            const maxPlayedRound = playedRounds.length > 0 ? Math.max(...playedRounds) : 0;
                            // Default to maxPlayed + 1, unless it exceeds max found round, then max round
                            let defaultRound = maxPlayedRound + 1;
                            if (roundsNum.length > 0 && defaultRound > Math.max(...roundsNum)) {
                                defaultRound = Math.max(...roundsNum);
                            }
                            // If no games played, defaultRound is 1. Check if 1 exists in rounds, if not use first available.
                            if (!roundsNum.includes(defaultRound) && rounds.length > 0) {
                                // Fallback: find first round > maxPlayedRound
                                const upcoming = roundsNum.find(r => r > maxPlayedRound);
                                defaultRound = upcoming || roundsNum[roundsNum.length - 1];
                            }

                            const effectiveRound = selectedRound !== null ? selectedRound : (String(defaultRound) || rounds[0] || null);
                            
                            const filteredMatches = effectiveRound 
                                ? team.externalCalendarData.filter(m => String(m.round) === String(effectiveRound))
                                : team.externalCalendarData;

                            return (
                                <>
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false} 
                                        style={[Spaces.marginBottom[16]]}
                                        contentContainerStyle={[Spaces.gap[8]]}
                                    >
                                        {rounds.map(round => {
                                            const isActive = String(effectiveRound) === String(round);
                                            return (
                                                <TouchableOpacity
                                                    key={round}
                                                    onPress={() => setSelectedRound(round ?? null)}
                                                    style={[
                                                        Spaces.paddingVertical[8],
                                                        Spaces.paddingHorizontal[16],
                                                        ApplicationStyle.borderRadius24,
                                                        isActive 
                                                            ? ApplicationStyle.backgroundColor.primary500 
                                                            : ApplicationStyle.backgroundColor.primary700,
                                                    ]}
                                                >
                                                    <Text style={[Fonts.p2Bold, isActive ? Fonts.neutral900 : Fonts.neutral00]}>
                                                        J{round}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                    
                                    <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[16]]}>
                                        {filteredMatches.length > 0 ? filteredMatches
                                          .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                                          .map((match, index) => {
                                            const matchDate = match.date ? new Date(match.date) : null;
                                            const isPlayed = match.played;
                                            return (
                                              <View 
                                                key={`${match.homeTeam}-${match.awayTeam}-${index}`} 
                                                style={[
                                                  Spaces.paddingVertical[12], 
                                                  { borderBottomWidth: index < filteredMatches.length - 1 ? 1 : 0, borderBottomColor: '#FFFFFF11' }
                                                ]}
                                              >
                                                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                                                   <Text style={[Fonts.p3, Fonts.primary100, { width: 70 }]}>
                                                       {matchDate ? matchDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'TBD'}
                                                   </Text>
                                                   <View style={[{ flex: 1 }, Alignments.alignCenter]}>
                                                       <Text style={[Fonts.p2Bold, Fonts.neutral00]} numberOfLines={1}>{match.homeTeam}</Text>
                                                       <Text style={[Fonts.p3, Fonts.primary100]}>vs</Text>
                                                       <Text style={[Fonts.p2Bold, Fonts.neutral00]} numberOfLines={1}>{match.awayTeam}</Text>
                                                   </View>
                                                   <View style={[{ width: 50 }, Alignments.alignCenter]}>
                                                       {isPlayed ? (
                                                           <Text style={[Fonts.p1Bold, Fonts.primary500]}>{match.homeScore} - {match.awayScore}</Text>
                                                       ) : (
                                                           <Text style={[Fonts.p2, Fonts.primary100]}>—</Text>
                                                       )}
                                                   </View>
                                                </View>
                                              </View>
                                            );
                                        }) : (
                                            <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>Aucun match pour cette journée.</Text>
                                        )}
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                 ) : (
                    <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>Aucun calendrier disponible.</Text>
                 )}
                 
                 {/* Refresh Button for Staff (Duplicate from Standings) */}
                 {canManageTeam && (
                    <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[24]]}>
                      <Button 
                         title={t('teamDetails.ffbb.refresh', 'Actualiser')}
                         variant="Secondary"
                         style={{ flex: 1 }}
                         onPress={() => {
                             if (teamId) refreshScrapingMutation.mutate(teamId);
                         }}
                         isLoading={refreshScrapingMutation.isPending}
                      />
                      <Button 
                         title={t('teamDetails.ffbb.reportError', 'Signaler')}
                         variant="SecondaryLight"
                         icon="flag"
                         style={{ flex: 1 }}
                         onPress={() => setShowFFBBErrorModal(true)}
                      />
                    </View>
                 )}
             </View>
        )}

        </WithDataWrapper>
      </ScrollView>
      <View style={[Alignments.row, Spaces.gap[16]]}>
        {canManageTeam && isMyClub && (isMyTeam || (team?.club?.documentId ? canEditClub(team.club.documentId) : false)) && (
          <Button
            onPress={handleEditTeam}
            style={[Alignments.fill, Spaces.paddingHorizontal[16]]}
            title={t('teamDetails.actions.edit')}
            variant="Primary"
          />
        )}
        {canManageTeam && allMembers?.length > 1 && isMyTeam && (
          <Button
            onPress={handleStartChat}
            style={[Alignments.fill, Spaces.paddingHorizontal[16]]}
            title={t('teamDetails.actions.contactTeam')}
            variant="PrimaryLight"
          />
        )}
      </View>
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
          disabled={!!pendingRequest}
          onPress={pendingRequest ? undefined : handleJoinTeam}
          style={Spaces.paddingHorizontal[16]}
          title={
            pendingRequest
              ? t('teamDetails.actions.requestPending', 'Demande en attente')
              : t('teamDetails.actions.join')
          }
          variant={pendingRequest ? 'Secondary' : 'Primary'}
        />
      )}

      {/* FFBB URL Configuration Modal */}
      <Modal
        visible={showFFBBUrlModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFFBBUrlModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { width: '90%', maxWidth: 400 }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.configureTitle', 'Configurer le classement FFBB')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.configureDescription', 'Collez l\'URL de votre compétition depuis competitions.ffbb.com')}
            </Text>
            <TextInput
              style={[
                Fonts.p1, Fonts.neutral00,
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius12,
                Spaces.padding[12],
                Spaces.marginBottom[16]
              ]}
              placeholder="https://competitions.ffbb.com/..."
              placeholderTextColor="#888"
              value={ffbbUrl}
              onChangeText={setFfbbUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                title={t('common.cancel', 'Annuler')}
                variant="Secondary"
                onPress={() => setShowFFBBUrlModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.confirm', 'Valider')}
                variant="Primary"
                onPress={handleSetFFBBUrl}
                isLoading={ffbbLoading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* FFBB Team Selection Modal */}
      <Modal
        visible={showFFBBTeamModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFFBBTeamModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { width: '90%', maxWidth: 400, maxHeight: '70%' }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.selectTeam', 'Sélectionnez votre équipe')}
            </Text>
            <ScrollView style={Spaces.marginBottom[16]}>
              {ffbbTeamsList.map((ffbbTeam, index) => (
                <TouchableOpacity
                  key={ffbbTeam.teamId || index}
                  onPress={() => handleSelectFFBBTeam(ffbbTeam)}
                  style={[
                    Alignments.row, Alignments.alignCenter,
                    Spaces.padding[12],
                    ApplicationStyle.borderRadius12,
                    { borderWidth: 1, borderColor: Colors.primary500 + '33' },
                    Spaces.marginBottom[8]
                  ]}
                >
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{ffbbTeam.teamName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title={t('common.cancel', 'Annuler')}
              variant="Secondary"
              onPress={() => setShowFFBBTeamModal(false)}
            />
          </View>
        </View>
      </Modal>

      {/* FFBB Error Report Modal */}
      <Modal
        visible={showFFBBErrorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFFBBErrorModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { width: '90%', maxWidth: 400 }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.reportTitle', 'Signaler un problème')}
            </Text>

            {/* Problem Type Selector */}
            <Text style={[Fonts.p2Bold, Fonts.primary100, Spaces.marginBottom[8]]}>
              {t('teamDetails.ffbb.problemType', 'Type de problème')}
            </Text>
            <View style={[Spaces.marginBottom[16], Spaces.gap[8]]}>
              {[
                { key: 'wrong_data', label: t('teamDetails.ffbb.problems.wrongData', 'Données incorrectes') },
                { key: 'missing_team', label: t('teamDetails.ffbb.problems.missingTeam', 'Équipe manquante') },
                { key: 'outdated', label: t('teamDetails.ffbb.problems.outdated', 'Données obsolètes') },
                { key: 'wrong_url', label: t('teamDetails.ffbb.problems.wrongUrl', 'Mauvaise URL') },
                { key: 'other', label: t('teamDetails.ffbb.problems.other', 'Autre') }
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setFfbbErrorType(option.key)}
                  style={[
                    Alignments.row, Alignments.alignCenter, Spaces.gap[8],
                    Spaces.padding[12], ApplicationStyle.borderRadius12,
                    { borderWidth: 1, borderColor: ffbbErrorType === option.key ? Colors.primary500 : '#FFFFFF33' },
                    ffbbErrorType === option.key && { backgroundColor: Colors.primary500 + '22' }
                  ]}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 2, borderColor: ffbbErrorType === option.key ? Colors.primary500 : '#FFFFFF66',
                    backgroundColor: ffbbErrorType === option.key ? Colors.primary500 : 'transparent'
                  }} />
                  <Text style={[Fonts.p2, ffbbErrorType === option.key ? Fonts.primary500 : Fonts.neutral00]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={[Fonts.p2Bold, Fonts.primary100, Spaces.marginBottom[8]]}>
              {t('teamDetails.ffbb.description', 'Description (optionnel)')}
            </Text>
            <TextInput
              style={[
                Fonts.p2, Fonts.neutral00,
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius12,
                Spaces.padding[12],
                Spaces.marginBottom[16],
                { borderWidth: 1, borderColor: '#FFFFFF33', minHeight: 80, textAlignVertical: 'top' }
              ]}
              placeholder={t('teamDetails.ffbb.descriptionPlaceholder', 'Décrivez le problème...')}
              placeholderTextColor="#888"
              value={ffbbErrorDescription}
              onChangeText={setFfbbErrorDescription}
              multiline
              numberOfLines={3}
            />

            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                title={t('common.cancel', 'Annuler')}
                variant="Secondary"
                onPress={() => setShowFFBBErrorModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.send', 'Envoyer')}
                variant="Primary"
                onPress={handleReportError}
                isLoading={ffbbLoading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default TeamDetails;
