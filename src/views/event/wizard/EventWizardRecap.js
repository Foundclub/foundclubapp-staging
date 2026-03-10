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

const getErrorCode = (error) => (
  error?.response?.data?.error?.details?.code
  || error?.response?.data?.error?.code
  || error?.response?.data?.code
  || null
);

const buildWizardFormData = (wizardState) => {
  const eventDate = wizardState.date ? new Date(wizardState.date) : new Date();
  const start = wizardState.startTime ? new Date(wizardState.startTime) : new Date(eventDate);
  const end = wizardState.endTime ? new Date(wizardState.endTime) : new Date(start.getTime() + (60 * 60000));

  return {
    capacity: wizardState.capacity ?? null,
    date: format(eventDate, 'dd/MM/yyyy'),
    description: wizardState.description || '',
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
    startTime: format(start, 'HH:mm'),
    team: wizardState.team?.documentId,
    totalPlayers: wizardState.totalPlayers ?? null,
    type: wizardState.type?.documentId,
    validationMode: wizardState.validationMode || 'auto',
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
  const { createReccurrentEventPayload } = useEvent();
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

  const wizardFormData = useMemo(() => buildWizardFormData(state), [state]);

  const plannedPayloads = useMemo(
    () => createReccurrentEventPayload(wizardFormData),
    [createReccurrentEventPayload, wizardFormData],
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
  const validationValue = state.validationMode === 'manual'
    ? t('eventEdit.fields.validationMode.options.manual')
    : t('eventEdit.fields.validationMode.options.auto');
  const invitedCount = state.invitedTeams?.length || 0;
  const hasType = Boolean(state.type?.name);
  const hasTeam = Boolean(state.team?.name);
  const hasDate = Boolean(state.date);
  const hasTime = Boolean(state.startTime && state.endTime);
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
      value: hasDate && hasTime ? `${dateValue} - ${timeValue}` : recapNotSet,
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

      setPartialState({
        created,
        failed,
      });
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
        isNextLoading={isSubmitting}
        nextLabel={t('eventWizard.recap.actions.createShort', 'Creer')}
        onBack={() => navigation.goBack()}
        onNext={handleSubmit}
        stepCount={10}
        stepIndex={10}
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
                {t('eventWizard.recap.quickOverviewTitle', 'Vue d ensemble')}
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
                    ? t('eventWizard.recap.ready', 'Pret a creer')
                    : t('eventWizard.recap.incomplete', 'A completer')}
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
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t('eventWizard.recap.invitedTeamsTitle', 'Equipes invitees')}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t('eventWizard.recap.invitesCount', { count: invitedCount })}
                </Text>
              </View>
            </View>
          </View>

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('eventWizard.recap.whenWhereTitle', 'Quand et lieu')}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.EventWizardLogistics)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[Spaces.gap[8]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.dateLabel', 'Date')}</Text>
                <Text style={[Fonts.p2, hasDate ? Fonts.neutral00 : Fonts.gold500]}>{dateValue}</Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.timeLabel', 'Horaire')}</Text>
                <Text style={[Fonts.p1Bold, hasTime ? Fonts.primary500 : Fonts.gold500]}>{timeValue}</Text>
              </View>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('eventWizard.recap.sections.location')}</Text>
                <Text style={[Fonts.p2, hasLocation ? Fonts.neutral00 : Fonts.gold500]}>{locationValue}</Text>
              </View>
              {state.isRecurrent ? (
                <Text style={[Fonts.p3Bold, Fonts.gold500]}>
                  {t('eventWizard.recap.recurrenceCount', { count: recurrencePreviewCount })}
                </Text>
              ) : null}
            </View>
          </View>

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
