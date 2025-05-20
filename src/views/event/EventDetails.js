import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  useCallback, useLayoutEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';
import { cancelEvent } from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
import {
  acceptEventParticipation,
  declineEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import { createEventReport } from '@/services/eventReport/eventReportService';

/**
 * Event details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Event details screen component
 */
function EventDetails({ navigation, route }) {
  const { eventId } = route?.params ?? {};
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isRefuseModalVisible, setIsRefuseModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [selectedParticipationId, setSelectedParticipationId] = useState('');

  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  const { canEditEvent, userData } = useAuth();

  const {
    data: event, error, isLoading, refetch,
  } = useGetEvent(eventId);

  const { data: eventParticipations, refetch: refetchParticipations } = useGetEventParticipations(
    eventId,
    canEditEvent(event?.team?.documentId || '')
      ? undefined
      : userData?.documentId,
    {
      pageSize: 100,
    },
  );

  const { mutate: acceptParticipation } = useMutation({
    mutationFn: acceptEventParticipation,
    onSuccess: () => {
      refetch();
      refetchParticipations();
      setSelectedParticipationId('');
    },
  });

  const { mutate: declineParticipation } = useMutation({
    mutationFn: declineEventParticipation,
    onSuccess: () => {
      refetchParticipations();
      setIsRefuseModalVisible(false);
      setSelectedParticipationId('');
    },
  });

  const { mutate: cancelEventMutation } = useMutation({
    mutationFn: cancelEvent,
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const { isPending: isReportingEvent, mutate: reportEvent } = useMutation({
    mutationFn: createEventReport,
    onSuccess: () => {
      setIsReportModalVisible(false);
      Alert.alert(
        t('eventDetails.modals.reportSuccess.title'),
        t('eventDetails.modals.reportSuccess.description'),
      );
    },
  });

  const handleEditEvent = useCallback(() => {
    navigation.navigate(RouteNames.EventEdit, { eventId });
  }, [navigation, eventId]);

  const handleJoinEvent = () => {
    setIsJoinModalVisible(true);
  };

  const handleCloseJoinModal = () => {
    setIsJoinModalVisible(false);
  };

  const handleOpenReportModal = useCallback(() => {
    setIsReportModalVisible(true);
  }, []);

  const handleCloseReportModal = () => {
    setIsReportModalVisible(false);
  };

  /**
   * Handle report submission
   * @param {string} reason - The reason for reporting the event
   */
  const handleSubmitReport = (reason) => {
    reportEvent({ event: eventId, reason });
  };

  /**
   * Handle participation request
   * @param {string} participationId - The ID of the participation
   * @param {'accepted' | 'declined'} status - The status of the participation
   * @returns {void}
   */
  const handleUpdateParticipation = (participationId, status) => {
    if (!participationId) return;

    setSelectedParticipationId(participationId);

    if (status === 'accepted') {
      Alert.alert(t('eventDetails.modals.accept.title'), '', [
        {
          onPress: () => setSelectedParticipationId(''),
          style: 'cancel',
          text: t('eventDetails.modals.actions.cancel'),
        },
        {
          onPress: () => {
            acceptParticipation(participationId);
            setSelectedParticipationId('');
          },
          style: 'default',
          text: t('eventDetails.modals.actions.confirm'),
        },
      ]);
    } else if (status === 'declined') {
      setIsRefuseModalVisible(true);
    }
  };

  /**
   * Handle refusal submission
   * @param {string} reason - The reason for refusal
   * @returns {void}
   */
  const handleRefuseSubmit = (reason) => {
    if (selectedParticipationId) {
      declineParticipation({
        reason,
        requestId: selectedParticipationId,
      });
    }
    setSelectedParticipationId('');
  };

  const handleGoLogin = () => {
    navigation.navigate(RouteNames.AuthStackAccount);
  };

  const handleCancelEvent = () => {
    if (!eventId) return;
    Alert.alert(
      t('eventDetails.modals.cancelEvent.title'),
      t('eventDetails.modals.cancelEvent.description'),
      [
        {
          style: 'cancel',
          text: t('eventDetails.modals.actions.cancel'),
        },
        {
          onPress: () => cancelEventMutation(eventId),
          style: 'destructive',
          text: t('eventDetails.modals.actions.confirm'),
        },
      ],
    );
  };

  /**
   * Handle participation acceptance
   * @param {User} user
   */
  const handleUserPress = (user) => {
    if (user?.documentId) {
      if (user?.documentId === userData?.documentId) {
        navigation.navigate(RouteNames.Profile);
      } else {
        navigation.navigate(RouteNames.UserDetails, { userId: user.documentId });
      }
    }
  };

  // memoized values
  const hasPendingRequest = useMemo(() => {
    const myParticipations = eventParticipations?.pages?.[0]?.data || [];
    if (myParticipations.length) {
      return myParticipations.some(
        (participation) => participation.participationStatus === 'pending'
          && participation.user.documentId === userData?.documentId,
      );
    }
    return false;
  }, [eventParticipations, userData]);

  const pendingParticipations = useMemo(() => {
    const allParticipations = eventParticipations?.pages?.[0]?.data || [];
    return allParticipations.filter(
      (participation) => participation.participationStatus === 'pending',
    );
  }, [eventParticipations]);

  /** @type {{ missing: User[]; notAnswered: User[]; participating: User[]; }} */
  const participationsByStatus = useMemo(() => {
    if (!canEditEvent(event?.team?.documentId || '')) {
      return {
        missing: [],
        notAnswered: [],
        participating: event?.participations || [],
      };
    }

    const teamPlayers = event?.team?.players || [];

    /** @type {User[]} */
    const participatingPlayers = event?.participations || [];
    /** @type {User[]} */
    const missingPlayers = event?.missings || [];
    const notAnsweredPlayers = teamPlayers.filter(
      (player) => !participatingPlayers.some(
        (participation) => participation.documentId === player.documentId,
      )
      && !missingPlayers.some((missing) => missing.documentId === player.documentId),
    );

    return {
      missing: missingPlayers || [],
      notAnswered: notAnsweredPlayers || [],
      participating: participatingPlayers || [],
    };
  }, [event, canEditEvent]);

  // renderers

  /**
   * Renders the action button for joining an event
   * @returns {import('react').ReactElement} The rendered action button
   */
  const renderActionButtons = () => {
    const canEdit = canEditEvent(event?.team?.documentId || '');
    return event ? (
      <EventAnswerButtons
        event={event}
        hasPendingRequest={hasPendingRequest}
        onAbout={() => {}}
        onCancel={canEdit ? handleCancelEvent : undefined}
        onDecline={() => {}}
        onEdit={canEdit ? handleEditEvent : undefined}
        onJoin={handleJoinEvent}
        onLogin={handleGoLogin}
      />
    ) : <View />;
  };

  const renderReportButton = useCallback(() => (
    <Button
      icon="flag"
      isOption
      onPress={handleOpenReportModal}
      style={Spaces.marginRight[16]}
      variant="Secondary"
    />
  ), [handleOpenReportModal, Spaces]);

  // effects
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchParticipations();
    }, [refetch, refetchParticipations]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: renderReportButton,
    });
  }, [navigation, renderReportButton]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[32],
        Spaces.gap[32],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View
        style={[
          Spaces.gap[8],
          Alignments.justifyCenter,
          Alignments.alignCenter,
        ]}
      >
        <Tag
          text={event?.type?.name?.toUpperCase() || ''}
          textStyle={Fonts.p2}
        />
      </View>

      <ScrollView
        contentContainerStyle={[Spaces.gap[32], Spaces.paddingBottom[40]]}
        refreshControl={(
          <RefreshControl
            onRefresh={() => {
              refetch();
              refetchParticipations();
            }}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Alignments.fill, Spaces.gap[24]]}
        >
          <View
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Alignments.alignCenter,
              Alignments.relative,
              Spaces.gap[8],
              Spaces.paddingHorizontal[24],
              Spaces.paddingVertical[32],
            ]}
          >
            <View
              style={[
                Spaces.gap[4],
                Alignments.alignCenter,
                Alignments.fullWidth,
                Alignments.row,
              ]}
            >
              <TeamShield
                initials={
                  event?.team?.club?.name
                    ? getClubInitials(event?.team?.club?.name || '')
                    : ''
                }
                isSmall
              />
              <Text style={[Fonts.p1Bold, Fonts.neutral00, { maxWidth: '75%' }]}>
                {event?.team?.club?.name}
              </Text>
            </View>
            <View
              style={[
                Alignments.fullWidth,
                Spaces.gap[8],
                Spaces.marginBottom[12],
              ]}
            >
              <Text
                style={[
                  Fonts.p2Bold,
                  Fonts.primary500,
                  Fonts.textRight,
                  Alignments.fullWidth,
                ]}
              >
                {event?.team?.section?.name}
              </Text>
              <View
                style={[
                  Alignments.fullWidth,
                  ApplicationStyle.separator,
                  ApplicationStyle.backgroundColor.primary500,
                ]}
              />
            </View>

            <View style={[Spaces.gap[24], Alignments.fill]}>
              {event?.locationDetails ? (
                <View
                  style={[
                    Alignments.row,
                    Alignments.justifyCenter,
                    Spaces.gap[8],
                  ]}
                >
                  <Image
                    source={Images.pin}
                    style={[
                      ApplicationStyle.icon20,
                      ApplicationStyle.tintColor.neutral00,
                    ]}
                  />
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {JSON.parse(event.locationDetails)?.address}
                  </Text>
                </View>
              ) : null}
              <View style={[Alignments.row, Alignments.fill, Spaces.gap[16]]}>
                {event?.date ? (
                  <View style={[Spaces.gap[8]]}>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      <Image
                        source={Images.calendar}
                        style={[
                          ApplicationStyle.icon20,
                          ApplicationStyle.tintColor.neutral00,
                        ]}
                      />
                      <Text style={[Fonts.p2, Fonts.primary100]}>
                        {format(new Date(event.date), 'dd MMMM yyyy')}
                      </Text>
                    </View>

                    <View style={[Alignments.row, Spaces.gap[4]]}>
                      <Image
                        source={Images.clock}
                        style={[
                          ApplicationStyle.icon20,
                          ApplicationStyle.tintColor.neutral00,
                        ]}
                      />
                      <Text style={[Fonts.p2, Fonts.primary100]}>
                        {format(new Date(event.date), 'HH:mm')}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View
                  style={[
                    { height: 45, width: 1 },
                    ApplicationStyle.backgroundColor.neutral00,
                  ]}
                />
                {event?.team ? (
                  <View style={[Spaces.gap[8]]}>
                    <Text
                      numberOfLines={1}
                      style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}
                    >
                      {event?.team?.category?.name}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}
                    >
                      {event?.team?.level?.name}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          {/* Description section */}
          <View style={[Spaces.gap[16], Alignments.fill]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.fields.description')}
            </Text>
            <Text style={[Fonts.p1, Fonts.primary100]}>
              {event?.description}
            </Text>
          </View>
          {/* Participation Requests section */}
          {canEditEvent(event?.team?.documentId || '')
            && pendingParticipations.length > 0 && (
              <View style={[Spaces.gap[16], Alignments.fill]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  {t('eventDetails.fields.participationRequests')}
                </Text>
                {pendingParticipations.map((participation) => (
                  <TouchableOpacity
                    key={participation.documentId}
                    onPress={() => handleUserPress(participation.user)}
                    style={[
                      ApplicationStyle.borderRadius24,
                      Alignments.row,
                      ApplicationStyle.backgroundColor.primary700,
                      Spaces.padding[24],
                      Spaces.gap[24],
                    ]}
                  >
                    <View
                      style={[
                        Alignments.row,
                        Spaces.gap[16],
                        Alignments.alignCenter,
                      ]}
                    >
                      <Image
                        source={
                          participation.user.avatar
                            ? { uri: participation.user.avatar.url }
                            : Images.roundAvatar
                        }
                        style={[
                          ApplicationStyle.roundIcon40,
                          ApplicationStyle.borderWidth1,
                          ApplicationStyle.borderColor.neutral00,
                        ]}
                      />
                      <Text
                        numberOfLines={1}
                        style={[Fonts.p1Bold, Fonts.neutral00]}
                      >
                        {`${participation.user.firstname} ${participation.user.lastname}`}
                      </Text>
                    </View>
                    <View
                      style={[
                        Alignments.row,
                        Spaces.gap[8],
                        Alignments.justifyCenter,
                      ]}
                    >
                      <Button
                        icon="check"
                        isOption
                        onPress={() => participation.documentId
                          && handleUpdateParticipation(
                            participation.documentId,
                            'accepted',
                          )}
                        variant="Primary"
                      />
                      <Button
                        icon="close"
                        isOption
                        onPress={() => participation.documentId
                          && handleUpdateParticipation(
                            participation.documentId,
                            'declined',
                          )}
                        variant="Secondary"
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
          )}
          {/* Participation section */}
          <View style={[Spaces.gap[16], Alignments.fill]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.fields.participations')}
              <Text>
                {` :  ${event?.participations?.length || 0} / ${
                  event?.capacity
                }`}
              </Text>
            </Text>
            {participationsByStatus ? (
              <>
                {participationsByStatus.participating.length > 0 && (
                  <>
                    <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                      {t('eventDetails.participationStatus.participating')}
                    </Text>
                    {participationsByStatus.participating.map((player) => (
                      <TouchableOpacity
                        key={player.documentId}
                        onPress={() => handleUserPress(player)}
                        style={[
                          ApplicationStyle.borderRadius24,
                          ApplicationStyle.backgroundColor.primary700,
                          Alignments.row,
                          Alignments.alignCenter,
                          Alignments.justifySpaceBetween,
                          Spaces.padding[16],
                          Spaces.gap[16],
                        ]}
                      >
                        <View
                          style={[
                            Alignments.row,
                            Spaces.gap[16],
                            Alignments.alignCenter,
                          ]}
                        >
                          <Image
                            source={
                              player.avatar
                                ? { uri: player?.avatar?.url }
                                : Images.roundAvatar
                            }
                            style={[
                              ApplicationStyle.roundIcon40,
                              ApplicationStyle.borderWidth1,
                              ApplicationStyle.borderColor.neutral00,
                            ]}
                          />
                          <Text
                            numberOfLines={1}
                            style={[Fonts.p1Bold, Fonts.neutral00]}
                          >
                            {`${player.firstname} ${player.lastname}`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {participationsByStatus.missing.length > 0 && (
                  <>
                    <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                      {t('eventDetails.participationStatus.missing')}
                    </Text>
                    {participationsByStatus.missing.map((player) => (
                      <TouchableOpacity
                        key={player.documentId}
                        onPress={() => handleUserPress(player)}
                        style={[
                          ApplicationStyle.borderRadius24,
                          ApplicationStyle.backgroundColor.primary700,
                          Alignments.row,
                          Alignments.alignCenter,
                          Alignments.justifySpaceBetween,
                          Spaces.padding[16],
                          Spaces.gap[16],
                        ]}
                      >
                        <View
                          style={[
                            Alignments.row,
                            Spaces.gap[16],
                            Alignments.alignCenter,
                          ]}
                        >
                          <Image
                            source={
                              player.avatar
                                ? { uri: player?.avatar?.url }
                                : Images.roundAvatar
                            }
                            style={[
                              ApplicationStyle.roundIcon40,
                              ApplicationStyle.borderWidth1,
                              ApplicationStyle.borderColor.neutral00,
                            ]}
                          />
                          <Text
                            numberOfLines={1}
                            style={[Fonts.p1Bold, Fonts.neutral00]}
                          >
                            {`${player.firstname} ${player.lastname}`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {participationsByStatus.notAnswered.length > 0 && (
                  <>
                    <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                      {t('eventDetails.participationStatus.notAnswered')}
                    </Text>
                    {participationsByStatus.notAnswered.map((player) => (
                      <TouchableOpacity
                        key={player.documentId}
                        onPress={() => handleUserPress(player)}
                        style={[
                          ApplicationStyle.borderRadius24,
                          ApplicationStyle.backgroundColor.primary700,
                          Alignments.row,
                          Alignments.alignCenter,
                          Alignments.justifySpaceBetween,
                          Spaces.padding[16],
                          Spaces.gap[16],
                        ]}
                      >
                        <View
                          style={[
                            Alignments.row,
                            Spaces.gap[16],
                            Alignments.alignCenter,
                          ]}
                        >
                          <Image
                            source={
                              player.avatar
                                ? { uri: player?.avatar?.url }
                                : Images.roundAvatar
                            }
                            style={[
                              ApplicationStyle.roundIcon40,
                              ApplicationStyle.borderWidth1,
                              ApplicationStyle.borderColor.neutral00,
                            ]}
                          />
                          <Text
                            numberOfLines={1}
                            style={[Fonts.p1Bold, Fonts.neutral00]}
                          >
                            {`${player.firstname} ${player.lastname}`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            ) : (
              event?.participations?.map((/** @type {User} */ player) => (
                <TouchableOpacity
                  key={player.documentId}
                  onPress={() => handleUserPress(player)}
                  style={[
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.backgroundColor.primary700,
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.padding[16],
                    Spaces.gap[16],
                  ]}
                >
                  <View
                    style={[
                      Alignments.row,
                      Spaces.gap[16],
                      Alignments.alignCenter,
                    ]}
                  >
                    <Image
                      source={
                        player.avatar
                          ? { uri: player?.avatar?.url }
                          : Images.roundAvatar
                      }
                      style={[
                        ApplicationStyle.roundIcon40,
                        ApplicationStyle.borderWidth1,
                        ApplicationStyle.borderColor.neutral00,
                      ]}
                    />
                    <Text
                      numberOfLines={1}
                      style={[Fonts.p1Bold, Fonts.neutral00]}
                    >
                      {`${player.firstname} ${player.lastname}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </WithDataWrapper>
      </ScrollView>

      <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
        {renderActionButtons()}
      </View>

      <JoinEventModal
        eventId={eventId}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
        onSuccess={() => {
          refetch();
          refetchParticipations();
        }}
      />

      <RefuseParticipationModal
        isVisible={isRefuseModalVisible}
        onClose={() => {
          setIsRefuseModalVisible(false);
          setSelectedParticipationId('');
        }}
        onSubmit={handleRefuseSubmit}
      />
      <ReportEventModal
        isLoading={isReportingEvent}
        isVisible={isReportModalVisible}
        onClose={handleCloseReportModal}
        onSubmit={handleSubmitReport}
      />
    </ScreenContainer>
  );
}

export default EventDetails;
