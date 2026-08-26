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
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import {
  extractSubscriptionDecisionFromError,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import { getEventShowcaseTemplate, isEventShowcaseOffered } from '@/domains/visuals/eventShowcaseTemplate';
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
  saveEventCompositionDraft,
} from '@/services/event/eventService';

import EventTasksEditor from '../components/EventTasksEditor';
import { useEventWizard } from './EventWizardContext';
import {
  EVENT_WIZARD_RETURN_TO_RECAP,
  getDefaultSessionStatusForEventType,
  getEventWizardRecapStepIndex,
  getEventWizardStepCount,
  hasCompletePerDayLocations,
  isMatchEventType,
  isStageEventType,
  isTournamentEventType,
  shouldSkipEventWizardParticipantsStep,
} from './eventWizardDetectionUtils';
import { keepAudiencesForEventType } from './useEventWizardAudiences';

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

/**
 * Rafraichit SANS retenir l'ecran les caches devenus faux a la creation.
 *
 * 🧨 Defaut trouve a la recette du 2026-08-07 — « appuyer sur Creer met un peu
 * de temps ». Ce n'etait pas la creation : elle part deja a trois de front et
 * montre sa progression. C'etait CECI, juste apres, en file indienne :
 * six `await queryClient.invalidateQueries(...)` a la suite, chacun attendant
 * la refetch de ses requetes actives avant de lancer le suivant. Pendant ces
 * six allers-retours, l'ecran reste fige sur « c'est cree » sans rien montrer.
 *
 * Mesure du 07/08, avec chaque aller-retour double par 30 ms exactement :
 * 235 ms entre l'appui et le changement d'ecran, dont 30 ms de creation reelle
 * ⇒ 205 ms d'attente pure, et 157 ms rien qu'entre le depart de la premiere
 * invalidation et celui de la derniere. Sur un reseau reel (150 a 300 ms par
 * aller-retour), la meme file indienne coute entre 0,9 et 1,8 seconde.
 *
 * ⚠️ Ne pas attendre ne perd RIEN, et ce n'est pas un pari : `invalidateQueries`
 * marque les requetes perimees de facon SYNCHRONE — seule la refetch est
 * asynchrone. Et le `queryClient` est un singleton, il survit au demontage de
 * cet ecran : la refetch se termine meme apres le changement de vue.
 * @param {any} queryClient Le client de cache de l'application.
 */
