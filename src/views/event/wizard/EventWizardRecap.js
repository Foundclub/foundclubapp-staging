// @ts-nocheck
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  InteractionManager,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  isTrainingEventType,
  resolveTrainingOpenConfig,
} from '@/domains/event/eventUseCases';
import useEvent from '@/domains/event/useEvent';
import {
  extractSubscriptionDecisionFromError,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  celebrate,
} from '@/services/celebrations/celebrationRuntime';
import {
  createEventsWithConcurrency,
  getEventById,
  requestFeatured,
  rollbackEventsByCancel,
} from '@/services/event/eventService';

import EventTasksEditor from '../components/EventTasksEditor';
import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardRecapStepIndex,
  getEventWizardStepCount,
  hasCompletePerDayLocations,
  isStageEventType,
  isTournamentEventType,
  shouldSkipEventWizardParticipantsStep,
} from './eventWizardDetectionUtils';

const CREATE_EVENT_BATCH_CONCURRENCY = 3;
const FEATURED_SCOPE_OPTIONS = [
  {
    description: 'Visible dans les espaces publics FoundClub après validation.',
    label: 'A la une publique',
    value: 'PUBLIC',
  },
  {
    description: 'Visible pour les membres du club ou de la section.',
    label: 'A la une du club',
    value: 'SECTION',
  },
  {
    description: 'Visible au niveau de la structure multisport.',
    label: 'A la une multisport',
    value: 'CM',
  },
];

const getErrorCode = (error) => (
  error?.details?.code
  || error?.code
  || error?.response?.data?.error?.details?.code
  || error?.response?.data?.error?.code
  || error?.response?.data?.code
  || null
);

const delay = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const getCreatedEventSnapshot = (createdItem) => {
  if (createdItem?.response?.data?.documentId) {
    return createdItem.response.data;
  }
  if (createdItem?.response?.documentId) {
    return createdItem.response;
  }
  return null;
};

const hasExpectedEventHydration = (eventSnapshot, expectedTaskCount, expectedAudienceCount) => {
  if (!eventSnapshot?.documentId) return false;
  const actualTaskCount = Array.isArray(eventSnapshot?.eventTasks) ? eventSnapshot.eventTasks.length : 0;
  const actualAudienceCount = Array.isArray(eventSnapshot?.teamAudiences) ? eventSnapshot.teamAudiences.length : 0;
  return actualTaskCount >= expectedTaskCount && actualAudienceCount >= expectedAudienceCount;
};

const seedCreatedEventDetailCache = ({
  createdItem,
  eventId,
  queryClient,
}) => {
  if (!eventId || !createdItem) return null;

  const createdSnapshot = getCreatedEventSnapshot(createdItem);
  if (createdSnapshot?.documentId) {
    queryClient.setQueryData(['event', eventId], createdSnapshot);
  }

  return createdSnapshot;
};

const preloadCreatedEventDetail = async ({
  createdItem,
  createdSnapshot: seededSnapshot,
  eventId,
  queryClient,
}) => {
  if (!eventId || !createdItem) return;

  const expectedTaskCount = Array.isArray(createdItem?.payload?.eventTasks)
    ? createdItem.payload.eventTasks.length
    : 0;
  const expectedAudienceCount = Array.isArray(createdItem?.payload?.teamAudiences)
    ? createdItem.payload.teamAudiences.length
    : 0;
  const createdSnapshot = seededSnapshot || getCreatedEventSnapshot(createdItem);
  const shouldRetryHydration = expectedTaskCount > 0 || expectedAudienceCount > 0;
  const maxAttempts = shouldRetryHydration ? 3 : 1;

  if (
    createdSnapshot
    && !shouldRetryHydration
    && hasExpectedEventHydration(createdSnapshot, expectedTaskCount, expectedAudienceCount)
  ) {
    return;
  }

  const fetchAttempt = async (attemptIndex) => {
    try {
      const hydratedEvent = await queryClient.fetchQuery({
        queryFn: () => getEventById(eventId),
        queryKey: ['event', eventId],
        staleTime: 0,
      });

      if (
        !shouldRetryHydration
        || hasExpectedEventHydration(hydratedEvent, expectedTaskCount, expectedAudienceCount)
        || attemptIndex >= maxAttempts - 1
      ) {
        return;
      }
    } catch (prefetchError) {
      if (attemptIndex >= maxAttempts - 1) {
        return;
      }
    }

    await delay(350 * (attemptIndex + 1));
    await fetchAttempt(attemptIndex + 1);
  };

  await fetchAttempt(0);
};

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const getAudienceRecapKey = (audience) => (
  `${String(audience?.audienceKind || 'audience')}:${String(audience?.team?.documentId || audience?.team?.id || 'team')}`
);

