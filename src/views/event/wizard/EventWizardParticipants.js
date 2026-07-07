import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardParticipantsStepIndex,
  getEventWizardStepCount,
  isTournamentEventType,
  shouldExplainDetectionSlotsDisabled,
  shouldShowDetectionSlotsStep,
  shouldSkipEventWizardParticipantsStep,
} from './eventWizardDetectionUtils';

const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 200;
const CAPACITY_PRESETS = [8, 10, 12, 14, 18, 22];

const clampParticipants = (value) => (
  Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, value))
);

const isReservationTypeName = (typeName = '') => {
  const normalized = String(typeName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized.includes('reservation');
};

const isTrainingTypeName = (typeName = '') => {
  const normalized = String(typeName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized.includes('entrainement');
};

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardParticipants({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();

  const [capacityMode, setCapacityMode] = useState(state.capacity === null ? 'unlimited' : 'fixed');
  const [capacityValue, setCapacityValue] = useState(state.capacity || 12);
  const [externalParticipantLimitValue, setExternalParticipantLimitValue] = useState(
    state.externalParticipantLimit || 3,
  );
  const [totalPlayersValue, setTotalPlayersValue] = useState(state.totalPlayers || 5);

  const isReservation = useMemo(
    () => isReservationTypeName(state.type?.name),
    [state.type?.name],
  );
  const isTraining = useMemo(
    () => isTrainingTypeName(state.type?.name),
    [state.type?.name],
  );
  const isOpenTraining = isTraining && state.sessionStatus !== 'closed';
  const shouldSkipParticipantsStep = useMemo(
    () => shouldSkipEventWizardParticipantsStep(state),
    [state],
  );

  const clampedCapacity = clampParticipants(capacityValue);
  const clampedExternalParticipantLimit = clampParticipants(externalParticipantLimitValue);
  const clampedTotalPlayers = clampParticipants(totalPlayersValue);
  let normalizedCapacity = null;
  if (!isTraining && capacityMode !== 'unlimited') {
    normalizedCapacity = clampedCapacity;
  }
  const shouldCollectInternalPlayers = isReservation || (isTraining && !isOpenTraining);
  const normalizedTotalPlayers = shouldCollectInternalPlayers ? clampedTotalPlayers : null;
  let normalizedExternalParticipantLimit = null;
  if (isTraining) {
    normalizedExternalParticipantLimit = isOpenTraining
      ? clampedExternalParticipantLimit
      : (state.externalParticipantLimit ?? null);
  }
  const projectedState = {
    ...state,
    capacity: normalizedCapacity,
    externalParticipantLimit: normalizedExternalParticipantLimit,
    totalPlayers: normalizedTotalPlayers,
  };
  const shouldShowDetectionStep = shouldShowDetectionSlotsStep(projectedState);
  const shouldShowDetectionDisabledHint = shouldExplainDetectionSlotsDisabled(projectedState);

  const hasInvalidPlayersConfig = (
    isReservation
    && capacityMode === 'fixed'
    && clampedTotalPlayers > clampedCapacity
  );

  const canDecreaseCapacity = capacityMode === 'fixed' && clampedCapacity > MIN_PARTICIPANTS;
  const canIncreaseCapacity = capacityMode === 'fixed' && clampedCapacity < MAX_PARTICIPANTS;
  const canDecreaseExternalLimit = clampedExternalParticipantLimit > MIN_PARTICIPANTS;
  const canIncreaseExternalLimit = clampedExternalParticipantLimit < MAX_PARTICIPANTS;
  const canDecreaseTotal = clampedTotalPlayers > MIN_PARTICIPANTS;
  const canIncreaseTotal = (
    clampedTotalPlayers < MAX_PARTICIPANTS
    && (isTraining || capacityMode === 'unlimited' || clampedTotalPlayers < clampedCapacity)
  );

  let capacityLabel = `${clampedCapacity} ${t('eventWizard.steps.participants.playersUnit', 'joueurs max')}`;
  if (capacityMode === 'unlimited') {
    capacityLabel = t('eventWizard.steps.participants.unlimitedLabel', 'Illimite');
  }
  if (isTraining) {
    capacityLabel = isOpenTraining
      ? t(
        'eventWizard.steps.participants.trainingOpenCapacity',
        'Illimite en interne + quota externe',
      )
      : t(
        'eventWizard.steps.participants.trainingPrivateCapacity',
        'Illimite (entrainement prive)',
      );
  }

  let previewModeLabel = capacityMode === 'fixed'
    ? t('eventWizard.steps.participants.fixed', 'Capacite fixe')
    : t('eventWizard.steps.participants.unlimited', 'Illimite');
  if (isTraining) {
    previewModeLabel = isOpenTraining
      ? t('eventWizard.steps.participants.trainingModeOpen', 'Entrainement ouvert')
      : t('eventWizard.steps.participants.trainingModePrivate', 'Entrainement prive');
  }
  let participantsSubtitleKey = 'eventWizard.steps.participants.subtitle';
  let participantsSubtitleFallback = 'Choisis une capacite max, ou laisse l evenement en acces illimite.';
  if (isTraining && isOpenTraining) {
    participantsSubtitleKey = 'eventWizard.steps.participants.trainingOpenSubtitle';
    participantsSubtitleFallback = 'Definis uniquement combien de joueurs externes a l equipe tu veux accepter.';
  } else if (isTraining) {
    participantsSubtitleKey = 'eventWizard.steps.participants.trainingSubtitle';
    participantsSubtitleFallback = 'Definis tes joueurs attendus pour cet entrainement.';
  }

  const surfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };
  const capacityModeControlWrapperStyle = {
    alignSelf: 'center',
    maxWidth: 540,
    width: '100%',
  };

  const counterButtonStyle = (isEnabled) => ([
    ApplicationStyle.card,
    Alignments.alignCenter,
    Alignments.justifyCenter,
    {
      backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.12)' : 'rgba(1, 179, 244, 0.06)',
      borderColor: 'rgba(1, 179, 244, 0.28)',
      borderRadius: 16,
      height: 56,
      opacity: isEnabled ? 1 : 0.45,
      width: 56,
    },
  ]);

  const handleNext = () => {
    if (
      isReservation
      && normalizedCapacity !== null
      && normalizedTotalPlayers !== null
      && normalizedTotalPlayers > normalizedCapacity
    ) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'eventWizard.steps.participants.totalPlayersExceedsCapacity',
          'Le nombre de joueurs attendus ne peut pas depasser la capacite max.',
        ),
      );
      return;
    }

    dispatch({
      payload: {
        capacity: normalizedCapacity,
        externalParticipantLimit: normalizedExternalParticipantLimit,
        totalPlayers: normalizedTotalPlayers,
      },
      type: 'SET_PARTICIPANTS',
    });

    let nextRoute = RouteNames.EventWizardValidationMode;
    if (isTournamentEventType(state?.type?.name)) {
      nextRoute = RouteNames.EventWizardDescription;
    } else if (shouldShowDetectionStep) {
      nextRoute = RouteNames.EventWizardDetectionSlots;
    }

    navigation.navigate(nextRoute);
  };

  useEffect(() => {
    if (!shouldSkipParticipantsStep) return;

    if (typeof navigation.replace === 'function') {
      navigation.replace(RouteNames.EventWizardValidationMode);
      return;
    }

    navigation.navigate(RouteNames.EventWizardValidationMode);
  }, [navigation, shouldSkipParticipantsStep]);

  if (shouldSkipParticipantsStep) {
    return null;
  }

  return (
    <WizardStepLayout
      isNextDisabled={hasInvalidPlayersConfig}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedState)}
      stepIndex={getEventWizardParticipantsStepIndex(projectedState)}
      subtitle={t(participantsSubtitleKey, participantsSubtitleFallback)}
      title={t('eventWizard.steps.participants.title', 'Participants')}
    >
      <View style={[Spaces.gap[16]]}>
        {!isTraining ? (
          <>
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventWizard.steps.participants.modeLabel', 'Mode de capacite')}
              </Text>
              <View style={capacityModeControlWrapperStyle}>
                <SegmentedControl
                  centerContent
                  onChange={setCapacityMode}
                  options={[
                    {
                      label: t('eventWizard.steps.participants.unlimited', 'Illimite'),
                      value: 'unlimited',
                    },
                    {
                      label: t('eventWizard.steps.participants.fixed', 'Capacite fixe'),
                      value: 'fixed',
                    },
                  ]}
                  value={capacityMode}
                />
              </View>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {capacityMode === 'unlimited'
                  ? t(
                    'eventWizard.steps.participants.modeHintUnlimited',
                    'Mode illimite: aucun plafond de participants.',
                  )
                  : t(
                    'eventWizard.steps.participants.modeHintFixed',
                    'Mode capacite fixe: nombre de places limite.',
                  )}
              </Text>
            </View>

            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], surfaceStyle]}>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('eventEdit.fields.capacity.label')}
              </Text>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
                <TouchableOpacity
                  disabled={!canDecreaseCapacity}
                  onPress={() => setCapacityValue((value) => clampParticipants(value - 1))}
                  style={counterButtonStyle(canDecreaseCapacity)}
                >
                  <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
                </TouchableOpacity>

                <View style={[Spaces.paddingHorizontal[12]]}>
                  <Text style={[Fonts.h1, Fonts.neutral00, { textAlign: 'center' }]}>
                    {capacityMode === 'unlimited'
                      ? t('eventWizard.steps.participants.unlimited', 'Illimite')
                      : clampedCapacity}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                    {capacityMode === 'unlimited'
                      ? t('eventWizard.steps.participants.unlimitedHint', 'Aucune limite de places')
                      : t('eventWizard.steps.participants.playersUnit', 'joueurs max')}
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={!canIncreaseCapacity}
                  onPress={() => setCapacityValue((value) => clampParticipants(value + 1))}
                  style={counterButtonStyle(canIncreaseCapacity)}
                >
                  <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
                </TouchableOpacity>
              </View>

              {capacityMode === 'fixed' ? (
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                    {t('eventWizard.steps.participants.quickPresets', 'Valeurs rapides')}
                  </Text>
                  <View style={[Alignments.row, Spaces.marginTop[4], { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
                    {CAPACITY_PRESETS.map((preset) => {
                      const selected = clampedCapacity === preset;
                      return (
                        <TouchableOpacity
                          key={`capacity-preset-${preset}`}
                          onPress={() => setCapacityValue(preset)}
                          style={[
                            ApplicationStyle.card,
                            Alignments.alignCenter,
                            Alignments.justifyCenter,
                            Spaces.paddingVertical[12],
                            Spaces.paddingHorizontal[16],
                            {
                              backgroundColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.08)',
                              borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.26)',
                              borderRadius: 14,
                              minHeight: 40,
                              minWidth: 46,
                            },
                          ]}
                        >
                          <Text style={[Fonts.p1Bold, selected ? Fonts.neutral900 : Fonts.neutral100]}>
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {shouldCollectInternalPlayers ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {isTraining
                ? t('eventWizard.steps.participants.trainingTotalPlayers', 'Joueurs attendus (interne)')
                : t('eventEdit.fields.totalPlayers.label')}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <TouchableOpacity
                disabled={!canDecreaseTotal}
                onPress={() => setTotalPlayersValue((value) => clampParticipants(value - 1))}
                style={counterButtonStyle(canDecreaseTotal)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
              </TouchableOpacity>
              <Text style={[Fonts.h1, Fonts.neutral00]}>
                {clampedTotalPlayers}
              </Text>
              <TouchableOpacity
                disabled={!canIncreaseTotal}
                onPress={() => setTotalPlayersValue((value) => clampParticipants(value + 1))}
                style={counterButtonStyle(canIncreaseTotal)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isOpenTraining ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('eventWizard.steps.participants.externalQuotaLabel', 'Places externes')}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <TouchableOpacity
                disabled={!canDecreaseExternalLimit}
                onPress={() => setExternalParticipantLimitValue((value) => clampParticipants(value - 1))}
                style={counterButtonStyle(canDecreaseExternalLimit)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
              </TouchableOpacity>
              <Text style={[Fonts.h1, Fonts.neutral00]}>
                {clampedExternalParticipantLimit}
              </Text>
              <TouchableOpacity
                disabled={!canIncreaseExternalLimit}
                onPress={() => setExternalParticipantLimitValue((value) => clampParticipants(value + 1))}
                style={counterButtonStyle(canIncreaseExternalLimit)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            {
              backgroundColor: 'rgba(1, 179, 244, 0.10)',
              borderColor: 'rgba(1, 179, 244, 0.32)',
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500, Spaces.marginBottom[8]]}>
            {t('eventWizard.steps.participants.summaryTitle', 'Resume')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('eventWizard.steps.participants.previewCapacity', 'Capacite: {{value}}', { value: capacityLabel })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'eventWizard.steps.participants.previewMode',
              'Mode: {{value}}',
              {
                value: previewModeLabel,
              },
            )}
          </Text>
          {shouldCollectInternalPlayers ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                isTraining
                  ? 'eventWizard.steps.participants.previewTrainingTotalPlayers'
                  : 'eventWizard.steps.participants.previewTotalPlayers',
                'Joueurs attendus: {{value}}',
                { value: clampedTotalPlayers },
              )}
            </Text>
          ) : null}
          {isOpenTraining ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventWizard.steps.participants.previewExternalQuota', 'Places externes: {{value}}', { value: clampedExternalParticipantLimit })}
            </Text>
          ) : null}
          {hasInvalidPlayersConfig ? (
            <Text style={[Fonts.p3, Fonts.error700, Spaces.marginTop[8]]}>
              {t(
                'eventWizard.steps.participants.totalPlayersExceedsCapacity',
                'Le nombre de joueurs attendus ne peut pas depasser la capacite max.',
              )}
            </Text>
          ) : null}
        </View>

        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'eventWizard.steps.participants.hint',
            'Tu pourras encore modifier ces valeurs avant la creation finale.',
          )}
        </Text>

        {shouldShowDetectionDisabledHint ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], surfaceStyle]}>
            <Text style={[Fonts.p3Bold, Fonts.gold500]}>
              {t(
                'eventWizard.steps.detectionSlots.recurrenceHintTitle',
                'Postes par detection indisponibles',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8]]}>
              {t(
                'eventWizard.steps.detectionSlots.recurrenceHintBody',
                'Les postes recherches sont disponibles uniquement sur une detection simple, non recurrente.',
              )}
            </Text>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardParticipants;
