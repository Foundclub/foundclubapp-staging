import { useMemo, useState } from 'react';
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
  const [totalPlayersValue, setTotalPlayersValue] = useState(state.totalPlayers || 5);

  const isReservation = useMemo(
    () => isReservationTypeName(state.type?.name),
    [state.type?.name],
  );

  const clampedCapacity = clampParticipants(capacityValue);
  const clampedTotalPlayers = clampParticipants(totalPlayersValue);
  const normalizedCapacity = capacityMode === 'unlimited' ? null : clampedCapacity;
  const normalizedTotalPlayers = isReservation ? clampedTotalPlayers : null;
  const projectedState = {
    ...state,
    capacity: normalizedCapacity,
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
  const canDecreaseTotal = clampedTotalPlayers > MIN_PARTICIPANTS;
  const canIncreaseTotal = (
    clampedTotalPlayers < MAX_PARTICIPANTS
    && (capacityMode === 'unlimited' || clampedTotalPlayers < clampedCapacity)
  );

  const capacityLabel = capacityMode === 'unlimited'
    ? t('eventWizard.steps.participants.unlimitedLabel', 'Illimité')
    : `${clampedCapacity} ${t('eventWizard.steps.participants.playersUnit', 'joueurs max')}`;

  const surfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
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
          'Le nombre de joueurs attendus ne peut pas depasser la capacité max.',
        ),
      );
      return;
    }

    dispatch({
      payload: {
        capacity: normalizedCapacity,
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

  return (
    <WizardStepLayout
      isNextDisabled={hasInvalidPlayersConfig}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedState)}
      stepIndex={getEventWizardParticipantsStepIndex(projectedState)}
      subtitle={t(
        'eventWizard.steps.participants.subtitle',
        'Choisis une capacité max, ou laisse l événement en accès illimité.',
      )}
      title={t('eventWizard.steps.participants.title', 'Participants')}
    >
      <View style={[Spaces.gap[16]]}>
        <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('eventWizard.steps.participants.modeLabel', 'Mode de capacité')}
          </Text>
          <SegmentedControl
            centerContent
            onChange={setCapacityMode}
            options={[
              {
                label: t('eventWizard.steps.participants.unlimited', 'Illimité'),
                value: 'unlimited',
              },
              {
                label: t('eventWizard.steps.participants.fixed', 'Capacité fixe'),
                value: 'fixed',
              },
            ]}
            value={capacityMode}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {capacityMode === 'unlimited'
              ? t(
                'eventWizard.steps.participants.modeHintUnlimited',
                'Mode illimité: aucun plafond de participants.',
              )
              : t(
                'eventWizard.steps.participants.modeHintFixed',
                'Mode capacité fixe: nombre de places limite.',
              )}
          </Text>
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[14], surfaceStyle]}>
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
                  ? t('eventWizard.steps.participants.unlimited', 'Illimité')
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
                        Spaces.paddingVertical[10],
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

        {isReservation ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('eventEdit.fields.totalPlayers.label')}
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
          <Text style={[Fonts.p3Bold, Fonts.primary500, Spaces.marginBottom[6]]}>
            {t('eventWizard.steps.participants.summaryTitle', 'Resume')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('eventWizard.steps.participants.previewCapacity', 'Capacité: {{value}}', { value: capacityLabel })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'eventWizard.steps.participants.previewMode',
              'Mode: {{value}}',
              {
                value: capacityMode === 'fixed'
                  ? t('eventWizard.steps.participants.fixed', 'Capacité fixe')
                  : t('eventWizard.steps.participants.unlimited', 'Illimité'),
              },
            )}
          </Text>
          {isReservation ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventWizard.steps.participants.previewTotalPlayers', 'Joueurs attendus: {{value}}', { value: clampedTotalPlayers })}
            </Text>
          ) : null}
          {hasInvalidPlayersConfig ? (
            <Text style={[Fonts.p3, Fonts.error700, Spaces.marginTop[6]]}>
              {t(
                'eventWizard.steps.participants.totalPlayersExceedsCapacity',
                'Le nombre de joueurs attendus ne peut pas depasser la capacité max.',
              )}
            </Text>
          ) : null}
        </View>

        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'eventWizard.steps.participants.hint',
            'Tu pourras encore modifier ces valeurs avant la création finale.',
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
