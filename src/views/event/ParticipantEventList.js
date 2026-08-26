import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAfter, isSameDay, startOfDay } from 'date-fns';
import {
  Suspense,
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, FlatList, Image, InteractionManager, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  getParticipationErrorMessage,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import ErrorWrapper from '@/components/atoms/errorWrapper/ErrorWrapper';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import PersonalPlanningContainer from '@/components/organisms/planning/PersonalPlanningContainer';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  DateSlider,
  EventCardNew,
  FeaturedEvents,
  JoinEventModal,
  LeagueHeaderSwitch,
  NotificationBadge,
  ProfileButton,
} from '@/views/event/ParticipantEventListDeferred';
import PlanningOnboardingWrapper from '@/views/event/PlanningOnboardingWrapper';

import { getFloatingActionContainerStyle } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetEvents } from '@/services/event/eventQueries';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { joinReservation } from '@/services/reservation/reservationService';

import { createLogger } from '@/utils/logger/logger';

import { useEventAnswerMutations } from './hooks/useEventAnswerMutations';
import { OwnAnswerAction, resolveOwnAnswerAction } from './ownAnswerAction';

const participantEventListLogger = createLogger('participant-event-list');
const FEATURED_PLANNING_SCOPES = ['SECTION', 'CM'];

const isApprovedPlanningFeaturedEvent = (event) => (
  Boolean(event?.isFeatured)
  && event?.featuredRequestStatus === 'approved'
  && FEATURED_PLANNING_SCOPES.includes(String(event?.featuredScope || '').toUpperCase())
);

const mergeUniqueEvents = (...collections) => {
  const seen = new Set();

  return collections
    .flat()
    .filter((event) => {
      const eventId = String(event?.documentId || event?.id || '').trim();
      if (!eventId || seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    });
};

// La hauteur d une carte d evenement. Elle etait ecrite trois fois en clair
// dans ce fichier ; elle sert desormais aussi aux cartes en attente (D6), et
// c est justement parce que les deux valeurs doivent rester EGALES que la
// liste ne saute pas au moment ou les donnees arrivent.
const HAUTEUR_CARTE_EVENEMENT = 184;

/**
 * @param {{ height?: number, width?: import('react-native').ViewStyle['width'] }} props
 * @returns {import('react').ReactElement}
 */
function DeferredFallback({
  height = 0,
  width = '100%',
}) {
  return <View style={{ height, width }} />;
}

/**
 * Une carte en attente : la FORME de ce qui arrive.
 *
 * Elle remplace la petite phrase grise « Mise a jour des evenements... », qui
 * disait qu il se passait quelque chose sans jamais dire QUOI ni COMBIEN.
 * Sa hauteur est celle des vraies cartes : la liste ne saute donc pas quand
 * elles arrivent.
 *
 * ⛔ Pas de `SkeletonLoader` ici, et ce n est pas un oubli : il tire Reanimated,
 * MaskedView et LinearGradient, et il fait tourner une animation en boucle. Sur
 * l ecran qu on est justement en train d'alleger, une forme immobile suffit.
 * @returns {import('react').ReactElement}
 */
function CarteEnAttente() {
  const { ApplicationStyle } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
        { height: HAUTEUR_CARTE_EVENEMENT },
      ]}
      testID="planning-skeleton-card"
    />
  );
}

/**
 * Standard event list screen component for participants
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @returns {React.ReactElement} ParticipantEventList component
 */