const buildWizardFormData = (wizardState) => {
  const isTournament = isTournamentEventType(wizardState?.type?.name);
  const tournamentScopeMode = wizardState.tournamentScopeMode === 'autonomous' ? 'autonomous' : 'team';
  const eventDate = wizardState.date ? new Date(wizardState.date) : new Date();
  const start = wizardState.startTime ? new Date(wizardState.startTime) : new Date(eventDate);
  const end = wizardState.endTime ? new Date(wizardState.endTime) : new Date(start.getTime() + (60 * 60000));
  const trainingOpenConfig = resolveTrainingOpenConfig(wizardState);
  const hasStoredTrainingExternalConfig = trainingOpenConfig.isOpenTraining
    || trainingOpenConfig.externalParticipantLimit !== null;

  return {
    capacity: trainingOpenConfig.isTraining ? null : (wizardState.capacity ?? null),
    club: wizardState.team?.club?.documentId || wizardState.club?.documentId || null,
    date: format(eventDate, 'dd/MM/yyyy'),
    description: wizardState.description || '',
    detectionSlots: Array.isArray(wizardState.detectionSlots) ? wizardState.detectionSlots : [],
    endTime: format(end, 'HH:mm'),
    eventTasks: Array.isArray(wizardState.eventTasks) ? wizardState.eventTasks : [],
    externalParticipantLimit: trainingOpenConfig.isTraining && hasStoredTrainingExternalConfig
      ? trainingOpenConfig.externalParticipantLimit
      : null,
    externalParticipantValidationMode: trainingOpenConfig.isTraining && hasStoredTrainingExternalConfig
      ? trainingOpenConfig.externalParticipantValidationMode
      : null,
    facility: wizardState.facility,
    invitedTeams: Array.isArray(wizardState.invitedTeams) ? wizardState.invitedTeams : [],
    isMultiDayTournament: wizardState.isMultiDayTournament === true,
    isRecurrent: Boolean(wizardState.isRecurrent),
    location: wizardState.location,
    participantIdentityVisibility: wizardState.participantIdentityVisibility || 'VISIBLE',
    pricePerPerson: wizardState.pricePerPerson ?? null,
    recurrenceDays: Array.isArray(wizardState.recurrenceDays) ? wizardState.recurrenceDays : [],
    recurrenceEndDate: wizardState.recurrenceEndDate
      ? format(new Date(wizardState.recurrenceEndDate), 'dd/MM/yyyy')
      : '',
    recurrenceFrequency: wizardState.recurrenceFrequency || 'week',
    recurrenceInterval: wizardState.recurrenceInterval || 1,
    recurrenceStartDate: wizardState.recurrenceStartDate
      ? format(new Date(wizardState.recurrenceStartDate), 'dd/MM/yyyy')
      : '',
    reservationMode: wizardState.reservationMode || 'FULL_GROUP',
    sessionStatus: wizardState.sessionStatus || 'open',
    stageDefaultEndTime: wizardState.stageDefaultEndTime
      ? format(new Date(wizardState.stageDefaultEndTime), 'HH:mm')
      : '',
    stageDefaultStartTime: wizardState.stageDefaultStartTime
      ? format(new Date(wizardState.stageDefaultStartTime), 'HH:mm')
      : '',
    stageEndDate: wizardState.stageEndDate
      ? format(new Date(wizardState.stageEndDate), 'yyyy-MM-dd')
      : '',
    stageSchedule: Array.isArray(wizardState.stageSchedule)
      ? wizardState.stageSchedule.map((day) => ({
        date: day?.date ? format(new Date(day.date), 'yyyy-MM-dd') : '',
        endTime: day?.endTime ? format(new Date(day.endTime), 'HH:mm') : '',
        facilityId: day?.facilityId || null,
        isActive: day?.isActive !== false,
        location: day?.location || null,
        startTime: day?.startTime ? format(new Date(day.startTime), 'HH:mm') : '',
      }))
      : [],
    stageStartDate: wizardState.stageStartDate
      ? format(new Date(wizardState.stageStartDate), 'yyyy-MM-dd')
      : '',
    startTime: format(start, 'HH:mm'),
    team: isTournament && tournamentScopeMode === 'autonomous' ? undefined : wizardState.team?.documentId,
    teamAudiences: Array.isArray(wizardState.teamAudiences) ? wizardState.teamAudiences : [],
    totalPlayers: trainingOpenConfig.isOpenTraining ? null : (wizardState.totalPlayers ?? null),
    tournamentActivity: isTournament && tournamentScopeMode === 'autonomous'
      ? wizardState.tournamentActivity?.documentId
      : undefined,
    tournamentCategory: isTournament && tournamentScopeMode === 'autonomous'
      ? wizardState.tournamentCategory?.documentId
      : undefined,
    tournamentConfig: isTournament ? {
      allowCrossClubPlayers: wizardState.tournamentAllowCrossClubPlayers === true,
      allowCustomTeams: wizardState.tournamentAllowCustomTeams !== false,
      bestThirdPlacesCount: wizardState.tournamentBestThirdPlacesCount ?? 0,
      formatMode: wizardState.tournamentFormatMode || 'groups_only',
      groupCount: wizardState.tournamentGroupCount ?? 2,
      knockoutSize: wizardState.tournamentKnockoutSize ?? 0,
      matchGenerationMode: wizardState.tournamentMatchGenerationMode || 'auto',
      maxRosterSize: wizardState.tournamentMaxRosterSize ?? null,
      maxTeams: wizardState.tournamentMaxTeams ?? null,
      minRosterSize: wizardState.tournamentMinRosterSize ?? null,
      pointsDraw: wizardState.tournamentPointsDraw ?? 1,
      pointsForfeit: wizardState.tournamentPointsForfeit ?? 0,
      pointsLoss: wizardState.tournamentPointsLoss ?? 0,
      pointsWin: wizardState.tournamentPointsWin ?? 3,
      qualifiedPerGroup: wizardState.tournamentQualifiedPerGroup ?? 2,
      registrationMode: wizardState.tournamentRegistrationMode || 'manual',
      rulesText: wizardState.tournamentRulesText || '',
      scorePolicy: 'organizer_only',
      seedingMode: wizardState.tournamentSeedingMode || 'random',
      thirdPlaceMatch: wizardState.tournamentThirdPlaceMatch === true,
    } : undefined,
    tournamentScopeMode: isTournament ? tournamentScopeMode : undefined,
    tournamentSection: isTournament && tournamentScopeMode === 'autonomous'
      ? wizardState.tournamentSection?.documentId
      : undefined,
    type: wizardState.type?.documentId,
    typeName: wizardState.type?.name || '',
    validationMode: isTournament
      ? (wizardState.tournamentRegistrationMode || 'manual')
      : (wizardState.validationMode || 'auto'),
  };
};

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardRecap({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    clubVerificationSummary,
    freeUsageSummary,
    subscriptionAccessLevel,
  } = useAuth();
  const { dispatch, state } = useEventWizard();
  const { createReccurrentEventPayload, createStageEventPayload } = useEvent();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFeaturedScopes, setSelectedFeaturedScopes] = useState([]);
  const [submitProgress, setSubmitProgress] = useState(null);
  const [partialState, setPartialState] = useState(null);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const isReservation = String(state.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('reservation');
  const isTraining = isTrainingEventType(state.type?.name);
  const isStage = isStageEventType(state.type?.name);
  const isTournament = isTournamentEventType(state.type?.name);
  const isMultiDayProgram = isStage || (isTournament && state.isMultiDayTournament === true);
  const hasCompletePerDayLocationSet = hasCompletePerDayLocations(state);
  const trainingOpenConfig = useMemo(() => resolveTrainingOpenConfig(state), [state]);
  const shouldSkipParticipantsStep = useMemo(
    () => shouldSkipEventWizardParticipantsStep(state),
    [state],
  );
  const eventPublishQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  const wizardFormData = useMemo(() => buildWizardFormData(state), [state]);

  const plannedPayloads = useMemo(
    () => (isMultiDayProgram
      ? [createStageEventPayload(wizardFormData)]
      : createReccurrentEventPayload(wizardFormData)),
    [createReccurrentEventPayload, createStageEventPayload, isMultiDayProgram, wizardFormData],
  );

  const recurrencePreviewCount = plannedPayloads.length;
  const recapNotSet = t('eventWizard.recap.notSet');

  const getLocationDisplayText = () => {
    const { facility, location } = state;
    if (!location) {
      if (facility) {
        return t('eventWizard.recap.facilitySelected', 'Installation sélectionnée');
      }
      if (hasCompletePerDayLocations(state)) {
        return t('eventWizard.recap.perDayLocations', 'Lieux personnalises par jour');
      }
      return t('eventWizard.recap.notSet');
    }
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
      const label = location.label || location.description || location.name || location.address;
      if (typeof label === 'string' && label.trim()) return label;
      if (typeof label === 'object') return label.label || label.description || t('eventWizard.recap.notSet');
    }
    return t('eventWizard.recap.notSet');
  };

  const getFormattedDate = () => {
    try {
      return format(new Date(state.date), 'EEEE d MMMM yyyy', { locale: fr });
    } catch {
      return t('eventWizard.recap.notSet');
    }
  };

  const getFormattedTime = () => {
    try {
      const start = format(new Date(state.startTime), 'HH:mm');
      const end = format(new Date(state.endTime), 'HH:mm');
      return `${start} - ${end}`;
    } catch {
      return t('eventWizard.recap.notSet');
    }
  };

  const typeValue = state.type?.name || recapNotSet;
  const teamValue = isTournament && state.tournamentScopeMode === 'autonomous'
    ? 'Tournoi autonome'
    : (state.team?.name || recapNotSet);
  const dateValue = getFormattedDate();
  const timeValue = getFormattedTime();
  const locationValue = getLocationDisplayText();
  const eventTasks = Array.isArray(state.eventTasks) ? state.eventTasks : [];
  const teamAudiences = Array.isArray(state.teamAudiences) ? state.teamAudiences : [];
  const visibilityValue = state.sessionStatus === 'closed'
    ? t('eventWizard.steps.visibility.team')
    : t('eventWizard.steps.visibility.public');
  const participantPrivacyValue = state.participantIdentityVisibility === 'ANONYMIZED'
    ? t('eventWizard.steps.visibility.participantPrivacyAnonymized', 'Participants anonymisés')
    : t('eventWizard.steps.visibility.participantPrivacyVisible', 'Identités visibles');
  const effectiveValidationMode = isTournament
    ? (state.tournamentRegistrationMode || 'manual')
    : (state.validationMode || 'auto');
  const validationValue = effectiveValidationMode === 'manual'
    ? t('eventEdit.fields.validationMode.options.manual')
    : t('eventEdit.fields.validationMode.options.auto');
  const externalValidationValue = trainingOpenConfig.externalParticipantValidationMode === 'auto'
    ? t('eventEdit.fields.validationMode.options.auto')
    : t('eventEdit.fields.validationMode.options.manual');
  const invitedCount = state.invitedTeams?.length || 0;
  const detectionSlots = Array.isArray(state.detectionSlots) ? state.detectionSlots : [];
  const detectionSlotsTotal = detectionSlots.reduce((sum, slot) => sum + Number(slot?.quantity || 0), 0);
  const tournamentFormatLabel = {
    groups_only: 'Poules uniquement',
    groups_to_knockout: 'Poules + finale',
    knockout_only: 'Phase finale directe',
    round_robin: 'Championnat',
  }[state.tournamentFormatMode || 'groups_only'] || 'Poules uniquement';
  let tournamentGroupsSummary = state.tournamentGroupCount ?? 1;
  if (state.tournamentFormatMode === 'knockout_only') {
    tournamentGroupsSummary = 'Aucune';
  } else if (state.tournamentFormatMode === 'round_robin') {
    tournamentGroupsSummary = '1 classement';
  }
  let tournamentQualificationSummary = `${state.tournamentQualifiedPerGroup ?? 2} / poule`;
  if (state.tournamentFormatMode === 'knockout_only') {
    tournamentQualificationSummary = 'Directs';
  }
  let tournamentSeedingSummary = 'Aleatoire';
  if (state.tournamentSeedingMode === 'manual') {
    tournamentSeedingSummary = 'Manuel';
  } else if (state.tournamentSeedingMode === 'snake') {
    tournamentSeedingSummary = 'Serpentin';
  }
  const tournamentGenerationSummary = state.tournamentMatchGenerationMode === 'manual'
    ? 'Manuelle'
    : 'Automatique';
  const stageSchedule = Array.isArray(state.stageSchedule) ? state.stageSchedule : [];
  const activeStageDays = stageSchedule.filter((day) => day?.isActive !== false);
  const stageHasVariableHours = activeStageDays.some((day) => (
    day?.startTime && day?.endTime
      ? (
        format(new Date(day.startTime), 'HH:mm') !== format(new Date(state.stageDefaultStartTime || day.startTime), 'HH:mm')
        || format(new Date(day.endTime), 'HH:mm') !== format(new Date(state.stageDefaultEndTime || day.endTime), 'HH:mm')
      )
      : false
  ));
  const stagePeriodValue = isMultiDayProgram && state.stageStartDate && state.stageEndDate
    ? `${format(new Date(state.stageStartDate), 'dd/MM/yyyy')} - ${format(new Date(state.stageEndDate), 'dd/MM/yyyy')}`
    : dateValue;
  let stageHoursValue = timeValue;
  if (isMultiDayProgram) {
    stageHoursValue = stageHasVariableHours
      ? t(
        isTournament ? 'eventWizard.tournamentProgram.variableHours' : 'eventWizard.stage.variableHours',
        'Horaires variables',
      )
      : `${format(new Date(state.stageDefaultStartTime || state.startTime), 'HH:mm')} - ${format(new Date(state.stageDefaultEndTime || state.endTime), 'HH:mm')}`;
  }
  const hasType = Boolean(state.type?.name);
  const hasTeam = Boolean(state.team?.name || (isTournament && state.tournamentScopeMode === 'autonomous'));
  const hasDate = Boolean(isMultiDayProgram ? state.stageStartDate && state.stageEndDate : state.date);
  const hasTime = Boolean(isMultiDayProgram ? state.stageDefaultStartTime && state.stageDefaultEndTime : state.startTime && state.endTime);
  const hasLocation = Boolean(state.location || state.facility || hasCompletePerDayLocationSet);
  const hasValidationConfig = Boolean(state.validationMode)
    && (!trainingOpenConfig.isOpenTraining || Boolean(trainingOpenConfig.externalParticipantValidationMode));
  const quickOverviewItems = [
    {
      complete: hasType,
      label: t('eventWizard.recap.sections.type'),
      value: typeValue,
    },
    {
      complete: hasTeam,
      label: t('eventWizard.recap.sections.team'),
      value: teamValue,
    },
    {
      complete: hasDate && hasTime,
      label: t('eventWizard.recap.sections.logistics'),
      value: hasDate && hasTime ? `${stagePeriodValue} - ${stageHoursValue}` : recapNotSet,
    },
    {
      complete: hasLocation,
      label: t('eventWizard.recap.sections.location'),
      value: locationValue,
    },
    {
      complete: hasValidationConfig,
      label: t('eventWizard.recap.sections.validation'),
      value: validationValue,
    },
  ];
  const completedQuickOverviewCount = quickOverviewItems.filter((item) => item.complete).length;
  const isRecapReady = completedQuickOverviewCount === quickOverviewItems.length;
  const hasFeaturedRequestSelection = selectedFeaturedScopes.length > 0;

  const toggleFeaturedScope = (scope) => {
    setSelectedFeaturedScopes((current) => (
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope]
    ));
  };

  const runCreateBatch = async (payloads) => {
    const result = await createEventsWithConcurrency(payloads, {
      concurrency: CREATE_EVENT_BATCH_CONCURRENCY,
      onProgress: setSubmitProgress,
      suppressCelebration: true,
    });
    return {
      created: result.created,
      failed: result.failed.map((item) => ({
        code: getErrorCode(item.error),
        error: item.error,
        payload: item.payload,
      })),
    };
  };

  const requestFeaturedForCreatedEvents = async (created = []) => {
    if (!hasFeaturedRequestSelection) return [];

    const createdEventIds = Array.from(new Set(
      created
        .map((item) => String(item?.documentId || '').trim())
        .filter(Boolean),
    ));

    if (!createdEventIds.length) return [];

    const results = await Promise.allSettled(
      createdEventIds.map((eventId) => requestFeatured({
        eventId,
        scopes: selectedFeaturedScopes,
      })),
    );

    return results
      .map((result, index) => ({
        eventId: createdEventIds[index],
        result,
      }))
      .filter((item) => item.result.status === 'rejected');
  };

  const finalizeSuccess = async (created) => {
    const firstCreatedId = created.find((item) => item.documentId)?.documentId;
    const eventQuotaSnapshot = eventPublishQuotaItem
      ? {
        beforeRemaining: eventPublishQuotaItem.remaining,
        quotaType: eventPublishQuotaItem.quotaType,
        total: eventPublishQuotaItem.total,
      }
      : null;
    const featuredFailures = await requestFeaturedForCreatedEvents(created);
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    // Prefixe large : couvre ['planning','personal'] mais aussi les vues fullscreen,
    // club et CM qui n'etaient jamais invalidees (planning perime pendant ~60s).
    await queryClient.invalidateQueries({ queryKey: ['planning'] });
    await queryClient.invalidateQueries({ queryKey: ['club-planning'] });
    await queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
    await queryClient.invalidateQueries({ queryKey: ['get-me'] });

    const firstCreatedItem = created.find((item) => item.documentId === firstCreatedId) || null;
    const celebrationPayload = {
      eventCount: created.length,
      eventId: firstCreatedId,
      eventName: firstCreatedItem?.payload?.name || firstCreatedItem?.payload?.description || '',
      teamId: firstCreatedItem?.payload?.team || firstCreatedItem?.payload?.team?.documentId || null,
    };
    const creationCelebration = {
      actionKey: created.length > 1 ? 'event_batch_created' : 'event_created',
      payload: celebrationPayload,
    };
    const seededCreatedEvent = firstCreatedId && firstCreatedItem
      ? seedCreatedEventDetailCache({
        createdItem: firstCreatedItem,
        eventId: firstCreatedId,
        queryClient,
      })
      : null;

    dispatch({ type: 'RESET' });

    if (featuredFailures.length > 0) {
      Alert.alert(
        t('eventWizard.recap.featured.warningTitle', 'Événement crée'),
        t(
          'eventWizard.recap.featured.warningMessage',
          "L'événement est créé, mais la demande de mise à la une n'a pas pu être envoyée. Tu pourras la refaire depuis le detail.",
        ),
      );
    }

    if (firstCreatedId) {
      // Pile [EventDetails, EventPublishedShowcase] : l'utilisateur voit d'abord
      // l'atelier « fais voir ton événement » ; fermer révèle EventDetails préchargé.
      navigation.reset({
        index: 1,
        routes: [{
          name: RouteNames.EventDetails,
          params: {
            creationCelebration,
            eventCampaignCreationSuggested: true,
            eventId: firstCreatedId,
            fromEventCreation: true,
            subscriptionFollowUp: eventQuotaSnapshot && subscriptionAccessLevel === 'FREE'
              ? {
                beforeRemaining: eventQuotaSnapshot.beforeRemaining,
                consumedCount: Math.max(1, created.length),
                quotaType: eventQuotaSnapshot.quotaType,
                total: eventQuotaSnapshot.total,
              }
              : null,
          },
        }, {
          name: RouteNames.EventPublishedShowcase,
          params: { creationCelebration, eventId: firstCreatedId },
        }],
      });
      if (firstCreatedItem) {
        InteractionManager.runAfterInteractions(() => {
          preloadCreatedEventDetail({
            createdItem: firstCreatedItem,
            createdSnapshot: seededCreatedEvent,
            eventId: firstCreatedId,
            queryClient,
          }).catch(() => {});
        });
      }
      return;
    }

    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList });
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        celebrate(creationCelebration.actionKey, creationCelebration.payload);
      }, 180);
    });
  };

  const getFailureSummary = (failedItems) => {
    const grouped = failedItems.reduce((acc, item) => {
      const code = item.code || 'UNKNOWN';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    const lines = Object.entries(grouped).map(([code, count]) => {
      switch (code) {
        case 'EVENT_DATE_PAST':
          return `- ${count}x ${t('eventWizard.errors.datePast')}`;
        case 'EVENT_INVALID_TIME_RANGE':
          return `- ${count}x ${t('eventWizard.errors.invalidTimeRange')}`;
        case 'EVENT_LOCATION_REQUIRED':
          return `- ${count}x ${t('eventWizard.errors.locationRequired')}`;
        case 'EVENT_SLOT_CONFLICT':
          return `- ${count}x ${t('eventWizard.errors.slotConflict')}`;
        default:
          return `- ${count}x ${t('eventWizard.errors.genericCreate')}`;
      }
    });
    return lines.join('\n');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitProgress(null);
    try {
      const { created, failed } = await runCreateBatch(plannedPayloads);
      if (failed.length === 0) {
        await finalizeSuccess(created);
        return;
      }

      if (created.length === 0) {
        const blockedDecision = failed
          .map((item) => extractSubscriptionDecisionFromError(item?.error))
          .find(Boolean);
        if (blockedDecision) {
          setSubscriptionPaywallDecision(blockedDecision);
          return;
        }
        const singleFailureMessage = failed.length === 1
          ? getErrorMessage(failed[0]?.error, getFailureSummary(failed))
          : getFailureSummary(failed);

        Alert.alert(
          t('common.error', 'Erreur'),
          singleFailureMessage,
        );
        return;
      }

      setPartialState({
        created,
        failed,
      });
    } catch (submitError) {
      const blockedDecision = extractSubscriptionDecisionFromError(submitError);
      if (blockedDecision) {
        setSubscriptionPaywallDecision(blockedDecision);
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        submitError?.message || t('eventWizard.errors.genericCreate'),
      );
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(null);
    }
  };

  const handleKeepCreated = async () => {
    if (!partialState) return;
    setIsSubmitting(true);
    setSubmitProgress(null);
    try {
      if (partialState.created.length === 0) {
        Alert.alert(t('common.error'), t('eventWizard.partial.noCreated'));
        setPartialState(null);
        return;
      }
      await finalizeSuccess(partialState.created);
    } finally {
      setIsSubmitting(false);
      setPartialState(null);
      setSubmitProgress(null);
    }
  };

  const handleRollbackCreated = async () => {
    if (!partialState) return;
    setIsSubmitting(true);
    setSubmitProgress(null);
    try {
      const cancellableIds = partialState.created
        .map((item) => item.documentId)
        .filter(Boolean);

      const rollbackResults = await rollbackEventsByCancel(cancellableIds);
      const rollbackErrors = rollbackResults.filter((result) => result.status === 'rejected');

      if (rollbackErrors.length > 0) {
        Alert.alert(
          t('common.error'),
          t('eventWizard.partial.rollbackPartial', { count: rollbackErrors.length }),
        );
      } else {
        Alert.alert(t('common.actions.ok'), t('eventWizard.partial.rollbackSuccess'));
      }

      setPartialState(null);
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(null);
    }
  };

  const handleRetryFailed = async () => {
    if (!partialState) return;
    setIsSubmitting(true);
    try {
      const retryPayloads = partialState.failed.map((item) => item.payload);
      const retryResult = await runCreateBatch(retryPayloads);
      const combinedCreated = [...partialState.created, ...retryResult.created];

      if (retryResult.failed.length === 0) {
        await finalizeSuccess(combinedCreated);
        setPartialState(null);
        return;
      }

      setPartialState({
        created: combinedCreated,
        failed: retryResult.failed,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <WizardStepLayout
        isNextDisabled={!isRecapReady}
        isNextLoading={isSubmitting}
        nextLabel={t('eventWizard.recap.actions.createShort', 'Creer')}
        onBack={() => navigation.goBack()}
        onNext={handleSubmit}
        stepCount={getEventWizardStepCount(state)}
        stepIndex={getEventWizardRecapStepIndex(state)}
        subtitle={t('eventWizard.steps.recap.subtitle')}
        title={t('eventWizard.steps.recap.title')}
      >
        <View style={[Spaces.gap[16]]}>
          <EventTasksEditor
            editable
            onChange={(nextTasks) => dispatch({ payload: { eventTasks: nextTasks }, type: 'SET_META' })}
            value={eventTasks}
          />

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Invitations avancées</Text>
            {teamAudiences.length ? (
              <View style={Spaces.gap[8]}>
                {teamAudiences.map((audience) => (
                  <View
                    key={getAudienceRecapKey(audience)}
                    style={[ApplicationStyle.card, Spaces.padding[12], {
                      backgroundColor: 'rgba(1, 179, 244, 0.10)',
                      borderColor: 'rgba(1, 179, 244, 0.25)',
                    }]}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{audience?.team?.name || 'Equipe'}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {(audience?.audienceKind === 'external_invited' ? 'Externe' : 'Interne')}
                      {' '}
                      -
                      {' '}
                      {audience?.selectionMode === 'SELECTED_MEMBERS'
                        ? `${Array.isArray(audience?.selectedMembers) ? audience.selectedMembers.length : 0} membre(s)`
                        : 'Tous les membres'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[Fonts.p3, Fonts.neutral200]}>Aucune invitation avancée pour le moment.</Text>
            )}
          </View>

          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[12],
              {
                ...cardSurfaceStyle,
                borderColor: isRecapReady ? 'rgba(1, 179, 244, 0.45)' : 'rgba(255, 191, 71, 0.35)',
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('eventWizard.recap.quickOverviewTitle', 'Vue d\'ensemble')}
              </Text>
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  {
                    backgroundColor: isRecapReady ? 'rgba(1, 179, 244, 0.18)' : 'rgba(255, 191, 71, 0.18)',
                    borderColor: isRecapReady ? Colors.primary500 : Colors.gold500,
                    borderRadius: 999,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, isRecapReady ? Fonts.primary500 : Fonts.gold500]}>
                  {isRecapReady
                    ? t('eventWizard.recap.ready', 'Prêt à créer')
                    : t('eventWizard.recap.incomplete', 'A compléter')}
                </Text>
              </View>
            </View>

            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventWizard.recap.completedCount', '{{done}}/5 infos cles completees', {
                done: completedQuickOverviewCount,
              })}
            </Text>

            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
              {quickOverviewItems.map((item) => (
                <View
                  key={item.label}
                  style={[
                    ApplicationStyle.card,
                    Spaces.paddingHorizontal[8],
                    Spaces.paddingVertical[8],
                    Spaces.gap[4],
                    {
                      backgroundColor: 'rgba(1, 179, 244, 0.10)',
                      borderColor: item.complete ? 'rgba(1, 179, 244, 0.30)' : 'rgba(255, 191, 71, 0.36)',
                      borderWidth: 1,
                      flexBasis: '48%',
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, Fonts.neutral200]}>{item.label}</Text>
                  <Text
                    numberOfLines={2}
                    style={[Fonts.p3, item.complete ? Fonts.neutral00 : Fonts.gold500]}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {eventPublishQuotaItem ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('eventWizard.recap.freeQuota.title', 'Quota événement gratuit')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(
                  'eventWizard.recap.freeQuota.description',
                  '{{remaining}}/{{total}} publication gratuite restante avant paywall.',
                  {
                    remaining: eventPublishQuotaItem.remaining,
                    total: eventPublishQuotaItem.total,
                  },
                )}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'eventWizard.recap.freeQuota.hint',
                  'Une fois cet avantage utilise, les prochaines publications seront bloquées cote serveur et renverront vers ton abonnement.',
                )}
              </Text>
            </View>
          ) : null}

          {isSubmitting && submitProgress?.total > 1 ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('eventWizard.recap.creationProgress.title', 'Création en cours')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('eventWizard.recap.creationProgress.description', {
                  completed: submitProgress.completed,
                  defaultValue: '{{completed}}/{{total}} evenements traites',
                  total: submitProgress.total,
                })}
              </Text>
              {submitProgress.failed > 0 ? (
                <Text style={[Fonts.p3, Fonts.gold500]}>
                  {t('eventWizard.recap.creationProgress.partialFailures', {
                    count: submitProgress.failed,
                    defaultValue: '{{count}} création(s) à vérifier',
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('eventWizard.recap.organizationTitle', 'Organisation')}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardType)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.type')}</Text>
                <Text style={[Fonts.p2, hasType ? Fonts.neutral00 : Fonts.gold500]}>{typeValue}</Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.team')}</Text>
                <Text style={[Fonts.p2, hasTeam ? Fonts.neutral00 : Fonts.gold500]}>{teamValue}</Text>
              </View>
              {isTournament && state.tournamentScopeMode === 'autonomous' ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>Cadre autonome</Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {[
                      state.tournamentActivity?.name,
                      state.tournamentSection?.name,
                      state.tournamentCategory?.name,
                    ].filter(Boolean).join(' - ') || recapNotSet}
                  </Text>
                </View>
              ) : null}
              {!isStage && !isTournament ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t('eventWizard.recap.invitedTeamsTitle', 'Équipes invitées')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {t('eventWizard.recap.invitesCount', { count: invitedCount })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {isMultiDayProgram
                  ? t(
                    isTournament ? 'eventWizard.tournamentProgram.recapProgramTitle' : 'eventWizard.stage.recapProgramTitle',
                    isTournament ? 'Programme du tournoi' : 'Programme du stage',
                  )
                  : t('eventWizard.recap.whenWhereTitle', 'Quand et lieu')}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(
                  isMultiDayProgram && !isTournament
                    ? RouteNames.EventWizardStageProgram
                    : RouteNames.EventWizardLogistics,
                )}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {isMultiDayProgram
                    ? t(
                      isTournament ? 'eventWizard.tournamentProgram.periodTitle' : 'eventWizard.stage.periodTitle',
                      'Periode',
                    )
                    : t('eventWizard.recap.dateLabel', 'Date')}
                </Text>
                <Text style={[Fonts.p2, hasDate ? Fonts.neutral00 : Fonts.gold500]}>
                  {isMultiDayProgram ? stagePeriodValue : dateValue}
                </Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {isMultiDayProgram
                    ? t(
                      isTournament ? 'eventWizard.tournamentProgram.defaultHoursTitle' : 'eventWizard.stage.defaultHoursTitle',
                      'Horaires par défaut',
                    )
                    : t('eventWizard.recap.timeLabel', 'Horaire')}
                </Text>
                <Text style={[Fonts.p1Bold, hasTime ? Fonts.primary500 : Fonts.gold500]}>
                  {isMultiDayProgram ? stageHoursValue : timeValue}
                </Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.location')}</Text>
                <Text style={[Fonts.p2, hasLocation ? Fonts.neutral00 : Fonts.gold500]}>{locationValue}</Text>
              </View>
              {isMultiDayProgram ? (
                <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t(
                      isTournament ? 'eventWizard.tournamentProgram.daysTitle' : 'eventWizard.stage.daysTitle',
                      isTournament ? 'Jours du tournoi' : 'Jours du stage',
                    )}
                  </Text>
                  {activeStageDays.map((day) => (
                    <View
                      key={`stage-day-${String(day?.date || '')}`}
                      style={[
                        ApplicationStyle.card,
                        Alignments.row,
                        Alignments.justifySpaceBetween,
                        Alignments.alignCenter,
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[12],
                        {
                          backgroundColor: 'rgba(1, 179, 244, 0.08)',
                          borderColor: 'rgba(1, 179, 244, 0.20)',
                        },
                      ]}
                    >
                      <View style={[Spaces.gap[4], { flex: 1 }]}>
                        <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
                          {format(new Date(day.date), 'EEEE d MMM', { locale: fr })}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {`${format(new Date(day.startTime), 'HH:mm')} - ${format(new Date(day.endTime), 'HH:mm')}`}
                        </Text>
                      </View>
                      {day?.facilityId || day?.location ? (
                        <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                          {t(
                            isTournament ? 'eventWizard.tournamentProgram.customizedLabel' : 'eventWizard.stage.customizedLabel',
                            'Personnalise',
                          )}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {state.isRecurrent ? (
                <Text style={[Fonts.p3Bold, Fonts.gold500]}>
                  {t('eventWizard.recap.recurrenceCount', { count: recurrencePreviewCount })}
                </Text>
              ) : null}
            </View>
          </View>

          {isTournament ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>Paramètres tournoi</Text>
                <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardTournamentSettings)}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Max équipes: ${state.tournamentMaxTeams ?? recapNotSet}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Effectif: ${state.tournamentMinRosterSize ?? recapNotSet} - ${state.tournamentMaxRosterSize ?? recapNotSet}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Équipes éphémères: ${state.tournamentAllowCustomTeams !== false ? 'Autorisees' : 'Desactivees'}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Mix clubs: ${state.tournamentAllowCrossClubPlayers === true ? 'Autorise' : 'Non autorise'}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Validation des équipes: ${validationValue}`}
                </Text>
                <Text style={[Fonts.p2, state.tournamentRulesText ? Fonts.neutral100 : Fonts.neutral300]}>
                  {state.tournamentRulesText || 'Aucune règle spécifique renseignée.'}
                </Text>
              </View>
            </View>
          ) : null}

          {isTournament ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>Structure du tournoi</Text>
                <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardTournamentStructure)}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p2, Fonts.neutral100]}>{`Format: ${tournamentFormatLabel}`}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Poules: ${tournamentGroupsSummary}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Qualifiés: ${tournamentQualificationSummary}`}
                </Text>
                {(state.tournamentFormatMode === 'groups_to_knockout' || state.tournamentFormatMode === 'knockout_only') ? (
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {`Bracket: ${state.tournamentKnockoutSize || recapNotSet}`}
                  </Text>
                ) : null}
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Tirage: ${tournamentSeedingSummary}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Génération matchs: ${tournamentGenerationSummary}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Points: V ${state.tournamentPointsWin ?? 3} | N ${state.tournamentPointsDraw ?? 1} | D ${state.tournamentPointsLoss ?? 0} | F ${state.tournamentPointsForfeit ?? 0}`}
                </Text>
                {(state.tournamentFormatMode === 'groups_to_knockout' || state.tournamentFormatMode === 'knockout_only') && state.tournamentThirdPlaceMatch ? (
                  <Text style={[Fonts.p2, Fonts.primary500]}>Petite finale activee</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('eventWizard.recap.participationTitle', 'Participation')}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(
                  shouldSkipParticipantsStep
                    ? RouteNames.EventWizardVisibility
                    : RouteNames.EventWizardParticipants,
                )}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.participants')}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {isTraining
                    ? t(
                      trainingOpenConfig.isOpenTraining
                        ? 'eventWizard.recap.trainingCapacityOpen'
                        : 'eventWizard.recap.trainingCapacityPrivate',
                      trainingOpenConfig.isOpenTraining
                        ? 'Illimité en interne + quota externe'
                        : 'Capacité illimitée (entraînement prive)',
                    )
                    : t('eventWizard.recap.capacity', { value: state.capacity ?? recapNotSet })}
                </Text>
              </View>
              {(isReservation || (isTraining && !trainingOpenConfig.isOpenTraining)) ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t(
                      isTraining
                        ? 'eventWizard.recap.trainingTotalPlayersTitle'
                        : 'eventWizard.recap.totalPlayersTitle',
                      isTraining ? 'Joueurs attendus (interne)' : 'Joueurs attendus',
                    )}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {t('eventWizard.recap.totalPlayers', { value: state.totalPlayers ?? recapNotSet })}
                  </Text>
                </View>
              ) : null}
              {isTraining
                && trainingOpenConfig.isOpenTraining
                && trainingOpenConfig.externalParticipantLimit !== null ? (
                  <View style={[Spaces.gap[4]]}>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {t('eventWizard.recap.externalQuotaTitle', 'Places externes')}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral100]}>
                      {`${trainingOpenConfig.externalParticipantLimit}`}
                    </Text>
                  </View>
                ) : null}
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.validation')}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {isTraining
                    ? t('eventWizard.recap.internalValidationMode', 'Membres internes: {{value}}', { value: validationValue })
                    : t('eventWizard.recap.validationMode', { value: validationValue })}
                </Text>
              </View>
              {isTraining
                && trainingOpenConfig.isOpenTraining
                && trainingOpenConfig.externalParticipantValidationMode ? (
                  <View style={[Spaces.gap[4]]}>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {t('eventWizard.recap.externalValidationTitle', 'Validation externe')}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral100]}>
                      {externalValidationValue}
                    </Text>
                  </View>
                ) : null}
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.visibility')}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>{visibilityValue}</Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t('eventWizard.recap.sections.participantPrivacy', 'Confidentialité participants')}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>{participantPrivacyValue}</Text>
              </View>
            </View>
          </View>

          {detectionSlots.length > 0 ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>
                  {t('eventWizard.steps.detectionSlots.title', 'Postes recherches')}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardDetectionSlots)}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'eventWizard.steps.detectionSlots.recapSummary',
                  '{{count}} place(s) cible au total',
                  { count: detectionSlotsTotal },
                )}
              </Text>

              <View style={[Spaces.gap[8]]}>
                {detectionSlots.map((slot) => (
                  <View
                    key={`${slot.position}-${slot.quantity}`}
                    style={[
                      ApplicationStyle.card,
                      Alignments.row,
                      Alignments.justifySpaceBetween,
                      Alignments.alignCenter,
                      Spaces.paddingHorizontal[12],
                      Spaces.paddingVertical[12],
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderColor: 'rgba(1, 179, 244, 0.20)',
                      },
                    ]}
                  >
                    <Text style={[Fonts.p2, Fonts.neutral100]}>{slot.position}</Text>
                    <Text style={[Fonts.p2Bold, Fonts.primary500]}>{`x${slot.quantity}`}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{t('eventWizard.recap.sections.description')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardDescription)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>
            <Text numberOfLines={3} style={[Fonts.p2, state.description ? Fonts.neutral100 : Fonts.gold500]}>
              {state.description || t('eventWizard.recap.noDescription')}
            </Text>
          </View>

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Spaces.gap[4]]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('eventWizard.recap.featured.title', 'Mise à la une')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200, { lineHeight: 20 }]}>
                {t(
                  'eventWizard.recap.featured.description',
                  "Optionnel : choisis les espaces ou demander la mise en avant. Rien n'est envoyé si aucune option n'est cochee.",
                )}
              </Text>
              {recurrencePreviewCount > 1 ? (
                <Text style={[Fonts.p3, Fonts.gold500, { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.recap.featured.recurrentNote',
                    'Pour une récurrence, la demande sera envoyée pour chaque occurrence créée.',
                  )}
                </Text>
              ) : null}
            </View>

            <View style={[Spaces.gap[8]]}>
              {FEATURED_SCOPE_OPTIONS.map((option) => {
                const isSelected = selectedFeaturedScopes.includes(option.value);

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={option.value}
                    onPress={() => toggleFeaturedScope(option.value)}
                    style={[
                      ApplicationStyle.borderRadius16,
                      ApplicationStyle.borderWidth1,
                      Spaces.padding[12],
                      {
                        backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.16)' : 'rgba(1, 179, 244, 0.06)',
                        borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.20)',
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                      <View
                        style={[
                          Alignments.alignCenter,
                          Alignments.justifyCenter,
                          {
                            backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                            borderColor: Colors.primary500,
                            borderRadius: 999,
                            borderWidth: 1,
                            height: 22,
                            width: 22,
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>x</Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p2Bold, isSelected ? Fonts.primary500 : Fonts.neutral00]}>
                          {option.label}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral300, { marginTop: 2 }]}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {isReservation ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{t('eventWizard.recap.sections.reservation')}</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('eventWizard.recap.pricePerPerson', { value: state.pricePerPerson ?? recapNotSet })}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('eventWizard.recap.reservationMode', {
                  value: state.reservationMode === 'RECRUITING'
                    ? t('reservation.mode.recruiting')
                    : t('reservation.mode.fullGroup'),
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </WizardStepLayout>

      <BottomModal
        close={() => setPartialState(null)}
        isVisible={Boolean(partialState)}
        scrollable={false}
      >
        <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventWizard.partial.title')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('eventWizard.partial.summary', {
              failed: partialState?.failed?.length || 0,
              success: partialState?.created?.length || 0,
            })}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {partialState ? getFailureSummary(partialState.failed) : ''}
          </Text>

          <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
            <Button
              isLoading={isSubmitting}
              onPress={handleKeepCreated}
              title={t('eventWizard.partial.actions.keep')}
              variant="Primary"
            />
            <Button
              isLoading={isSubmitting}
              onPress={handleRetryFailed}
              title={t('eventWizard.partial.actions.retry')}
              variant="Secondary"
            />
            <Button
              isLoading={isSubmitting}
              onPress={handleRollbackCreated}
              title={t('eventWizard.partial.actions.rollback')}
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={clubVerificationSummary?.clubDocumentId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </>
  );
}

export default EventWizardRecap;
