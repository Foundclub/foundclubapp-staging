import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useEvent from '@/domains/event/useEvent';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { createEventsSequentially, rollbackEventsByCancel } from '@/services/event/eventService';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardRecapStepIndex,
  getEventWizardStepCount,
  isStageEventType,
  isTournamentEventType,
} from './eventWizardDetectionUtils';

const getErrorCode = (error) => (
  error?.response?.data?.error?.details?.code
  || error?.response?.data?.error?.code
  || error?.response?.data?.code
  || null
);

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const buildWizardFormData = (wizardState) => {
  const isTournament = isTournamentEventType(wizardState?.type?.name);
  const eventDate = wizardState.date ? new Date(wizardState.date) : new Date();
  const start = wizardState.startTime ? new Date(wizardState.startTime) : new Date(eventDate);
  const end = wizardState.endTime ? new Date(wizardState.endTime) : new Date(start.getTime() + (60 * 60000));

  return {
    capacity: wizardState.capacity ?? null,
    date: format(eventDate, 'dd/MM/yyyy'),
    description: wizardState.description || '',
    detectionSlots: Array.isArray(wizardState.detectionSlots) ? wizardState.detectionSlots : [],
    endTime: format(end, 'HH:mm'),
    facility: wizardState.facility,
    invitedTeams: Array.isArray(wizardState.invitedTeams) ? wizardState.invitedTeams : [],
    isRecurrent: Boolean(wizardState.isRecurrent),
    location: wizardState.location,
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
    team: wizardState.team?.documentId,
    totalPlayers: wizardState.totalPlayers ?? null,
    tournamentConfig: isTournament ? {
      allowCrossClubPlayers: wizardState.tournamentAllowCrossClubPlayers === true,
      allowCustomTeams: wizardState.tournamentAllowCustomTeams !== false,
      maxRosterSize: wizardState.tournamentMaxRosterSize ?? null,
      maxTeams: wizardState.tournamentMaxTeams ?? null,
      minRosterSize: wizardState.tournamentMinRosterSize ?? null,
      registrationMode: wizardState.tournamentRegistrationMode || 'manual',
      rulesText: wizardState.tournamentRulesText || '',
    } : undefined,
    type: wizardState.type?.documentId,
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
  const { dispatch, state } = useEventWizard();
  const { createReccurrentEventPayload, createStageEventPayload } = useEvent();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partialState, setPartialState] = useState(null);
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const isReservation = String(state.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('reservation');
  const isStage = isStageEventType(state.type?.name);
  const isTournament = isTournamentEventType(state.type?.name);

  const wizardFormData = useMemo(() => buildWizardFormData(state), [state]);

  const plannedPayloads = useMemo(
    () => (isStage
      ? [createStageEventPayload(wizardFormData)]
      : createReccurrentEventPayload(wizardFormData)),
    [createReccurrentEventPayload, createStageEventPayload, isStage, wizardFormData],
  );

  const recurrencePreviewCount = plannedPayloads.length;
  const recapNotSet = t('eventWizard.recap.notSet');

  const getLocationDisplayText = () => {
    const { location } = state;
    if (!location) return t('eventWizard.recap.notSet');
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
  const teamValue = state.team?.name || recapNotSet;
  const dateValue = getFormattedDate();
  const timeValue = getFormattedTime();
  const locationValue = getLocationDisplayText();
  const visibilityValue = state.sessionStatus === 'closed'
    ? t('eventWizard.steps.visibility.team')
    : t('eventWizard.steps.visibility.public');
  const effectiveValidationMode = isTournament
    ? (state.tournamentRegistrationMode || 'manual')
    : (state.validationMode || 'auto');
  const validationValue = effectiveValidationMode === 'manual'
    ? t('eventEdit.fields.validationMode.options.manual')
    : t('eventEdit.fields.validationMode.options.auto');
  const invitedCount = state.invitedTeams?.length || 0;
  const detectionSlots = Array.isArray(state.detectionSlots) ? state.detectionSlots : [];
  const detectionSlotsTotal = detectionSlots.reduce((sum, slot) => sum + Number(slot?.quantity || 0), 0);
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
  const stagePeriodValue = isStage && state.stageStartDate && state.stageEndDate
    ? `${format(new Date(state.stageStartDate), 'dd/MM/yyyy')} - ${format(new Date(state.stageEndDate), 'dd/MM/yyyy')}`
    : dateValue;
  let stageHoursValue = timeValue;
  if (isStage) {
    stageHoursValue = stageHasVariableHours
      ? t('eventWizard.stage.variableHours', 'Horaires variables')
      : `${format(new Date(state.stageDefaultStartTime || state.startTime), 'HH:mm')} - ${format(new Date(state.stageDefaultEndTime || state.endTime), 'HH:mm')}`;
  }
  const hasType = Boolean(state.type?.name);
  const hasTeam = Boolean(state.team?.name);
  const hasDate = Boolean(isStage ? state.stageStartDate && state.stageEndDate : state.date);
  const hasTime = Boolean(isStage ? state.stageDefaultStartTime && state.stageDefaultEndTime : state.startTime && state.endTime);
  const hasLocation = Boolean(state.location || state.facility);
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
      complete: Boolean(state.validationMode),
      label: t('eventWizard.recap.sections.validation'),
      value: validationValue,
    },
  ];
  const completedQuickOverviewCount = quickOverviewItems.filter((item) => item.complete).length;
  const isRecapReady = completedQuickOverviewCount === quickOverviewItems.length;

  const runCreateBatch = async (payloads) => {
    const result = await createEventsSequentially(payloads);
    return {
      created: result.created,
      failed: result.failed.map((item) => ({
        code: getErrorCode(item.error),
        error: item.error,
        payload: item.payload,
      })),
    };
  };

  const finalizeSuccess = async (created) => {
    const firstCreatedId = created.find((item) => item.documentId)?.documentId;
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    dispatch({ type: 'RESET' });

    if (firstCreatedId) {
      navigation.reset({
        index: 0,
        routes: [{
          name: RouteNames.EventDetails,
          params: {
            eventId: firstCreatedId,
            fromEventCreation: true,
          },
        }],
      });
      return;
    }

    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList });
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
    try {
      const { created, failed } = await runCreateBatch(plannedPayloads);
      if (failed.length === 0) {
        await finalizeSuccess(created);
        return;
      }

      if (created.length === 0) {
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
      Alert.alert(
        t('common.error', 'Erreur'),
        submitError?.message || t('eventWizard.errors.genericCreate'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeepCreated = async () => {
    if (!partialState) return;
    setIsSubmitting(true);
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
    }
  };

  const handleRollbackCreated = async () => {
    if (!partialState) return;
    setIsSubmitting(true);
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
        nextLabel={t('eventWizard.recap.actions.createShort', 'CrÃ©er')}
        onBack={() => navigation.goBack()}
        onNext={handleSubmit}
        stepCount={getEventWizardStepCount(state)}
        stepIndex={getEventWizardRecapStepIndex(state)}
        subtitle={t('eventWizard.steps.recap.subtitle')}
        title={t('eventWizard.steps.recap.title')}
      >
        <View style={[Spaces.gap[16]]}>
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
                    ? t('eventWizard.recap.ready', 'PrÃªt a crÃ©er')
                    : t('eventWizard.recap.incomplete', 'Ã  complÃ©ter')}
                </Text>
              </View>
            </View>

            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventWizard.recap.completedCount', '{{done}}/5 infos clÃ©s complÃ©tÃ©es', {
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
              {!isStage && !isTournament ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t('eventWizard.recap.invitedTeamsTitle', 'Ã‰quipes invitees')}
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
                {isStage
                  ? t('eventWizard.stage.recapProgramTitle', 'Programme du stage')
                  : t('eventWizard.recap.whenWhereTitle', 'Quand et lieu')}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(
                  isStage ? RouteNames.EventWizardStageProgram : RouteNames.EventWizardLogistics,
                )}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {isStage
                    ? t('eventWizard.stage.periodTitle', 'Periode')
                    : t('eventWizard.recap.dateLabel', 'Date')}
                </Text>
                <Text style={[Fonts.p2, hasDate ? Fonts.neutral00 : Fonts.gold500]}>
                  {isStage ? stagePeriodValue : dateValue}
                </Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {isStage
                    ? t('eventWizard.stage.defaultHoursTitle', 'Horaires par defaut')
                    : t('eventWizard.recap.timeLabel', 'Horaire')}
                </Text>
                <Text style={[Fonts.p1Bold, hasTime ? Fonts.primary500 : Fonts.gold500]}>
                  {isStage ? stageHoursValue : timeValue}
                </Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.location')}</Text>
                <Text style={[Fonts.p2, hasLocation ? Fonts.neutral00 : Fonts.gold500]}>{locationValue}</Text>
              </View>
              {isStage ? (
                <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t('eventWizard.stage.daysTitle', 'Jours du stage')}
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
                        Spaces.paddingVertical[10],
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
                          {t('eventWizard.stage.customizedLabel', 'Personnalise')}
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
                <Text style={[Fonts.h4, Fonts.neutral00]}>Parametres tournoi</Text>
                <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardTournamentSettings)}>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Max equipes: ${state.tournamentMaxTeams ?? recapNotSet}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Effectif: ${state.tournamentMinRosterSize ?? recapNotSet} - ${state.tournamentMaxRosterSize ?? recapNotSet}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Equipes ephemeres: ${state.tournamentAllowCustomTeams !== false ? 'Autorisees' : 'Desactivees'}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Mix clubs: ${state.tournamentAllowCrossClubPlayers === true ? 'Autorise' : 'Non autorise'}`}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`Validation des equipes: ${validationValue}`}
                </Text>
                <Text style={[Fonts.p2, state.tournamentRulesText ? Fonts.neutral100 : Fonts.neutral300]}>
                  {state.tournamentRulesText || 'Aucune regle specifique renseignee.'}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('eventWizard.recap.participationTitle', 'Participation')}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardParticipants)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.participants')}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t('eventWizard.recap.capacity', { value: state.capacity ?? recapNotSet })}
                </Text>
              </View>
              {isReservation ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t('eventWizard.recap.totalPlayersTitle', 'Joueurs attendus')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {t('eventWizard.recap.totalPlayers', { value: state.totalPlayers ?? recapNotSet })}
                  </Text>
                </View>
              ) : null}
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.validation')}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t('eventWizard.recap.validationMode', { value: validationValue })}
                </Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.visibility')}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>{visibilityValue}</Text>
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
                      Spaces.paddingVertical[10],
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
    </>
  );
}

export default EventWizardRecap;