function ParticipantEventList({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { canManageEvents, userData } = useAuth();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();

  // State
  const [listStartDate, setListStartDate] = useState(new Date());
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(undefined);
  const [shouldLoadEventFeed, setShouldLoadEventFeed] = useState(false);
  const [shouldLoadFeaturedFeed, setShouldLoadFeaturedFeed] = useState(Platform.OS !== 'web');
  const [isPlanningContentReady, setIsPlanningContentReady] = useState(Platform.OS !== 'web');
  const [shouldLoadSecondaryPlanningData, setShouldLoadSecondaryPlanningData] = useState(
    Platform.OS !== 'web',
  );
  const flatListRef = useRef(null);
  const listStartDateAfter = useMemo(() => startOfDay(listStartDate).toISOString(), [listStartDate]);

  // Hooks

  // S8 (D5) — ON NE DEMANDE PLUS TOUS LES PARTICIPANTS POUR N EN LIRE QU UN.
  //
  // Sans `viewerDocumentId`, le populate compact du serveur
  // (`eventService.js`, `buildViewerScopedUserRelation`) renvoie
  // `participations`, `missings` et `participationRequests` de TOUS les
  // participants, pour CHAQUE evenement de la page — alors que les cartes n y
  // cherchent que la ligne du spectateur. Avec, le serveur filtre : au plus une
  // ligne par evenement.
  //
  // ⚠️ CE QUE CA COUTE, ET IL FAUT LE SAVOIR : le compteur `participations.length`
  // que lisent la jauge « inscrits / capacite » et les gardes « evenement
  // complet » ne voit plus qu une ligne. `EventListContent` vit DEJA avec cette
  // degradation sur les MEMES cartes ; on fait pareil ici, sciemment.
  // ⚠️ Ca change aussi la CLE de la requete : le premier affichage part d'un
  // cache froid. Une seule fois.
  const userDocumentId = userData?.documentId;

  const myEventsQueryConfig = useMemo(() => ({
    compact: true,
    // @ts-ignore
    myTeams: true,
    sort: 'date:asc',
    startDateAfter: listStartDateAfter,
    ...(userDocumentId ? { viewerDocumentId: userDocumentId } : {}),
  }), [listStartDateAfter, userDocumentId]);

  // @ts-ignore
  const {
    data: eventsData,
    error: eventsError,
    fetchNextPage,
    hasNextPage,
    isError: isEventsError,
    isFetchingNextPage,
    isLoading: isEventsLoading,
    refetch: refetchEvents,
  } = useGetEvents(myEventsQueryConfig, {
    enabled: shouldLoadEventFeed,
  });

  const events = useMemo(() => eventsData?.pages.flatMap((page) => page.data) || [], [eventsData]);

  // Get user's club and CM IDs for featured events membership filtering
  const userClubId = userData?.club?.documentId;
  const userCmId = userData?.club?.parentMultisport?.documentId;

  const trainedSectionIds = userData?.trainedTeams?.map((t) => t.club?.documentId).filter(Boolean) || [];
  const trainedCmIds = userData?.trainedTeams?.map((t) => t.club?.parentMultisport?.documentId).filter(Boolean) || [];

  const playerSectionIds = userData?.myTeams?.map((t) => t.club?.documentId).filter(Boolean) || [];
  const playerCmIds = userData?.myTeams?.map((t) => t.club?.parentMultisport?.documentId).filter(Boolean) || [];

  const allClubIds = [
    userClubId,
    userCmId,
    ...trainedSectionIds,
    ...trainedCmIds,
    ...playerSectionIds,
    ...playerCmIds,
  ].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

  // Fetch SECTION/CM featured events for Mon Planning
  const featuredEventsQueryConfig = useMemo(() => ({
    compact: true,
    featuredRequestStatus: 'approved',
    featuredScope: ['SECTION', 'CM'],
    isFeatured: true,
    membershipClubIds: allClubIds.length ? allClubIds : undefined,
    pageSize: 5,
    sessionStatus: 'open',
    startDateAfter: listStartDateAfter,
    ...(userDocumentId ? { viewerDocumentId: userDocumentId } : {}),
  }), [allClubIds, listStartDateAfter, userDocumentId]);

  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
  } = useGetEvents(featuredEventsQueryConfig, {
    enabled: allClubIds.length > 0 && shouldLoadEventFeed && shouldLoadFeaturedFeed,
  });

  const featuredEvents = useMemo(
    () => (featuredData?.pages?.flatMap((page) => page.data) || []).filter(isApprovedPlanningFeaturedEvent),
    [featuredData],
  );
  const selectedParticipationFlow = useMemo(
    () => resolveParticipationFlow(selectedEvent, { user: userData }),
    [selectedEvent, userData],
  );

  useEffect(() => {
    const interactions = InteractionManager.runAfterInteractions(() => {
      if (Platform.OS !== 'web') {
        setShouldLoadEventFeed(true);
      }
    });

    return () => {
      interactions.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setShouldLoadSecondaryPlanningData(true);
      return undefined;
    }

    if (!isPlanningContentReady) {
      setShouldLoadSecondaryPlanningData(false);
      return undefined;
    }

    let isCancelled = false;

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;
    const interactions = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          setShouldLoadSecondaryPlanningData(true);
        }
      }, 180);
    });

    return () => {
      isCancelled = true;
      interactions.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isPlanningContentReady]);

  useEffect(() => {
    if (Platform.OS !== 'web' || shouldLoadEventFeed || !shouldLoadSecondaryPlanningData) {
      return undefined;
    }

    setShouldLoadEventFeed(true);
    return undefined;
  }, [shouldLoadEventFeed, shouldLoadSecondaryPlanningData]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setShouldLoadFeaturedFeed(true);
      return undefined;
    }

    if (!shouldLoadEventFeed) {
      setShouldLoadFeaturedFeed(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setShouldLoadFeaturedFeed(true);
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [shouldLoadEventFeed]);

  // Filter events for the list (starting from listStartDate)
  const listEvents = useMemo(() => (
    mergeUniqueEvents(featuredEvents, events)
      .filter((event) => {
        if (!event || !event.date) return false;
        const eventDate = new Date(event.date);

        // Date Filter
        const isDateValid = isSameDay(eventDate, listStartDate) || isAfter(eventDate, listStartDate);
        if (!isDateValid) return false;

        return true;
      })
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  ), [events, featuredEvents, listStartDate]);

  const queryClient = useQueryClient();

  /**
   * Mutation to create an event participation
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (error) => {
      const message = getParticipationErrorMessage(error, 'Une erreur est survenue.');
      Alert.alert('Erreur', message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      setIsJoinModalVisible(false);
      setJoinModalError('');
    },
  });
  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onError: (error) => {
      const message = getParticipationErrorMessage(error, 'Une erreur est survenue.');
      Alert.alert('Erreur', message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
      setIsJoinModalVisible(false);
      setJoinModalError('');
    },
  });

  // 🎯 T2 (constat d Adel du 2026-08-26) — « appuyer sur présent, ça ne marche pas ».
  //
  // Cet écran est le SEUL des quatre qui font répondre un joueur à n avoir
  // jamais reçu les deux correctifs d août (AA01 le 20/08, R9 le 25/08 —
  // `git show --stat` le prouve : les trois frères y sont, celui-ci non).
  // Il envoyait donc tout le monde sur `POST /event-participations`, la porte
  // des DEMANDES, où le serveur pose `pending` ; or il ne recopie dans
  // `event.participations` que les `accepted`. La carte affichait « Demande en
  // attente » là où le joueur attendait « Je participe ! ».
  //
  // 🎯 Les branches ci-dessous sont celles d `EventListContent` (:881-887 et
  // :943-953), à l identique — pas une réécriture. Les deux mutations viennent
  // d un hook partagé pour qu il n y ait pas de cinquième copie.
  const {
    missingEventMutation,
    respondToEventRsvpMutation,
    submittingAnswer,
    submittingEventId,
  } = useEventAnswerMutations();

  const handleParticipateToEvent = useCallback(async (event) => {
    const isStageDayEvent = String(event?.eventFormat || '').toLowerCase() === 'stage_day';
    if (isStageDayEvent && event?.documentId) {
      try {
        await respondToEventRsvpMutation.mutateAsync({
          answer: 'present',
          eventId: event.documentId,
        });
      } catch {
        // Error feedback is handled by the mutation.
      }
      return;
    }

    const participationFlow = resolveParticipationFlow(event, { user: userData });

    if (!participationFlow?.canAct) {
      Alert.alert('Erreur', participationFlow?.blockedReason || 'Cette action est indisponible.');
      return;
    }

    if (participationFlow?.kind === 'reservation-recruiting') {
      setJoinModalError('');
      setSelectedEvent(event);
      setIsJoinModalVisible(true);
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.parentEvent.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }

    // R9 — LE MÊME TROU QUE CHEZ LE FRÈRE, ET POUR LA MÊME RAISON.
    //
    // `handleJoinEvent`, plus bas dans ce fichier, porte cette branche depuis
    // longtemps ; ce gestionnaire-ci ne l avait pas, et c est LUI que la carte
    // appelle quand on répond « Présent ». Sans elle, on tombait sur le chemin
    // générique du bas : une participation SANS poste, qui verrouille ensuite
    // la candidature aux postes. Les postes vivent sur l écran de l événement.
    if (participationFlow?.submitMode === 'detection-slot-picker') {
      if (event?.documentId) {
        navigation.navigate(RouteNames.EventStack, {
          params: { eventId: event.documentId },
          screen: RouteNames.EventDetails,
        });
      }
      return;
    }

    // AA01 — LA BONNE PORTE : un membre convié RÉPOND, il ne demande pas.
    // `POST /events/:id/rsvp` l inscrit immédiatement (`event-rsvp.ts:161-166`).
    if (participationFlow?.submitMode === 'rsvpPresent' && event?.documentId) {
      try {
        await respondToEventRsvpMutation.mutateAsync({
          answer: 'present',
          eventId: event.documentId,
        });
      } catch {
        // Error feedback is handled by the mutation.
      }
      return;
    }

    if (event?.documentId && userData?.documentId) {
      try {
        await createEventParticipationMutation.mutateAsync({
          event: event.documentId,
          user: userData.documentId,
        });
      } catch (error) {
        Alert.alert('Erreur', getParticipationErrorMessage(error, 'Une erreur est survenue.'));
      }
    }
  }, [createEventParticipationMutation, navigation, respondToEventRsvpMutation, userData]);

  // 🔇 T2/D2 — « ABSENT·E » N ÉTAIT BRANCHÉ SUR RIEN.
  //
  // Les deux cartes de cet écran passaient `onDecline={() => {}}` : une
  // fonction VIDE. Le bouton s enfonçait, et il ne se passait rien — ni appel,
  // ni message, ni changement à l écran. C est la moitié « ça ne marche pas »
  // du constat d Adel, et elle ne se voyait dans AUCUN témoin.
  //
  // Le geste est celui du frère (`EventListContent.js:1011-1021`) : une séance
  // d un stage se répond par la porte des réponses, tout le reste passe par
  // `POST /events/:id/missing`.
  const handleDeclineEvent = useCallback((event) => {
    if (!event?.documentId) return;
    if (String(event?.eventFormat || '').toLowerCase() === 'stage_day') {
      respondToEventRsvpMutation.mutate({
        answer: 'absent',
        eventId: event.documentId,
      });
      return;
    }
    missingEventMutation.mutate(event.documentId);
  }, [missingEventMutation, respondToEventRsvpMutation]);

  const handleJoinEvent = useCallback((event) => {
    const participationFlow = resolveParticipationFlow(event, { user: userData });
    if (!participationFlow?.canAct) {
      Alert.alert('Erreur', participationFlow?.blockedReason || 'Cette action est indisponible.');
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.parentEvent.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }

    if (participationFlow?.submitMode === 'detection-slot-picker') {
      if (event?.documentId) {
        navigation.navigate(RouteNames.EventStack, {
          params: { eventId: event.documentId },
          screen: RouteNames.EventDetails,
        });
      }
      return;
    }

    setJoinModalError('');
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, [navigation, userData]);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setJoinModalError('');
    setSelectedEvent(undefined);
  }, []);

  const handleConfirmJoinEvent = useCallback(async () => {
    if (!selectedEvent?.documentId) {
      return;
    }

    const participationFlow = resolveParticipationFlow(selectedEvent, { user: userData });

    try {
      if (participationFlow?.kind === 'reservation-recruiting') {
        await joinReservationMutation.mutateAsync(selectedEvent.documentId);
        return;
      }

      if (!userData?.documentId) {
        return;
      }

      await createEventParticipationMutation.mutateAsync({
        event: selectedEvent.documentId,
        user: userData.documentId,
      });
    } catch (error) {
      setJoinModalError(getParticipationErrorMessage(error, 'Une erreur est survenue.'));
    }
  }, [
    createEventParticipationMutation,
    joinReservationMutation,
    selectedEvent,
    userData,
  ]);

  /**
   * Handle event press
   * @param {import('@/domains/event/types').FCEvent} event
   */
  const handleEventPress = useCallback((event) => {
    if (!event?.documentId) {
      participantEventListLogger.warn('Navigation blocked: missing event documentId');
      return;
    }
    participantEventListLogger.debug('Navigating to event détails', { eventDocumentId: event.documentId });
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  // ↩️ T2/D4 — ON PEUT ENFIN REVENIR EN ARRIÈRE.
  //
  // `EventAnswerButtons` n offre « Annuler ma réponse » que si l appelant lui
  // passe `onDeleteParticipation`, et `EventCardNew:636` le dérive
  // d `onEditAnswer`. Cet écran ne l a JAMAIS passé : qui avait répondu y
  // lisait une étiquette (« Je participe ! ») et n avait plus AUCUN bouton.
  // C est la moitié « on ne sait pas » du constat d Adel : pas de retour
  // visuel, et pas de sortie.
  //
  // ⛔ Ce que fait le bouton ne se décide pas ici : `resolveOwnAnswerAction`
  // le tranche déjà pour la fiche et pour la liste de recherche. Une seule
  // règle, trois surfaces — le libellé ne peut pas promettre autre chose que
  // ce que le geste fait.
  const handleEditAnswer = useCallback((event) => {
    const { kind } = resolveOwnAnswerAction({
      // `participationRequests` n est pas déclaré sur `FCEvent` alors que l API
      // le rend : le même accès existe déjà dans `EventAnswerButtons`.
      activeEventParticipations: /** @type {any} */ (event)?.participationRequests,
      event,
      user: userData,
    });

    if (kind === OwnAnswerAction.switchToPresent && event?.documentId) {
      respondToEventRsvpMutation.mutate({
        answer: 'present',
        eventId: event.documentId,
      });
      return;
    }

    // Annuler demande une confirmation et la suppression de la ligne : tout
    // cela vit déjà sur la fiche. On y emmène plutôt que d en écrire une
    // seconde version ici.
    handleEventPress(event);
  }, [handleEventPress, respondToEventRsvpMutation, userData]);

  /**
   * @param {{ item: import('@/domains/event/types').FCEvent }} props
   */
  const renderItem = ({ item }) => {
    if (item.reservation) {
      return (
        <View style={[Spaces.marginBottom[16]]}>
          <Suspense fallback={<DeferredFallback height={HAUTEUR_CARTE_EVENEMENT} />}>
            <EventCardNew
              item={item.reservation}
              // ⛔ PAS `handleDeclineEvent` ICI, ET CE N EST PAS UN OUBLI (T2/D2).
              //
              // Cette carte porte une RÉSERVATION : son `documentId` est un
              // identifiant de réservation, pas d événement. Le brancher
              // enverrait `POST /events/<idDeRéservation>/missing`, c est-à-dire
              // la mauvaise ressource — et depuis D3 cet échec parlerait, en
              // affichant une erreur là où il n y a rien à décliner. Aucune
              // route « je ne viens pas » n existe pour une réservation ; le
              // frère (`EventListContent.js:1250-1259`) la laisse inerte pour
              // la même raison. Le vrai « Absent·e » est sur la carte d à côté.
              // @ts-ignore
              onDecline={() => {}}
              onJoin={() => handleJoinEvent(item.reservation)}
              onLogin={() => {}}
              onParticipate={() => handleParticipateToEvent(item.reservation)}
              onPress={() => navigation.navigate(RouteNames.ReservationDetails, { reservationId: item.reservation.documentId })}
              useFacilityAccentColor
            />
          </Suspense>
        </View>
      );
    }
    return (
      <View style={[Spaces.marginBottom[16]]}>
        <Suspense fallback={<DeferredFallback height={HAUTEUR_CARTE_EVENEMENT} />}>
          <EventCardNew
            displayProfile="teamFocused"
            item={item}
            onDecline={() => handleDeclineEvent(item)}
            onEditAnswer={() => handleEditAnswer(item)}
            onJoin={() => handleJoinEvent(item)}
            onLogin={() => {}}
            onParticipate={() => handleParticipateToEvent(item)}
            onPress={() => handleEventPress(item)}
            // 🕐 T2/D5 — SEULE la carte qui attend s éteint. `isPending` est vrai
            // pour la mutation entière : s en servir tel quel ferait clignoter
            // la liste complète pour un seul appui.
            submittingAnswer={submittingEventId === item.documentId ? submittingAnswer : ''}
            useFacilityAccentColor
          />
        </Suspense>
      </View>
    );
  };

  /**
   * @param {Date} date
   */
  const handleDateConfirm = useCallback((date) => {
    setListStartDate(date);
  }, []);

  const handleSummaryPress = useCallback(() => {
    // @ts-ignore
    flatListRef.current?.scrollToOffset({ animated: true, offset: 500 });
  }, []);

  const handlePlanningDataResolved = useCallback(() => {
    setIsPlanningContentReady(true);
  }, []);

  const handleCreateEventPress = useCallback(() => {
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventWizardType });
  }, [navigation]);

  const handleListEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const keyExtractor = useCallback(
    (item, index) => item.documentId
      || item.id
      || `${item?.date || 'event'}-${item?.name || item?.title || index}`,
    [],
  );

  const floatingCtaBottom = floatingActionBottomOffset;
  const listBottomPadding = canManageEvents
    ? Math.max(sceneBottomInset, floatingCtaBottom + 84)
    : sceneBottomInset;

  const listHeaderComponent = useMemo(() => {
    const planningContent = (
      <PersonalPlanningContainer
        onDataResolved={handlePlanningDataResolved}
        onSummaryPress={handleSummaryPress}
      />
    );

    return (
      <View style={[Spaces.gap[24], Spaces.marginBottom[16]]}>
        {/* Top Header */}
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <Suspense fallback={<DeferredFallback height={28} width={180} />}>
            <LeagueHeaderSwitch />
          </Suspense>
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <Suspense fallback={<DeferredFallback height={40} width={88} />}>
              <NotificationBadge />
              <ProfileButton />
            </Suspense>
          </View>
        </View>

        {shouldLoadSecondaryPlanningData ? (
          <Suspense fallback={null} />
        ) : null}

        {/* Calendar Section */}
        <View>
          {Platform.OS === 'web' ? (
            planningContent
          ) : (
            <PlanningOnboardingWrapper
              description="Retrouve tes événements, ton calendrier et les actions de planning."
              id="planning-main-content"
              order={1}
              spotlight={{
                borderRadius: 16,
                overlayOpacity: 0.4,
                paddingX: 2,
                paddingY: 2,
              }}
              title="Mon planning"
            >
              {planningContent}
            </PlanningOnboardingWrapper>
          )}
        </View>

        {/* Featured Events Carousel */}
        {shouldLoadSecondaryPlanningData && featuredEvents.length > 0 && (
          <View style={[Spaces.marginTop[16]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
              ⭐ À la une dans mon club
            </Text>
            <Suspense fallback={<DeferredFallback height={180} />}>
              <FeaturedEvents events={featuredEvents} useFacilityAccentColorForPublic />
            </Suspense>
          </View>
        )}

        {/* List Header Section */}
        {shouldLoadSecondaryPlanningData ? (
          <View style={[Spaces.marginTop[16]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
              Événements à partir de
            </Text>
            <Suspense fallback={<DeferredFallback height={76} />}>
              <DateSlider
                onDateSelected={handleDateConfirm}
                selectedDate={listStartDate}
              />
            </Suspense>
            {(!shouldLoadEventFeed || isEventsLoading || (shouldLoadFeaturedFeed && isFeaturedLoading)) ? (
              <View style={[Spaces.marginTop[16], Spaces.gap[12]]}>
                {[0, 1, 2].map((rang) => <CarteEnAttente key={rang} />)}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }, [
    Alignments.alignCenter,
    Alignments.justifySpaceBetween,
    Alignments.row,
    Fonts.h3,
    Fonts.neutral00,
    Spaces.gap,
    Spaces.marginBottom,
    Spaces.marginTop,
    featuredEvents,
    handleDateConfirm,
    handlePlanningDataResolved,
    handleSummaryPress,
    isEventsLoading,
    isFeaturedLoading,
    listStartDate,
    shouldLoadEventFeed,
    shouldLoadFeaturedFeed,
    shouldLoadSecondaryPlanningData,
  ]);

  // Ecran par defaut du planning : sans ces deux etats, une liste vide et un echec
  // reseau rendaient exactement la meme page blanche, indistinguable d'un bug.
  const listEmptyComponent = useMemo(() => {
    if (!shouldLoadEventFeed || isEventsLoading) return null;

    if (isEventsError) {
      return (
        <ErrorWrapper
          error={eventsError}
          onRetry={refetchEvents}
          retryLabel="Réessayer"
          wrapperStyle={[
            Spaces.marginHorizontal[16],
            Spaces.marginTop[24],
            { minHeight: 200 },
          ]}
        >
          <View style={{ minHeight: 200 }} />
        </ErrorWrapper>
      );
    }

    return (
      <View style={[Spaces.marginHorizontal[16]]}>
        <EmptyState
          actionLabel={canManageEvents ? 'Créer un événement' : undefined}
          description={
            canManageEvents
              ? 'Crée ton premier événement pour le voir apparaître ici.'
              : 'Tes prochains événements s’afficheront ici dès que ton équipe en publiera.'
          }
          icon={Images.calendar}
          onAction={canManageEvents ? handleCreateEventPress : undefined}
          title="Aucun événement à venir"
        />
      </View>
    );
  }, [
    Images.calendar,
    Spaces.marginHorizontal,
    Spaces.marginTop,
    canManageEvents,
    eventsError,
    handleCreateEventPress,
    isEventsError,
    isEventsLoading,
    refetchEvents,
    shouldLoadEventFeed,
  ]);

  return (
    <ScreenContainer bgImage="bg2">
      <FlatList
        data={listEvents}
        ref={flatListRef}
        renderItem={renderItem}
        // @ts-ignore
        contentContainerStyle={{ paddingBottom: listBottomPadding }}
        extraData={userData}
        initialNumToRender={6}
        keyExtractor={keyExtractor}
        ListEmptyComponent={listEmptyComponent}
        ListHeaderComponent={listHeaderComponent}
        maxToRenderPerBatch={8}
        onEndReached={handleListEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={50}
        windowSize={7}
      />
      {canManageEvents && (
        <WebFloatingOverlay style={getFloatingActionContainerStyle(floatingCtaBottom, { zIndex: 1100 })}>
          <TouchableOpacity
            accessibilityLabel="Ajouter un événement"
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handleCreateEventPress}
            style={[
              ApplicationStyle.shadow200,
              {
                alignItems: 'center',
                backgroundColor: Colors.primary500,
                borderColor: 'rgba(255,255,255,0.18)',
                borderRadius: 32,
                borderWidth: 1,
                elevation: 8,
                height: 64,
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: {
                  height: 6,
                  width: 0,
                },
                shadowOpacity: 0.32,
                shadowRadius: 12,
                width: 64,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={Images.calendar}
              style={{
                height: 24,
                // Icone porteuse d'information sur fond primary500 : blanc = 2,40:1
                // (sous le seuil 3:1 des elements graphiques), primary900 = 7,96:1.
                tintColor: Colors.primary900,
                width: 24,
              }}
            />
            <View
              style={{
                alignItems: 'center',
                backgroundColor: Colors.primary200,
                borderColor: 'rgba(255,255,255,0.36)',
                borderRadius: 999,
                borderWidth: 1,
                height: 20,
                justifyContent: 'center',
                position: 'absolute',
                right: 8,
                top: 8,
                width: 20,
              }}
            >
              <Image
                resizeMode="contain"
                source={Images.plus}
                style={{
                  height: 10,
                  tintColor: Colors.primary900,
                  width: 10,
                }}
              />
            </View>
          </TouchableOpacity>
        </WebFloatingOverlay>
      )}
      <Suspense fallback={null}>
        <JoinEventModal
          clubName={selectedEvent?.team?.club?.name || ''}
          confirmLabel={selectedParticipationFlow?.confirmLabel}
          errorMessage={joinModalError || null}
          isSubmitting={
            joinReservationMutation.isPending
            || createEventParticipationMutation.isPending
          }
          isVisible={isJoinModalVisible}
          onClose={handleCloseJoinModal}
          onConfirm={handleConfirmJoinEvent}
        />
      </Suspense>
    </ScreenContainer>
  );
}

export default ParticipantEventList;
