
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

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
  joinReservation,
  bookFullReservation,
  openForPlayers,
  triggerSosAlert,
} from '@/services/reservation/reservationService';

export const useEventMutations = (eventId, refetch, refetchParticipations) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  // --- Participation Mutations ---

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
    },
  });

  const acceptParticipationMutation = useMutation({
    mutationFn: acceptEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
    },
  });

  const declineParticipationMutation = useMutation({
    mutationFn: declineEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetchParticipations();
    },
  });

  const deleteParticipationMutation = useMutation({
    mutationFn: deleteEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
    },
  });

  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      refetchParticipations();
    },
  });

  // --- Event Management Mutations ---

  const cancelEventMutation = useMutation({
    mutationFn: cancelEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigation.goBack();
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
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
      refetch();
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.joinSuccess.title', 'Participation confirmÃ©e'),
        t('reservation.joinSuccess.message', 'Vous participez maintenant Ã  cette rÃ©servation !')
      );
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.joinError'));
    },
  });

  const bookFullMutation = useMutation({
    mutationFn: (reservationId) => bookFullReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.bookFull.success.title', 'RÃ©servation privatisÃ©e'),
        t('reservation.bookFull.success.message', 'Votre rÃ©servation est maintenant complÃ¨te.')
      );
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.bookFull.error'));
    },
  });

  const openForPlayersMutation = useMutation({
    mutationFn: ({ reservationId, targetPlayers }) => openForPlayers(reservationId, targetPlayers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.openForPlayers.success.title', 'RÃ©servation ouverte'),
        t('reservation.openForPlayers.success.message', 'Les joueurs peuvent maintenant vous rejoindre !')
      );
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.openForPlayers.error'));
    },
  });

  const sosAlertMutation = useMutation({
    mutationFn: (reservationId) => triggerSosAlert(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.sosAlert.success.title', 'Alerte SOS lancÃ©e ! ðŸ”¥'),
        t('reservation.sosAlert.success.message', 'Les joueurs proches seront notifiÃ©s.')
      );
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('reservation.sosAlert.error'));
    },
  });

  const selfArrivalMutation = useMutation({
    mutationFn: ({ eventId, payload }) => markSelfArrival(eventId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats'] });
      refetch();
      refetchParticipations();
    },
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        error?.message || "Impossible d'enregistrer votre arrivée."
      );
    },
  });

  const coachArrivalMutation = useMutation({
    mutationFn: ({ eventId, userId, payload }) => markCoachArrival(eventId, userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats'] });
      refetch();
      refetchParticipations();
    },
    onError: () => {
      Alert.alert(t('common.error'), "Impossible d'enregistrer l'arrivÃ©e.");
    },
  });

  const updateLateMinutesMutation = useMutation({
    mutationFn: ({ eventId, userId, payload }) => updateCoachLateMinutes(eventId, userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats'] });
      refetch();
      refetchParticipations();
    },
    onError: () => {
      Alert.alert(t('common.error'), "Impossible de modifier le retard.");
    },
  });

  const requestFeaturedMutation = useMutation({
    mutationFn: requestFeatured,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      Alert.alert(
        t('eventDetails.featuredRequest.success.title', 'Demande envoyÃ©e'),
        t('eventDetails.featuredRequest.success.message', 'Votre demande de mise Ã  la une a Ã©tÃ© envoyÃ©e au dirigeant du club.')
      );
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error?.message || t('eventDetails.featuredRequest.error'));
    },
  });

  return {
    createEventParticipationMutation,
    acceptParticipationMutation,
    declineParticipationMutation,
    deleteParticipationMutation,
    missingEventMutation,
    cancelEventMutation,
    updateEventMutation,
    updateEventNoNavMutation,
    remindEventMutation,
    reportEventMutation,
    joinReservationMutation,
    bookFullMutation,
    openForPlayersMutation,
    sosAlertMutation,
    selfArrivalMutation,
    coachArrivalMutation,
    updateLateMinutesMutation,
    requestFeaturedMutation,
  };
};
