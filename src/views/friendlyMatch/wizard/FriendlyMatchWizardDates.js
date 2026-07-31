import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { getSlotHoursLabel, toIsoDay, toReadableDay } from '../friendlyMatchDateLabels';
import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/**
 * Etape 3/7 — « Quand » (§4.1).
 *
 * Plusieurs dates sont la regle, pas l exception : c est ce qui evite l aller-
 * retour « et le 12, ca t irait ? ». Le creneau horaire reste facultatif — beaucoup
 * d annonces se contentent de « samedi », l heure se convient dans le fil (§4.4).
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardDates({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();

  const [dayValue, setDayValue] = useState('');
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [addError, setAddError] = useState('');

  const issue = getFriendlyMatchWizardStepIssue('dates', state);
  const slots = Array.isArray(state.candidateDates) ? state.candidateDates : [];

  const handleAddSlot = () => {
    const isoDay = toIsoDay(dayValue);
    if (!isoDay) {
      setAddError('Choisis d’abord une date.');
      return;
    }
    if (startValue && endValue && endValue <= startValue) {
      setAddError('L’heure de fin doit être après l’heure de début.');
      return;
    }

    dispatch({
      payload: {
        date: isoDay,
        ...(endValue ? { end: endValue } : {}),
        ...(startValue ? { start: startValue } : {}),
      },
      type: 'ADD_CANDIDATE_DATE',
    });

    setAddError('');
    setDayValue('');
    setStartValue('');
    setEndValue('');
  };

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardLocation)}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('dates')}
      subtitle="Propose plusieurs dates : tu auras beaucoup plus de réponses."
      title="Quand veux-tu jouer ?"
    >
      <View style={[Spaces.gap[16]]}>
        <DatePickerInput
          error={addError || undefined}
          label="Date"
          minimumDate={new Date()}
          onChange={(/** @type {any} */ value) => {
            setDayValue(value);
            setAddError('');
          }}
          value={dayValue}
        />

        <View style={[Alignments.row, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <TimePickerInput
              label="Début (facultatif)"
              onChange={setStartValue}
              value={startValue}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePickerInput
              label="Fin (facultatif)"
              onChange={setEndValue}
              value={endValue}
            />
          </View>
        </View>

        <Button
          disabled={!dayValue}
          onPress={handleAddSlot}
          title="Ajouter cette date"
          variant="Secondary"
        />

        {slots.length > 0 ? (
          <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
              {slots.length > 1 ? `${slots.length} dates proposées` : '1 date proposée'}
            </Text>

            {slots.map((/** @type {any} */ slot) => (
              <View
                key={slot.date}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  Spaces.padding[12],
                  {
                    backgroundColor: withAlpha(Colors.primary900, 0.94),
                    borderColor: withAlpha(Colors.primary500, 0.15),
                    borderRadius: 12,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
                    {toReadableDay(slot.date)}
                  </Text>
                  <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
                    {getSlotHoursLabel(slot)}
                  </Text>
                </View>

                <TouchableOpacity
                  accessibilityLabel={`Retirer la date du ${toReadableDay(slot.date)}`}
                  accessibilityRole="button"
                  onPress={() => dispatch({ payload: slot.date, type: 'REMOVE_CANDIDATE_DATE' })}
                  style={{
                    alignItems: 'center',
                    height: 44,
                    justifyContent: 'center',
                    width: 44,
                  }}
                >
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral300 }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {issue ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{issue}</Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardDates;
