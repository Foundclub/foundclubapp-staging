import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import {
  cancelEvent,
  markCoachArrival,
  markSelfArrival,
  missingEvent,
  remindUnansweredPlayers,
  requestFeatured,
  updateCoachLateMinutes,
  updateEvent,
} from '@/services/event/eventService';
import {
  acceptEventParticipation,
  createEventParticipation,
  declineEventParticipation,
  deleteEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import { createEventReport } from '@/services/eventReport/eventReportService';
import {
  bookFullReservation,
  joinReservation,
  openForPlayers,
  triggerSosAlert,
} from '@/services/reservation/reservationService';

export const useEventMutations = (eventId, refetch, refetchParticipations) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const invalidatePersonalPlanning = () => {
    queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
  };
  const invalidateEventParticipationState = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    if (eventId) {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] });
    }
    invalidatePersonalPlanning();
  };

  // --- Participation Mutations ---

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  const acceptParticipationMutation = useMutation({
    mutationFn: acceptEventParticipation,
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  const declineParticipationMutation = useMutation({
    mutationFn: declineEventParticipation,
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  const deleteParticipationMutation = useMutation({
    mutationFn: deleteEventParticipation,
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        error?.message || t('errors.EVENT_PARTICIPATION_DELETE_ERROR'),
      );
    },
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  // --- Event Management Mutations ---

  const cancelEventMutation = useMutation({
    mutationFn: cancelEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      navigation.goBack();
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      refetch();
      // Only go back if full update? Maybe context dependent.
      // The original code did navigation.goBack() on success.
      // But some updates like "Feature" might not want to go back?
      // Original code: navigation.goBack().
      // But for Featured Request actions (approve/reject), we might want to stay?
      // In original code, updateEventMutation was used for general update AND featured approval.
      // If used for featured approval, we probably shouldn't go back.
      // Let's keep separate mutations or handle navigation outside.
      // For now, mirroring original behavior but beware.
      // ACTUALLY: The original `updateEventMutation` had `navigation.goBack()`.
      // But `handleAcceptRequest` uses it. Does that mean approving a request closes the screen?
      // Yes, likely intended to return to list.
      navigation.goBack();
    },
  });

  // Separate mutation for updates that SHOULD NOT navigate back (like Feature requests, simple toggles)
  // or we pass a callback.
  const updateEventNoNavMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      refetch();
    },
  });

  const remindEventMutation = useMutation({
    mutationFn: remindUnansweredPlayers,
    onSuccess: () => {
      Alert.alert(
        t('eventDetails.modals.remindSuccess.title'),
        t('eventDetails.modals.remindSuccess.description'),
      );
    },
  });

  const reportEventMutation = useMutation({
    mutationFn: createEventReport,
    onSuccess: () => {
      Alert.alert(
        t('eventDetails.modals.reportSuccess.title'),
        t('eventDetails.modals.reportSuccess.description'),
      );
    },
  });

  // --- Reservation Mutations ---

  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.joinError'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('reservation.joinSuccess.title', 'Participation confirmee'),
        t('reservation.joinSuccess.message', 'Vous participez maintenant a cette reservation.'),
      );
    },
  });

  const bookFullMutation = useMutation({
    mutationFn: (reservationId) => bookFullReservation(reservationId),
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.bookFull.error'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('reservation.bookFull.success.title', 'Reservation privatisee'),
        t('reservation.bookFull.success.message', 'Votre reservation est maintenant complete.'),
      );
    },
  });

  const openForPlayersMutation = useMutation({
    mutationFn: ({ reservationId, targetPlayers }) => openForPlayers(reservationId, targetPlayers),
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.openForPlayers.error'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('reservation.openForPlayers.success.title', 'Reservation ouverte'),
        t('reservation.openForPlayers.success.message', 'Les joueurs peuvent maintenant vous rejoindre !'),
      );
    },
  });

  const sosAlertMutation = useMutation({
    mutationFn: (reservationId) => triggerSosAlert(reservationId),
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.sosAlert.error'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.sosAlert.success.title', 'Alerte SOS lancee'),
        t('reservation.sosAlert.success.message', 'Les joueurs proches seront notifies.'),
      );
    },
  });

  const selfArrivalMutation = useMutation({
    mutationFn: ({ eventId: targetEventId, payload }) => markSelfArrival(targetEventId, payload),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        error?.message || "Impossible d'enregistrer votre arrivée.",
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats'] });
      refetch();
      refetchParticipations();
    },
  });

  const coachArrivalMutation = useMutation({
    mutationFn: ({ eventId: targetEventId, payload, userId }) => markCoachArrival(targetEventId, userId, payload),
    onError: () => {
      Alert.alert(t('common.error'), "Impossible d'enregistrer l'arrivée.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats'] });
      refetch();
      refetchParticipations();
    },
  });

  const updateLateMinutesMutation = useMutation({
    mutationFn: ({ eventId: targetEventId, payload, userId }) => updateCoachLateMinutes(targetEventId, userId, payload),
    onError: () => {
      Alert.alert(t('common.error'), 'Impossible de modifier le retard.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats'] });
      refetch();
      refetchParticipations();
    },
  });

  const requestFeaturedMutation = useMutation({
    mutationFn: requestFeatured,
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('eventDetails.featuredRequest.error'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('eventDetails.featuredRequest.success.title', 'Demande envoyée'),
        t('eventDetails.featuredRequest.success.message', 'Votre demande de mise à la une a été envoyée au dirigeant du club.'),
      );
    },
  });

  return {
    acceptParticipationMutation,
    bookFullMutation,
    cancelEventMutation,
    coachArrivalMutation,
    createEventParticipationMutation,
    declineParticipationMutation,
    deleteParticipationMutation,
    joinReservationMutation,
    missingEventMutation,
    openForPlayersMutation,
    remindEventMutation,
    reportEventMutation,
    requestFeaturedMutation,
    selfArrivalMutation,
    sosAlertMutation,
    updateEventMutation,
    updateEventNoNavMutation,
    updateLateMinutesMutation,
  };
};
