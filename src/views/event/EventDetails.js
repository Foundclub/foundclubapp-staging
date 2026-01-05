
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  useCallback, useLayoutEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { formatDateWithDayPrefix } from '@/utils/date';
import { getImageUrl } from '@/utils/imageUrl';

import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';
import { cancelEvent, missingEvent, remindUnansweredPlayers } from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
import {
  acceptEventParticipation,
  createEventParticipation,
  declineEventParticipation,
  deleteEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import { createEventReport } from '@/services/eventReport/eventReportService';
import { updateEvent } from '@/services/event/eventService';
import { 
  joinReservation, 
  bookFullReservation, 
  openForPlayers, 
  triggerSosAlert 
} from '@/services/reservation/reservationService';
import { USER_ROLES } from '@/domains/auth/authUseCases';

// Assets
const BG_MATCH = require('@/assets/background-card-event/card-match.png');
const BG_TRAINING = require('@/assets/background-card-event/card-entrainement.png');
const BG_DETECTION = require('@/assets/background-card-event/card-detection.png');
const BG_RESERVATION = require('@/assets/background-card-event/card-reservation.png');
const BG_OTHER = require('@/assets/background-card-event/card-autre.png');
const SHARE_ICON = require('@/assets/icons/share2.png');

/**
 * Get background image based on event type
 * @param {string} typeName
 */
const getBackgroundImage = (typeName) => {
  const normalizedType = typeName?.toLowerCase() || '';
  if (normalizedType.includes('match')) return BG_MATCH;
  if (normalizedType.includes('entrainement') || normalizedType.includes('entraînement')) return BG_TRAINING;
  if (normalizedType.includes('detection') || normalizedType.includes('détection')) return BG_DETECTION;
  if (normalizedType.includes('réservation') || normalizedType.includes('reservation')) return BG_RESERVATION;
  return BG_OTHER;
};

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
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  const { canEditEvent, userData } = useAuth();
  const queryClient = useQueryClient();

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

  /**
   * Mutation to create an event participation
   * @type {import('@tanstack/react-query').UseMutationResult<EventParticipation,
   * Error, {user: string, event: string, reason?: string}, unknown>}
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
      setIsJoinModalVisible(false);
    },
  });

  const { mutate: acceptParticipation } = useMutation({
    mutationFn: acceptEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
      setSelectedParticipationId('');
    },
  });

  const { mutate: declineParticipation } = useMutation({
    mutationFn: declineEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetchParticipations();
      setIsRefuseModalVisible(false);
      setSelectedParticipationId('');
    },
  });

  const { mutate: cancelEventMutation } = useMutation({
    mutationFn: cancelEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigation.goBack();
    },
  });

  const { mutate: remindEventMutation } = useMutation({
    mutationFn: remindUnansweredPlayers,
    onSuccess: () => {
      Alert.alert(
        t('eventDetails.modals.remindSuccess.title'),
        t('eventDetails.modals.remindSuccess.description'),
      );
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

  const { mutate: deleteParticipation } = useMutation({
    mutationFn: deleteEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
    },
  });

  /**
   * Mutation for marking an event as missing
   * @type {import('@tanstack/react-query').UseMutationResult<any, Error, string, unknown>}
   */
  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      navigation.goBack();
    },
  });

  // Mutation for joining a reservation
  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.joinSuccess.title', 'Participation confirmée'),
        t('reservation.joinSuccess.message', 'Vous participez maintenant à cette réservation !')
      );
    },
    onError: (error) => {
      console.error('Error joining reservation:', error);
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('reservation.joinError', 'Une erreur est survenue')
      );
    },
  });

  // Mutation for privatizing a reservation (book full)
  const bookFullMutation = useMutation({
    mutationFn: (reservationId) => bookFullReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.bookFull.success.title', 'Réservation privatisée'),
        t('reservation.bookFull.success.message', 'Votre réservation est maintenant complète.')
      );
    },
    onError: (error) => {
      console.error('Error privatizing reservation:', error);
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('reservation.bookFull.error', 'Une erreur est survenue')
      );
    },
  });

  // Mutation for opening reservation to players (crowdsourcing)
  const openForPlayersMutation = useMutation({
    mutationFn: ({ reservationId, targetPlayers }) => openForPlayers(reservationId, targetPlayers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.openForPlayers.success.title', 'Réservation ouverte'),
        t('reservation.openForPlayers.success.message', 'Les joueurs peuvent maintenant vous rejoindre !')
      );
    },
    onError: (error) => {
      console.error('Error opening reservation:', error);
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('reservation.openForPlayers.error', 'Une erreur est survenue')
      );
    },
  });

  // Mutation for triggering SOS alert
  const sosAlertMutation = useMutation({
    mutationFn: (reservationId) => triggerSosAlert(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.sosAlert.success.title', 'Alerte SOS lancée ! 🔥'),
        t('reservation.sosAlert.success.message', 'Les joueurs proches seront notifiés.')
      );
    },
    onError: (error) => {
      console.error('Error triggering SOS alert:', error);
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('reservation.sosAlert.error', 'Une erreur est survenue')
      );
    },
  });

  const handleAcceptRequest = () => {
    if (eventId) {
      updateEventMutation.mutate({
        documentId: eventId,
        eventData: {
          isFeatured: true,
          featuredRequestStatus: 'approved',
        },
      });
    }
  };

  const handleRejectRequest = () => {
    if (eventId) {
      updateEventMutation.mutate({
        documentId: eventId,
        eventData: {
          featuredRequestStatus: 'rejected',
        },
      });
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
      (/** @type {User} */ player) => !participatingPlayers.some(
        (participation) => participation.documentId === player.documentId,
      )
        && !missingPlayers.some((/** @type {User} */ missing) => missing.documentId === player.documentId),
    );

    return {
      missing: missingPlayers || [],
      notAnswered: notAnsweredPlayers || [],
      participating: participatingPlayers || [],
    };
  }, [event, canEditEvent]);

  // handlers

  const handleEditEvent = useCallback(() => {
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventEdit, params: { eventId } });
  }, [navigation, eventId]);

  const handleRemindPlayers = () => {
    if (eventId) {
      remindEventMutation(eventId);
    }
  };

  const handleJoinEvent = () => {
    setIsJoinModalVisible(true);
  };

  const handleParticipateToEvent = useCallback((/** @type {import('@/domains/event/types').FCEvent} */ ev) => {
    if (ev?.documentId && userData?.documentId) {
      createEventParticipationMutation.mutate({
        event: ev.documentId,
        user: userData.documentId,
      });
    }
  }, [createEventParticipationMutation, userData]);

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
    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.AuthStackAccount });
  };

  const handleCancelEvent = () => {
    if (!eventId) return;

    const cancelEventWithMode = (/** @type {'future' | 'all' | undefined} */ recurrenceMode = undefined) => {
      cancelEventMutation({ documentId: eventId, recurrenceMode });
    };

    if (event?.recurrenceGroupId) {
      Alert.alert(
        t('eventDetails.modals.recurrenceCancel.title', 'Suppression récurrente'),
        t('eventDetails.modals.recurrenceCancel.description', 'Cet événement fait partie d\'une série. Que voulez-vous supprimer ?'),
        [
          {
            text: t('eventDetails.modals.actions.cancel'),
            style: 'cancel',
          },
          {
            text: t('eventDetails.modals.recurrenceCancel.options.this', 'Cet événement'),
            onPress: () => cancelEventWithMode(),
            style: 'destructive',
          },
          {
            text: t('eventDetails.modals.recurrenceCancel.options.future', 'Cet événement et les suivants'),
            onPress: () => cancelEventWithMode('future'),
            style: 'destructive',
          },
          {
            text: t('eventDetails.modals.recurrenceCancel.options.all', 'Tous les événements'),
            onPress: () => cancelEventWithMode('all'),
            style: 'destructive',
          },
        ]
      );
    } else {
      Alert.alert(
        t('eventDetails.modals.cancelEvent.title'),
        t('eventDetails.modals.cancelEvent.description'),
        [
          {
            style: 'cancel',
            text: t('eventDetails.modals.actions.cancel'),
          },
          {
            onPress: () => cancelEventWithMode(),
            style: 'destructive',
            text: t('eventDetails.modals.actions.confirm'),
          },
        ],
      );
    }
  };

  const handleDeleteParticipation = useCallback(() => {
    const myParticipation = eventParticipations?.pages?.[0]?.data?.find(
      (participation) => participation.user.documentId === userData?.documentId,
    );

    const isUserMissing = event?.missings?.some(
      (missing) => missing.documentId === userData?.documentId,
    );

    if (myParticipation?.documentId) {
      // If user is participating, show alert about deleting participation
      Alert.alert(
        t('eventDetails.modals.deleteParticipation.title'),
        t('eventDetails.modals.deleteParticipation.description'),
        [
          {
            style: 'cancel',
            text: t('eventDetails.modals.actions.cancel'),
          },
          {
            onPress: () => {
              deleteParticipation(myParticipation.documentId || '');
            },
            style: 'destructive',
            text: t('eventDetails.modals.actions.confirm'),
          },
        ],
      );
    } else if (isUserMissing) {
      // If user is marked as missing, show alert about joining the event
      Alert.alert(
        t('eventDetails.modals.editResponse.title'),
        t('eventDetails.modals.editResponse.description'),
        [
          {
            style: 'cancel',
            text: t('eventDetails.modals.actions.cancel'),
          },
          {
            onPress: () => {
              if (event?.documentId && userData?.documentId) {
                createEventParticipationMutation.mutate({
                  event: event.documentId,
                  user: userData.documentId,
                });
              }
            },
            style: 'default', // Not destructive since they're joining
            text: t('eventDetails.modals.actions.confirm'),
          },
        ],
      );
    }
  }, [
    createEventParticipationMutation,
    deleteParticipation,
    event,
    eventParticipations,
    t,
    userData]);

  /**
   * Handle user press
   * @param {User} user
   */
  const handleUserPress = (user) => {
    if (user?.documentId) {
      if (user?.documentId === userData?.documentId) {
        navigation.navigate(RouteNames.ProfileStack);
      } else {
        // UserDetails is inside ProfileStack
        navigation.navigate(RouteNames.ProfileStack, {
          screen: RouteNames.UserDetails,
          params: { userId: user.documentId },
        });
      }
    }
  };

  const handleDeclineEvent = useCallback((/** @type {import('@/domains/event/types').FCEvent} */ ev) => {
    if (!ev?.documentId) return;
    missingEventMutation.mutate(ev.documentId);
  }, [missingEventMutation]);

  const handleShare = useCallback(async () => {
    if (!eventId) return;

    const url = `foundclub://event/${eventId}`;
    const simpleMessage = `${t('eventDetails.shareMessage', 'Rejoins-moi sur cet événement !')} ${url}`;

    try {
      if (Platform.OS === 'android') {
        await Share.share({
          message: simpleMessage,
        });
      } else {
        await Share.share({
          message: t('eventDetails.shareMessage', 'Rejoins-moi sur cet événement !'),
          url: url,
        });
      }
    } catch (error) {
      console.error('Share Error:', (/** @type {Error} */(error)).message);
      Alert.alert(t('common.error'), t('eventDetails.errors.shareFailed', 'Impossible de partager'));
    }
  }, [eventId, t]);

  // Handle opening tactical board (V2 - Selection first, then Board)
  const handleOpenTacticalBoard = useCallback(() => {
    if (!event?.documentId) return;
    
    // Get players from team
    const teamPlayers = event?.team?.players || [];
    
    // Get participants - participations may be user objects or have .user property
    const participants = (event?.participations || []).map((/** @type {any} */ p) => {
      // Handle both cases: direct user object or nested {user: {...}}
      if (p?.documentId && p?.firstname) return p; // Direct user object
      if (p?.user) return p.user; // Nested user
      return p; // Fallback
    }).filter(Boolean);
    
    // Combine and deduplicate players, serializing to plain objects
    const allPlayers = [...teamPlayers, ...participants].reduce((acc, player) => {
      if (!player) return acc;
      const id = player?.documentId || player?.id;
      if (id && !acc.find((/** @type {any} */ p) => p.id === id)) {
        // Extract avatar URL properly
        const avatarUrl = typeof player?.avatar === 'string' 
          ? player.avatar 
          : player?.avatar?.url || null;
          
        acc.push({
          id,
          documentId: player?.documentId,
          firstname: player?.firstname || '',
          lastname: player?.lastname || '',
          avatar: avatarUrl,
          number: player?.number || undefined,
        });
      }
      return acc;
    }, []);
    
    // Parse existing composition if available
    let existingComposition = null;
    try {
      if (event?.composition) {
        existingComposition = typeof event.composition === 'string' 
          ? JSON.parse(event.composition) 
          : event.composition;
      }
    } catch (e) {
      console.warn('Failed to parse composition:', e);
    }
    
    // Navigate to V2 Selection screen
    navigation.navigate(RouteNames.EventStack, {
      screen: RouteNames.TacticalSelectionV2,
      params: {
        eventId: event.documentId,
        sport: event?.team?.activities?.[0]?.name?.toLowerCase() || 
               event?.team?.section?.name?.toLowerCase() || 
               'football',
        players: allPlayers,
        existingComposition, // Pass existing composition for editing
        teamId: event?.team?.documentId, // Pass teamId for loading default composition
      },
    });
  }, [event, navigation]);

  // renderers

  const renderSuperAdminActions = () => {
    const isSuperAdmin = userData?.role?.name === USER_ROLES.superAdmin;
    const isPendingFeaturedRequest = event?.featuredRequestStatus === 'pending';

    if (isSuperAdmin && isPendingFeaturedRequest) {
      return (
        <View style={[Alignments.row, Spaces.gap[16]]}>
          <Button
            icon="check"
            isOption
            onPress={handleAcceptRequest}
            title="Valider"
            variant="Primary"
            style={{ flex: 1 }}
          />
          <Button
            icon="close"
            isOption
            onPress={handleRejectRequest}
            title="Refuser"
            variant="Secondary"
            style={{ flex: 1 }}
          />
        </View>
      );
    }
    return null;
  };

  /**
   * Renders the action button for joining an event
   * @returns {import('react').ReactElement} The rendered action button
   */
  const renderActionButtons = () => {
    const canEdit = canEditEvent(event?.team?.documentId || '');
    const hasDateInPast = event?.date ? new Date(event?.date) < new Date() : true;
    
    // Check if this is a reservation
    const isReservation = event?.type?.name?.toLowerCase()?.includes('réservation') 
      || event?.type?.name?.toLowerCase()?.includes('reservation');
    
    // Check if event type is a match/competition (for tactical board visibility)
    const isCompetitionType = ['match', 'compétition', 'tournoi', 'competition'].some(
      type => event?.type?.name?.toLowerCase()?.includes(type)
    );

    // Check if user already participates
    const userDocumentId = userData?.documentId;
    const hasAlreadyJoined = event?.participations?.some(p => p?.documentId === userDocumentId);
    
    if (!event || hasDateInPast) {
      return <View />;
    }

    // Reservation-specific rendering - uses JoinEventModal with risk acceptance
    if (isReservation) {
      // Check if user is the organizer
      const isOrganizer = event?.organizer?.documentId === userDocumentId;
      const bookingStatus = event?.bookingStatus || 'open';
      const isLastMinuteAlert = event?.isLastMinuteAlert || false;

      // Handle booking actions
      const handleBookFull = () => {
        Alert.alert(
          t('reservation.bookFull.confirm.title', 'Privatiser la réservation ?'),
          t('reservation.bookFull.confirm.message', 'Les joueurs inscrits seront conservés. Aucun nouveau joueur ne pourra rejoindre.'),
          [
            { text: t('common.cancel', 'Annuler'), style: 'cancel' },
            { 
              text: t('common.confirm', 'Confirmer'), 
              onPress: () => bookFullMutation.mutate(eventId) 
            },
          ]
        );
      };

      const handleOpenForPlayers = () => {
        Alert.alert(
          t('reservation.openForPlayers.confirm.title', 'Chercher des joueurs ?'),
          t('reservation.openForPlayers.confirm.message', 'Votre réservation sera visible et les joueurs pourront vous rejoindre.'),
          [
            { text: t('common.cancel', 'Annuler'), style: 'cancel' },
            { 
              text: t('common.confirm', 'Confirmer'), 
              onPress: () => openForPlayersMutation.mutate({ reservationId: eventId, targetPlayers: event?.totalPlayers }) 
            },
          ]
        );
      };

      const handleSosAlert = () => {
        Alert.alert(
          t('reservation.sosAlert.confirm.title', 'Lancer une alerte SOS ? 🔥'),
          t('reservation.sosAlert.confirm.message', 'Les joueurs proches seront notifiés en urgence.'),
          [
            { text: t('common.cancel', 'Annuler'), style: 'cancel' },
            { 
              text: t('common.confirm', 'Lancer SOS'), 
              style: 'destructive',
              onPress: () => sosAlertMutation.mutate(eventId) 
            },
          ]
        );
      };

      return (
        <View style={[Spaces.gap[12]]}>
          {/* Status indicator for organizer */}
          {isOrganizer && (
            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
              {bookingStatus === 'open' && (
                <View style={{ backgroundColor: 'rgba(100, 181, 246, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                  <Text style={[Fonts.p2, { color: '#64B5F6' }]}>🟢 Ouvert</Text>
                </View>
              )}
              {bookingStatus === 'shared' && (
                <View style={{ backgroundColor: 'rgba(255, 193, 7, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                  <Text style={[Fonts.p2, { color: '#FFC107' }]}>👥 Joueurs recherchés</Text>
                </View>
              )}
              {bookingStatus === 'booked' && (
                <View style={{ backgroundColor: 'rgba(76, 175, 80, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                  <Text style={[Fonts.p2, { color: '#4CAF50' }]}>✅ Complet</Text>
                </View>
              )}
              {isLastMinuteAlert && (
                <View style={{ backgroundColor: 'rgba(255, 107, 53, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                  <Text style={[Fonts.p2, { color: '#FF6B35' }]}>🔥 SOS actif</Text>
                </View>
              )}
            </View>
          )}

          {/* Participant actions */}
          {hasAlreadyJoined ? (
            <Button
              disabled
              title={t('reservation.alreadyJoined', 'Je participe !')}
              variant="Primary"
            />
          ) : bookingStatus !== 'booked' && (
            <Button
              isLoading={createEventParticipationMutation.isPending}
              onPress={handleJoinEvent}
              title={t('reservation.actions.join', 'Réserver')}
              variant="Primary"
            />
          )}

          {/* Organizer booking actions */}
          {isOrganizer && (
            <View style={[Spaces.gap[8]]}>
              {/* Status-dependent actions */}
              {bookingStatus === 'open' && (
                <View style={[Alignments.row, Spaces.gap[8]]}>
                  <Button
                    icon="lock"
                    isLoading={bookFullMutation.isPending}
                    onPress={handleBookFull}
                    style={{ flex: 1 }}
                    title={t('reservation.actions.privatize', 'Privatiser')}
                    variant="Secondary"
                  />
                  <Button
                    icon="users"
                    isLoading={openForPlayersMutation.isPending}
                    onPress={handleOpenForPlayers}
                    style={{ flex: 1 }}
                    title={t('reservation.actions.findPlayers', 'Chercher joueurs')}
                    variant="Primary"
                  />
                </View>
              )}
              {bookingStatus === 'shared' && (
                <View style={[Alignments.row, Spaces.gap[8]]}>
                  <Button
                    icon="lock"
                    isLoading={bookFullMutation.isPending}
                    onPress={handleBookFull}
                    style={{ flex: 1 }}
                    title={t('reservation.actions.privatize', 'Privatiser')}
                    variant="Secondary"
                  />
                  {!isLastMinuteAlert && (
                    <Button
                      icon="alert"
                      isLoading={sosAlertMutation.isPending}
                      onPress={handleSosAlert}
                      style={{ flex: 1, backgroundColor: '#FF6B35' }}
                      title={t('reservation.actions.sos', 'SOS 🔥')}
                      variant="Primary"
                    />
                  )}
                </View>
              )}
              {bookingStatus === 'booked' && (
                <View style={[Alignments.row, Spaces.gap[8]]}>
                  <Button
                    icon="users"
                    isLoading={openForPlayersMutation.isPending}
                    onPress={handleOpenForPlayers}
                    style={{ flex: 1 }}
                    title={t('reservation.actions.openAgain', 'Ouvrir aux joueurs')}
                    variant="Secondary"
                  />
                  {!isLastMinuteAlert && (
                    <Button
                      icon="alert"
                      isLoading={sosAlertMutation.isPending}
                      onPress={handleSosAlert}
                      style={{ flex: 1, backgroundColor: '#FF6B35' }}
                      title={t('reservation.actions.sos', 'SOS 🔥')}
                      variant="Primary"
                    />
                  )}
                </View>
              )}
            </View>
          )}

          {/* Edit/Cancel for organizer */}
          {canEdit && (
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                icon="edit"
                isOption
                onPress={handleEditEvent}
                style={{ flex: 1 }}
                title={t('common.actions.edit', 'Modifier')}
                variant="Secondary"
              />
              <Button
                icon="close"
                isOption
                onPress={handleCancelEvent}
                style={{ flex: 1 }}
                title={t('common.actions.cancel', 'Annuler')}
                variant="Secondary"
              />
            </View>
          )}
        </View>
      );
    }

    // Regular event rendering
    return (
      <View>
        <EventAnswerButtons
          event={event}
          hasPendingRequest={hasPendingRequest}
          onCancel={canEdit ? handleCancelEvent : undefined}
          onDecline={() => handleDeclineEvent(event)}
          onDeleteParticipation={handleDeleteParticipation}
          onEdit={canEdit ? handleEditEvent : undefined}
          onJoin={handleJoinEvent}
          onLogin={handleGoLogin}
          onParticipate={() => handleParticipateToEvent(event)}
        />
        {/* Tactical Board Button - visible only for trainers/managers and competition events */}
        {canEdit && isCompetitionType && (
          <View style={{ marginTop: 12 }}>
            <Button
              icon="users"
              onPress={handleOpenTacticalBoard}
              title="Gérer la Compo"
              variant="Secondary"
            />
          </View>
        )}
      </View>
    );
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

  const backgroundImage = getBackgroundImage(event?.type?.name);

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
          <ImageBackground
            source={/** @type {any} */ (backgroundImage)}
            imageStyle={{ borderRadius: 24 }}
            resizeMode="cover"
            style={[
              ApplicationStyle.borderRadius24,
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
              {event?.team?.club?.logo?.url ? (
                <ProfileAvatar
                  imageUrl={event.team.club.logo.url}
                  size={60}
                  style={[
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral00,
                    { borderRadius: 60 },
                  ]}
                  imageStyle={{ borderRadius: 60 }}
                />
              ) : (
                <TeamShield
                  initials={
                    event?.team?.club?.name
                      ? getClubInitials(event?.team?.club?.name || '')
                      : ''
                  }
                  isSmall
                />
              )}
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
                  <Text style={[Fonts.p2, Fonts.primary100, { maxWidth: '90%' }]}>
                    {(() => {
                      try {
                        const parsed = JSON.parse(event.locationDetails);
                        const addr = parsed?.address;
                        return (typeof addr === 'object' ? addr?.description : addr) || '';
                      } catch (e) {
                        return '';
                      }
                    })()}
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
                      <Text style={[Fonts.p2, Fonts.neutral00]}>
                        {formatDateWithDayPrefix(event.date)}
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
                        {event?.startTime && event?.endTime
                          ? `${event.startTime.substring(0, 5)} - ${event.endTime.substring(0, 5)}`
                          : format(new Date(event.date), 'HH:mm')}
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
          </ImageBackground>
          
          {/* Sponsors Section */}
          {(event?.team?.club?.sponsor?.length > 0) && (
            <ScrollView
              contentContainerStyle={[Spaces.gap[16]]}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[Spaces.marginTop[8], Spaces.marginBottom[8]]}
            >
              {event?.team?.club?.sponsor?.map((/** @type {any} */ sponsor) => (
                <View
                  key={sponsor.link || sponsor.title}
                  style={[Alignments.relative, Spaces.marginTop[8], Spaces.marginRight[16]]}
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
                    {sponsor?.logo?.url ? (
                      <Image
                        source={{ uri: getImageUrl(sponsor.logo.url) }}
                        style={[
                          ApplicationStyle.roundIcon55,
                          ApplicationStyle.borderWidth1,
                          ApplicationStyle.borderColor.neutral00,
                        ]}
                      />
                    ) : (
                      <View style={[
                        ApplicationStyle.roundIcon55,
                        ApplicationStyle.borderWidth1,
                        ApplicationStyle.borderColor.neutral00,
                        Alignments.justifyCenter,
                        Alignments.alignCenter,
                        { backgroundColor: '#FFFFFF' }
                      ]}>
                        <Text style={[Fonts.h4Bold, { color: '#000000' }]}>
                          {sponsor.title ? sponsor.title.charAt(0).toUpperCase() : '?'}
                        </Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[4], { maxWidth: 60, textAlign: 'center' }]}>
                      {sponsor.title}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Description section */}
          {event?.description ? (
            <View style={[Spaces.gap[16], Alignments.fill]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                {t('eventDetails.fields.description')}
              </Text>
              <Text style={[Fonts.p1, Fonts.primary100]}>
                {event?.description}
              </Text>
            </View>
          ) : null}
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
                      Alignments.fill,
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
                        Alignments.fill,
                      ]}
                    >
                      <ProfileAvatar
                        imageUrl={participation.user.avatar?.url}
                        size={40}
                        style={[
                          ApplicationStyle.borderWidth1,
                          ApplicationStyle.borderColor.neutral00,
                          { borderRadius: 40 },
                        ]}
                        imageStyle={{ borderRadius: 40 }}
                      />
                      <Text
                        numberOfLines={2}
                        style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}
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

          {/* Participation section header with Share button */}
          <View style={[
            Spaces.gap[16],
            Alignments.fill,
          ]}
          >
            <View style={[
              Alignments.row,
              Alignments.justifySpaceBetween,
              Alignments.alignCenter,
            ]}
            >
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                {t('eventDetails.fields.participations')}
                <Text>
                  {` :  ${event?.participations?.length || 0} ${event?.capacity ? ' / ' : ''} ${event?.capacity || ''
                    }`}
                </Text>
              </Text>
              <TouchableOpacity
                onPress={handleShare}
              >
                <Image
                  source={/** @type {any} */ (SHARE_ICON)}
                  style={{
                    height: 48,
                    width: 48,
                  }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
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
                          Alignments.fill,
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
                            { flex: 0.7 },
                          ]}
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
                          <Text
                            numberOfLines={2}
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
                    {participationsByStatus.missing.map((/** @type {User} */ player) => (
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
                    <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                    >
                      <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                        {t('eventDetails.participationStatus.notAnswered')}
                      </Text>
                      <Button
                        isOption
                        onPress={handleRemindPlayers}
                        title={t('eventDetails.actions.remind')}
                        variant="Primary"
                      />
                    </View>
                    {participationsByStatus.notAnswered.map((/** @type {User} */ player) => (
                      <TouchableOpacity
                        key={player.documentId}
                        onPress={() => handleUserPress(player)}
                        style={[
                          ApplicationStyle.borderRadius24,
                          ApplicationStyle.backgroundColor.primary700,
                          Alignments.row,
                          Alignments.alignCenter,
                          Alignments.fill,
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
                            { flex: 0.7 },
                          ]}
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
                          <Text
                            numberOfLines={2}
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
                    Alignments.fill,
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
                      { flex: 0.7 },
                    ]}
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
                    <Text
                      numberOfLines={2}
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
        {renderSuperAdminActions() || renderActionButtons()}
      </View>

      <JoinEventModal
        clubName={event?.team?.club?.name || ''}
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={eventId}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
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