const refreshCachesAfterEventCreation = (queryClient) => {
  // U05 — la liste vit desormais dans `domains/refresh/afterAction.js`, avec
  // les neuf autres actions. Elle y gagne `home-summary`, que cet ecran
  // oubliait : l'accueil annonce le prochain evenement.
  invalidateAfterAction(queryClient, 'createEvent').catch(() => {});
};

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
    // Y02 : l'adversaire part au serveur. `null` plutot que `''` quand il est
    // inconnu — le lifecycle range les deux au meme endroit, mais `null` dit
    // « pas d'adversaire » sans ambiguite dans la colonne.
    opponentName: isMatchEventType(wizardState?.type?.name)
      ? (String(wizardState.opponentName || '').trim() || null)
      : null,
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
    // 🔒 AA10 ③ — le repli de la DERNIERE ligne avant le serveur suit le type,
    // il ne rouvre pas l'evenement : un brouillon incomplet part prive.
    sessionStatus: wizardState.sessionStatus
      || getDefaultSessionStatusForEventType(wizardState?.type?.name),
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
    // 🔒 S10-B — LES EXTERNES N'EXISTENT QUE SUR UN MATCH, et le filtre est ICI
    // parce que c'est la DERNIERE ligne avant le serveur. Un brouillon web
    // persiste en `sessionStorage` : on peut donc commencer un match, inviter
    // une equipe adverse, puis repasser le type en « Entrainement » — l'audience
    // externe resterait dans l'etat, invisible a l'ecran (plus aucune etape ne
    // la montre) et partirait quand meme a la creation.
    teamAudiences: keepAudiencesForEventType(wizardState),
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
  // Une seule option avancee ouverte a la fois : `'tasks'`, `'featured'`, ou
  // rien. Les invitations, elles, sont un ECRAN — leur rangee y navigue.
  const [expandedAdvanced, setExpandedAdvanced] = useState(null);
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const toggleAdvanced = (key) => {
    setExpandedAdvanced((current) => (current === key ? null : key));
  };

  const isReservation = String(state.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('reservation');
  const isTraining = isTrainingEventType(state.type?.name);
  const isMatch = isMatchEventType(state.type?.name);
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
  // D58 — la valeur seule, le label vit au-dessus (pack §2.8). Sans capacite
  // saisie on retombe sur « Non renseigné » : « Non renseigné joueurs » n'aurait
  // aucun sens.
  const capacityValueLabel = state.capacity
    ? t('eventWizard.recap.capacityValue', '{{count}} joueurs', { count: state.capacity })
    : recapNotSet;
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

  // Les 3 valeurs affichees sur les rangees d'« Options avancees ». Repliee,
  // une option doit quand meme dire ce qu'elle contient : sinon l'organisateur
  // publie sans savoir ce qu'il emporte.
  const advancedNone = t('eventWizard.recap.advanced.none', 'Aucune');
  // Y02 — l'adversaire, dit en toutes lettres avant de publier. ⛔ Il n'entre PAS
  // dans `quickOverviewItems` : ces 5 rangees decident de `isRecapReady`, et un
  // match sans adversaire connu doit rester publiable (l'etape est sautable).
  const opponentSummary = String(state.opponentName || '').trim()
    || t('eventWizard.recap.advanced.opponentNone', 'Pas encore connu');
  const invitesSummary = teamAudiences.length
    ? t('eventWizard.recap.advanced.invitesCount', '{{count}} equipe(s)', {
      count: teamAudiences.length,
    })
    : advancedNone;
  const tasksSummary = eventTasks.length
    ? `${eventTasks.length} · ${eventTasks[0]?.title || ''}`.trim()
    : advancedNone;
  const featuredSummary = hasFeaturedRequestSelection
    ? t('eventWizard.recap.advanced.featuredCount', '{{count}} espace(s)', {
      count: selectedFeaturedScopes.length,
    })
    : t('eventWizard.recap.advanced.no', 'Non');

  /**
   * Une rangee d'« Options avancees » : libelle a gauche, VALEUR a droite,
   * chevron. Presser deplie le contenu, sauf pour les invitations, qui sont un
   * ecran a part entiere et vers lequel on navigue.
   * @param {object} options Parametres de la rangee.
   * @param {string} options.label Le libelle affiche.
   * @param {() => void} options.onPress Ce que fait la pression.
   * @param {boolean} [options.isExpanded] La rangee est-elle depliee ?
   * @param {boolean} [options.isFirst] Premiere rangee (pas de filet au-dessus).
   * @param {string} options.value La valeur resumee.
   * @returns {import('react').ReactElement}
   */
  const renderAdvancedRow = ({
    isExpanded, isFirst, label, onPress, value,
  }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isExpanded === undefined ? undefined : { expanded: isExpanded }}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
        {
          borderTopColor: 'rgba(255, 255, 255, 0.07)',
          borderTopWidth: isFirst ? 0 : 1,
          minHeight: 44,
        },
      ]}
    >
      <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{label}</Text>
      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{value}</Text>
      <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{isExpanded ? '−' : '›'}</Text>
    </TouchableOpacity>
  );

  /**
   * Ouvrir une etape depuis le recapitulatif — EN L'EMPILANT, pas en y
   * retournant.
   *
   * 🧨 Defaut trouve a la recette du 2026-08-07 : « modifier » ouvrait bien la
   * bonne etape, mais une fois la correction faite il fallait RETRAVERSER
   * toutes les etapes suivantes. Deux causes cumulees, et il fallait les deux :
   *
   *  1. `navigate` vers un ecran DEJA present dans la pile y revient en
   *     DEPILANT. Le recapitulatif — qui est tout en haut — etait donc detruit :
   *     il n'y avait plus rien ou revenir, l'etape ne pouvait qu'enchainer.
   *  2. l'etape ne recevait AUCUN parametre. Meme si le recap avait survecu,
   *     elle n'aurait pas su qu'elle avait ete ouverte depuis lui.
   *
   * `push` empile une nouvelle copie de l'etape AU-DESSUS du recapitulatif, qui
   * reste en dessous. C'est ce qui rend le retour arriere physique coherent
   * — fleche d'en-tete ET geste iOS — sans une seule ligne dans les etapes :
   * leur `goBack` retombe naturellement sur le recap. Le billet de retour, lui,
   * ne sert plus qu'a « Suivant ».
   * @param {string} routeName L'etape a ouvrir.
   */
  const openStepFromRecap = (routeName) => {
    navigation.push(routeName, EVENT_WIZARD_RETURN_TO_RECAP);
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

  /**
   * AC04 — LA CONVOCATION, REJOUEE UNE FOIS L'EVENEMENT NE.
   *
   * 🎯 C'est le point dur du lot, et il n'a qu'une reponse honnete : une
   * convocation se pose SUR un evenement, or a l'etape Participants l'evenement
   * n'existe pas encore. Les joueurs coches voyagent donc dans le tunnel
   * (`matchCallUpPlayerIds`), et c'est ICI — le premier instant ou un
   * `documentId` existe — qu'ils deviennent un vrai brouillon de composition,
   * par la route que `MatchCallUpSelection` emprunte deja.
   *
   * ⛔ CE GESTE NE PEUT PAS FAIRE ECHOUER LA CREATION. Deux raisons mesurees :
   *  1. la route est derriere un mur d'abonnement — `composition.manage`,
   *     offres Equipe/Club (`admin/src/api/event/controllers/event.ts:519`) :
   *     un organisateur GRATUIT recevra un 403, et son match doit exister quand
   *     meme ;
   *  2. l'evenement est deja cree quand on arrive ici. Remonter l'erreur
   *     declencherait la bannière d'echec sur un succes.
   * ⇒ `allSettled`, et on ne regarde meme pas le resultat. La convocation se
   * reprend depuis la fiche du match, ou elle vit normalement.
   *
   * 📌 Un BROUILLON, pas une publication : personne n'est prevenu tant que
   * l'organisateur n'a pas appuye sur « Publier la convocation ».
   * @param {any[]} created Les evenements rendus par le serveur.
   * @returns {Promise<void>} Rien — les echecs sont volontairement avales.
   */
  const saveCallUpForCreatedEvents = async (created = []) => {
    if (!isMatchEventType(state?.type?.name)) return;

    const calledUpIds = Array.isArray(state?.matchCallUpPlayerIds)
      ? state.matchCallUpPlayerIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (calledUpIds.length === 0) return;

    const teamId = String(state?.team?.documentId || state?.team?.id || '');
    const createdEventIds = Array.from(new Set(
      created.map((item) => String(item?.documentId || '').trim()).filter(Boolean),
    ));
    if (!teamId || createdEventIds.length === 0) return;

    await Promise.allSettled(createdEventIds.map((eventId) => saveEventCompositionDraft(eventId, {
      // ⛔ Aucun mecanisme neuf : c'est la forme que `buildMatchCompositionPack`
      // produit deja, reduite a ce qu'une convocation SANS placement contient.
      // Le terrain, les postes et les remplacants se remplissent plus tard,
      // depuis la fiche du match.
      draft: {
        manualPlayers: [],
        mode: 'manual',
        placementMode: 'free',
        requireResponse: true,
        reservePlayerIds: [],
        schemaVersion: 3,
        selectedPlayerIds: calledUpIds,
        teams: [],
        visibility: 'team',
      },
      teamId,
    })));
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
    // AC04 — avant le `RESET` du tunnel, sinon les joueurs coches auraient
    // deja disparu de l'etat au moment de les envoyer.
    await saveCallUpForCreatedEvents(created);
    // Lance les six d'un coup et n'attend rien : voir le pourquoi chiffre sur
    // `refreshCachesAfterEventCreation`.
    refreshCachesAfterEventCreation(queryClient);

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
      //
      // D99 (2026-08-13) — SAUF POUR UN ENTRAÎNEMENT, qui n'a plus d'affiche
      // (décision d'Adel ; le pourquoi est écrit dans `eventShowcaseTemplate.js`).
      // ⚠️ C'est le point d'entrée le plus DISCRET des deux : ici personne ne
      // demande à voir l'affiche, elle s'ouvre toute seule. Fermer la chip du
      // menu « Gérer » sans fermer celui-ci n'aurait rien protégé.
      // ⛔ L'organisateur ne perd RIEN : il atterrit sur le détail de son
      // entraînement, célébration de création comprise, et le chemin vers une
      // détection l'attend dans « Gérer l'événement ».
      const routes = [{
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
      }];

      if (isEventShowcaseOffered(state.type?.name)) {
        routes.push({
          name: RouteNames.EventPublishedShowcase,
          // D28 : le gabarit voyage avec l'evenement qu'on vient de publier.
          // `state` est celui de la fermeture de rendu — le `dispatch RESET`
          // ci-dessus vide le tunnel pour la PROCHAINE creation, il ne change
          // pas cette valeur-ci.
          params: {
            creationCelebration,
            eventId: firstCreatedId,
            // D94/C2 : le type voyage aussi — c'est lui qui decide le TEXTE du
            // partage, pas seulement le gabarit.
            eventTypeName: state.type?.name,
            template: getEventShowcaseTemplate(state.type?.name),
          },
        });
      }

      // L'index SUIT la pile : figé à 1, il viserait un écran absent le jour où
      // la pile n'en compte qu'un.
      navigation.reset({ index: routes.length - 1, routes });
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
        headerVariant="focus"
        isNextDisabled={!isRecapReady}
        isNextLoading={isSubmitting}
        nextLabel={t('eventWizard.recap.actions.createShort', 'Creer')}
        onBack={() => navigation.goBack()}
        onNext={handleSubmit}
        stepCount={getEventWizardStepCount(state)}
        stepIndex={getEventWizardRecapStepIndex(state)}
        subtitle={t(
          'eventWizard.steps.recap.subtitleShort',
          'Relis, corrige, puis crée. Tout reste modifiable après.',
        )}
        title={t('eventWizard.steps.recap.title')}
      >
        <View style={[Spaces.gap[12]]}>
          {/* La carte « Vue d'ensemble » et ses 5 pastilles disparaissent :
              elles recopiaient mot pour mot Type, Equipe, Date, Lieu et
              Validation, qui sont juste en dessous. Ce qui RESTE est le seul
              morceau qu'elles apportaient : la raison pour laquelle le bouton
              « Creer » est parfois eteint. */}
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Alignments.justifySpaceBetween,
              Spaces.gap[12],
            ]}
          >
            <Text style={[Fonts.p3, Fonts.neutral200, { flex: 1 }]}>
              {t('eventWizard.recap.completedCount', '{{done}}/5 infos cles completees', {
                done: completedQuickOverviewCount,
              })}
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
              <TouchableOpacity onPress={() => openStepFromRecap(RouteNames.EventWizardType)}>
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
                  : t('eventWizard.recap.dateTimeTitle', 'Date & horaire')}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => openStepFromRecap(
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
              {/* Le lieu quitte cette carte pour la sienne, comme dans le
                  tunnel — SAUF sur un programme multi-jours, ou il n'y a pas
                  UN lieu mais un lieu par jour, edite dans le programme. */}
              {isMultiDayProgram ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.location')}</Text>
                  <Text style={[Fonts.p2, hasLocation ? Fonts.neutral00 : Fonts.gold500]}>{locationValue}</Text>
                </View>
              ) : null}
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

          {/* LE LIEU A SA PROPRE CARTE, et surtout son propre lien : jusqu'ici,
              corriger l'installation obligeait a repasser par « Quand et lieu »
              donc par l'ecran Date & horaire. `EventWizardLocation` n'etait
              atteignable depuis le Recap par AUCUN chemin. */}
          {!isMultiDayProgram ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>
                  {t('eventWizard.recap.sections.location')}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => openStepFromRecap(RouteNames.EventWizardLocation)}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('eventWizard.recap.actions.edit')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[Fonts.p2, hasLocation ? Fonts.neutral00 : Fonts.gold500]}>
                {locationValue}
              </Text>
            </View>
          ) : null}

          {isTournament ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>Paramètres tournoi</Text>
                <TouchableOpacity onPress={() => openStepFromRecap(RouteNames.EventWizardTournamentSettings)}>
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
                <TouchableOpacity onPress={() => openStepFromRecap(RouteNames.EventWizardTournamentStructure)}>
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
                onPress={() => openStepFromRecap(
                  shouldSkipParticipantsStep
                    ? RouteNames.EventWizardAccess
                    : RouteNames.EventWizardParticipants,
                )}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                {/* D58 — pack §2.8 : « La valeur ne repete jamais le label ».
                    C'etait « Participants » surmontant « Participants max: 12 » ;
                    c'est desormais l'exemple du pack, « Capacité → 12 joueurs ».
                    ⚠️ Cles NEUVES a dessein : `sections.participants` et
                    `recap.capacity` existent dans `fr.js`, qui gagne toujours
                    sur le repli — les modifier la-bas compterait comme une
                    suppression, que ce lot s'interdit. */}
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t('eventWizard.recap.capacityTitle', 'Capacité')}
                </Text>
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
                    : capacityValueLabel}
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
                    {/* D58 — le label « Joueurs attendus » est juste au-dessus. */}
                    {`${state.totalPlayers ?? recapNotSet}`}
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
                  {/* D58 — le label « Validation » est juste au-dessus. La
                      variante entrainement garde son prefixe : « Membres
                      internes » qualifie QUI valide, il ne repete pas le label. */}
                  {isTraining
                    ? t('eventWizard.recap.internalValidationMode', 'Membres internes: {{value}}', { value: validationValue })
                    : validationValue}
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
                {/* D58 — les postes sont une section de l'etape Participants
                    depuis la fusion : c'est la que « Modifier » ramene. */}
                <TouchableOpacity onPress={() => openStepFromRecap(RouteNames.EventWizardParticipants)}>
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
              {state.description ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => openStepFromRecap(RouteNames.EventWizardDescription)}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('eventWizard.recap.actions.edit')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* Une description manquante n'est pas une valeur absente a
                signaler en orange : c'est une INVITATION A AGIR. Le lien
                « Modifier » cede donc la place au geste lui-meme. */}
            {state.description ? (
              <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
                {state.description}
              </Text>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => openStepFromRecap(RouteNames.EventWizardDescription)}
                style={[
                  ApplicationStyle.card,
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.08)',
                    borderColor: 'rgba(1, 179, 244, 0.40)',
                    borderStyle: 'dashed',
                    minHeight: 44,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('eventWizard.recap.addDescription', '+ Ajouter une description')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ═══ OPTIONS AVANCEES ═══
              Le pack replie ici les trois reglages rares : invitations,
              taches annexes, mise a la une. Ils occupaient jusqu'a present
              deux cartes en HAUT du Recap et une en bas — soit les premiers
              blocs qu'on lisait, pour les reglages qu'on utilise le moins.
              ⛔ La carte, elle, n'est PAS repliee : ses trois rangees sont
              toujours a l'ecran, valeur comprise. C'est ce qui garantit que les
              invitations restent a UNE pression du Recap. */}
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[4], cardSurfaceStyle]}>
            <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[4]]}>
              {t('eventWizard.recap.advanced.title', 'Options avancées')}
            </Text>

            {/* Y02 : l'adversaire n'apparait que pour un match, et il mene a
                l'etape « Contre qui ? » — y compris quand elle a ete sautee. */}
            {isMatch ? renderAdvancedRow({
              isFirst: true,
              label: t('eventWizard.recap.advanced.opponent', 'Adversaire'),
              onPress: () => openStepFromRecap(RouteNames.EventWizardOpponent),
              value: opponentSummary,
            }) : null}
            {/* 🚚 S10-B — LA RANGEE RESTE, SA DESTINATION CHANGE. Les
                invitations ne sont plus un ecran a part : elles sont une section
                de l'etape « Participants ». La rangee y mene donc desormais, et
                elle garde exactement sa mission d'avant — l'ATTEIGNABILITE.
                ⚠️ Le billet `EVENT_WIZARD_RETURN_TO_RECAP` que `push` depose ne
                sert plus seulement au retour : sur un entrainement PRIVE, dont
                l'etape Participants est sautee, c'est lui qui autorise l'etape a
                se rendre au lieu de rediriger. Sans lui, un entrainement prive ne
                pourrait plus jamais inviter une equipe. */}
            {renderAdvancedRow({
              isFirst: !isMatch,
              label: t('eventWizard.recap.advanced.invites', 'Invitations'),
              onPress: () => openStepFromRecap(RouteNames.EventWizardParticipants),
              value: invitesSummary,
            })}
            {renderAdvancedRow({
              isExpanded: expandedAdvanced === 'tasks',
              label: t('eventWizard.recap.advanced.tasks', 'Tâches annexes'),
              onPress: () => toggleAdvanced('tasks'),
              value: tasksSummary,
            })}
            {expandedAdvanced === 'tasks' ? (
              <EventTasksEditor
                editable
                onChange={(nextTasks) => dispatch({ payload: { eventTasks: nextTasks }, type: 'SET_META' })}
                value={eventTasks}
              />
            ) : null}
            {renderAdvancedRow({
              isExpanded: expandedAdvanced === 'featured',
              label: t('eventWizard.recap.featured.title', 'Mise à la une'),
              onPress: () => toggleAdvanced('featured'),
              value: featuredSummary,
            })}
            {expandedAdvanced === 'featured' ? (
              <View style={[Spaces.gap[8], Spaces.paddingBottom[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.recap.featured.descriptionShort',
                    "Rien n'est envoyé si aucun espace n'est coché.",
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
                {FEATURED_SCOPE_OPTIONS.map((option) => {
                  const isSelected = selectedFeaturedScopes.includes(option.value);

                  return (
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
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
                          minHeight: 44,
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
                        <Text style={[Fonts.p2, isSelected ? Fonts.primary500 : Fonts.neutral00, { flex: 1 }]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
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
        contextLabel={state.type?.name || 'Ton événement'}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
        resumeRouteName={RouteNames.EventStack}
        resumeRouteParams={{ screen: RouteNames.EventWizardRecap }}
      />
    </>
  );
}

export default EventWizardRecap;
