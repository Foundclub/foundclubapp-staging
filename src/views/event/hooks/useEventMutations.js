import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { aggregateRemindReports } from '@/domains/event/aggregateRemindReports';
import { buildRemindMessage, REMIND_EVENT_MUTATION_KEY } from '@/domains/event/remindReport';
import { getParticipationErrorMessage } from '@/domains/participation/participationFlow';

import {
  cancelEvent,
  declareSelfLate,
  markCoachArrival,
  markSelfArrival,
  missingEvent,
  remindUnansweredPlayers,
  requestFeatured,
  resetCoachAttendance,
  respondToEventRsvp,
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
import { saveEventMatchResult } from '@/services/matchStats/matchStatsService';
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
    queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
    queryClient.invalidateQueries({ queryKey: ['myApplications'] });
    if (eventId) {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] });
      // 🧊 S1 (constat d Adel du 2026-08-25) — LE BADGE « ARRIVE » FANTOME.
      //
      // Changer sa reponse change AUSSI ce que le pointage raconte : le serveur
      // range le `rsvpStatus` de l instantane de pointage a cote du pointage
      // lui-meme. Sans cette clef, l ecran gardait l ancien instantane et
      // affichait « Arrive » a quelqu un qui venait de se declarer absent.
      //
      // 🎯 POSE DANS LA FONCTION PARTAGEE, pas dans la seule mutation
      // d absence : les cinq portes de participation passent par ici. Ne
      // reparer que celle du constat aurait laisse quatre freres casses.
      // Le motif se recopie tel quel des mutations de pointage, plus bas.
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
    }
    invalidatePersonalPlanning();
  };

  // --- Participation Mutations ---

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(
          error,
          "Impossible d'enregistrer ta participation pour le moment.",
        ),
      );
    },
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  const acceptParticipationMutation = useMutation({
    mutationFn: acceptEventParticipation,
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(
          error,
          'Impossible de valider cette participation pour le moment.',
        ),
      );
    },
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  const declineParticipationMutation = useMutation({
    mutationFn: declineEventParticipation,
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(
          error,
          'Impossible de refuser cette participation pour le moment.',
        ),
      );
    },
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
        getParticipationErrorMessage(error, t('APIerrors.EVENT_PARTICIPATION_DELETE_ERROR')),
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
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, "Impossible d'enregistrer ton absence pour le moment."),
      );
    },
    onSuccess: () => {
      invalidateEventParticipationState();
      refetch();
      refetchParticipations();
    },
  });

  // AD01 (✍️) — LE SCORE EN DEUX CHIFFRES.
  //
  // `saveEventMatchResult` existait de bout en bout — service, route serveur,
  // regle metier — avec ZERO appelant : pour ecrire « 3-1 », un coach devait
  // ouvrir `MatchStatsEditor` et ses 1 615 lignes.
  //
  // 🏠 Il entre ici, et pas en import direct dans `EventDetails.js`, parce que
  // c'est ici que vivent TOUTES les ecritures de cet ecran. Le detail compte :
  // chaque module de service importe par `EventDetails` doit etre double dans
  // CHACUN de ses 16 fichiers de temoins, faute de quoi le vrai
  // `@/services/client` se charge et refuse de demarrer sans `API_URL`. Ce hook
  // est deja double partout ⇒ un appelant de plus ne coute rien a personne.
  //
  // ⛔ Le rafraichissement est laisse a l'appelant (`refetchMatchStats`) : c'est
  // la requete des stats qui porte le score, pas celle de l'evenement.
  const saveMatchResultMutation = useMutation({
    mutationFn: (/** @type {any} */ variables) => saveEventMatchResult(variables?.eventId, {
      scoreAgainst: variables?.scoreAgainst,
      scoreFor: variables?.scoreFor,
      teamId: variables?.teamId,
    }),
  });

  const respondToEventRsvpMutation = useMutation({
    mutationFn: ({ answer, eventId: targetEventId }) => respondToEventRsvp(targetEventId, answer),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, "Impossible d'enregistrer ta réponse pour le moment."),
      );
    },
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

  // AC07 — la relance dit ce qui s est REELLEMENT passe.
  //
  // Avant : `onSuccess` affichait « Ta relance a bien ete envoyee » sans
  // regarder la reponse, et il n y avait AUCUN `onError`. Un coach qui appuyait
  // deux fois en 48 h lisait donc deux fois « c est parti » alors que
  // l anti-spam avait tout ecarte ; et une relance en panne ne disait rien.
  //
  // La `mutationKey` n est pas decorative : c est par elle que le bouton se
  // grise pendant l envoi (`EventParticipants`), sans avoir a faire descendre
  // un drapeau depuis l ecran.
  // 🎯 N4 (D3) — RELANCER PLUSIEURS EQUIPES, SANS MUTATION NEUVE.
  //
  // 🧨 LE FAIT SERVEUR : `/remind-unanswered-players` n accepte qu UN SEUL
  // `teamId` par appel. Deux equipes cochees = deux POST. La boucle vit donc
  // DANS le `mutationFn`, et surtout PAS dans une mutation de plus :
  //   · 13 suites de temoins montent `useEventMutations` avec une liste FIGEE
  //     de mutations — en ajouter une les fait toutes tomber d un coup ;
  //   · une SEULE cle de mutation, c est un SEUL etat `isPending` : le grisage
  //     du bouton (AC07) et le motif anti-spam (AE02) restent alimentes par la
  //     meme clef, sans rien faire descendre depuis l ecran.
  //
  // ⛔ LA CHARGE EN CHAINE RESTE ACCEPTEE, telle quelle. C est ce qui garde les
  // 4 temoins d AC07 verts SANS UNE LIGNE REECRITE : `mutate('evt-1')` fait
  // exactement ce qu il faisait, un seul appel et une seule modale.
  const remindEventMutation = useMutation({
    mutationFn: async (/** @type {any} */ charge) => {
      const equipes = Array.isArray(charge?.teamIds) ? charge.teamIds.filter(Boolean) : [];
      // Chaine, ou objet a une seule equipe : le chemin d avant, intact.
      if (!equipes.length) return remindUnansweredPlayers(charge);

      // 🚨 SEQUENTIELS, pas en parallele : l anti-spam de 48 h se decide cote
      // serveur, et deux appels concurrents sur le meme evenement se liraient
      // l un l autre a moitie ecrits.
      const entrees = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const teamId of equipes) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const report = await remindUnansweredPlayers({ eventId: charge.eventId, teamId });
          entrees.push({ echec: false, report, teamId });
        } catch (erreur) {
          // Un echec sur UNE equipe ne jette pas le compte rendu des autres :
          // il devient une ligne `echec` (voir `aggregateRemindReports`).
          entrees.push({ echec: true, report: null, teamId });
        }
      }

      return aggregateRemindReports(entrees);
    },
    mutationKey: REMIND_EVENT_MUTATION_KEY,
    onError: (error, /** @type {any} */ variables) => {
      // D4 : la feuille affiche elle-meme son compte rendu (1H). Deux fenetres
      // pour un seul geste, ce serait la modale par-dessus la feuille.
      if (variables?.presentation === 'sheet') return;
      // La CONSEQUENCE est collee a la raison : le serveur explique pourquoi,
      // mais c est « personne n a ete prevenu » qui manquait — et c est la
      // seule phrase qui empeche le coach de croire sa relance partie.
      const raison = getParticipationErrorMessage(error, 'Le serveur n a pas repondu.');
      Alert.alert(
        'La relance n a pas pu partir',
        `${raison} Personne n a ete prevenu : reessaie dans un instant.`,
      );
    },
    onSuccess: (report, /** @type {any} */ variables) => {
      if (variables?.presentation === 'sheet') return;
      const message = buildRemindMessage(report);
      Alert.alert(message.title, message.description);
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
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, t('reservation.joinError')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('reservation.joinSuccess.title', 'Participation confirmée'),
        t('reservation.joinSuccess.message', 'Tu participes maintenant à cette réservation.'),
      );
    },
  });

  const bookFullMutation = useMutation({
    mutationFn: (reservationId) => bookFullReservation(reservationId),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, t('reservation.bookFull.error')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('reservation.bookFull.success.title', 'Réservation privatisee'),
        t('reservation.bookFull.success.message', 'Ta réservation est maintenant complète.'),
      );
    },
  });

  const openForPlayersMutation = useMutation({
    mutationFn: ({ reservationId, targetPlayers }) => openForPlayers(reservationId, targetPlayers),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, t('reservation.openForPlayers.error')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('reservation.openForPlayers.success.title', 'Réservation ouverte'),
        t('reservation.openForPlayers.success.message', 'Les joueurs peuvent maintenant te rejoindre !'),
      );
    },
  });

  const sosAlertMutation = useMutation({
    mutationFn: (reservationId) => triggerSosAlert(reservationId),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, t('reservation.sosAlert.error')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      refetch();
      Alert.alert(
        t('reservation.sosAlert.success.title', 'Alerte SOS lancée'),
        t('reservation.sosAlert.success.message', 'Les joueurs proches seront notifies.'),
      );
    },
  });

  const selfArrivalMutation = useMutation({
    mutationFn: ({ eventId: targetEventId, payload }) => markSelfArrival(targetEventId, payload),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, "Impossible d'enregistrer ton arrivée."),
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

  const selfLateMutation = useMutation({
    mutationFn: ({ eventId: targetEventId, payload }) => declareSelfLate(targetEventId, payload),
    onError: (error) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, "Impossible d'enregistrer ton retard."),
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

  const resetAttendanceMutation = useMutation({
    mutationFn: ({ eventId: targetEventId, userId }) => resetCoachAttendance(targetEventId, userId),
    onError: () => {
      Alert.alert(t('common.error'), 'Impossible de réinitialiser le pointage.');
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
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, t('eventDetails.featuredRequest.error')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      }
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] });
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] });
      invalidatePersonalPlanning();
      refetch();
      Alert.alert(
        t('eventDetails.featuredRequest.success.title', 'Demande envoyée'),
        t('eventDetails.featuredRequest.success.message', 'Ta demande de mise à la une a été envoyée pour validation.'),
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
    resetAttendanceMutation,
    respondToEventRsvpMutation,
    saveMatchResultMutation,
    selfArrivalMutation,
    selfLateMutation,
    sosAlertMutation,
    updateEventMutation,
    updateEventNoNavMutation,
    updateLateMinutesMutation,
  };
};
