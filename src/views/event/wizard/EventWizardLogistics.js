import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import DayPicker from '@/components/molecules/dayPicker/DayPicker';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';

const parseInteger = (rawValue) => {
  if (!rawValue || String(rawValue).trim() === '') return null;
  const parsed = Number.parseInt(String(rawValue), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDecimal = (rawValue) => {
  if (!rawValue || String(rawValue).trim() === '') return null;
  const normalized = String(rawValue).replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberInputText = (value) => (
  value === null || value === undefined ? '' : String(value)
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
function EventWizardLogistics({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const cardSurface = 'rgba(4, 31, 44, 0.82)';
  const cardBorder = 'rgba(1, 179, 244, 0.24)';
  const fieldSurface = 'rgba(1, 179, 244, 0.08)';
  const fieldBorder = 'rgba(1, 179, 244, 0.26)';
  const chipSurface = 'rgba(1, 179, 244, 0.08)';
  const chipBorder = 'rgba(1, 179, 244, 0.24)';

  const isReservation = isReservationTypeName(state.type?.name);

  const [date, setDate] = useState(state.date ? new Date(state.date) : new Date());
  const [startTime, setStartTime] = useState(state.startTime ? new Date(state.startTime) : new Date());
  const [endTime, setEndTime] = useState(state.endTime ? new Date(state.endTime) : new Date());
  const [isRecurrent, setIsRecurrent] = useState(Boolean(state.isRecurrent));
  const [recurrenceFrequency, setRecurrenceFrequency] = useState(state.recurrenceFrequency || 'week');
  const [recurrenceIntervalText, setRecurrenceIntervalText] = useState(
    toNumberInputText(state.recurrenceInterval || 1),
  );
  const [recurrenceDays, setRecurrenceDays] = useState(state.recurrenceDays || []);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(
    state.recurrenceStartDate ? new Date(state.recurrenceStartDate) : new Date(date),
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    state.recurrenceEndDate ? new Date(state.recurrenceEndDate) : null,
  );
  const [reservationMode, setReservationMode] = useState(state.reservationMode || 'FULL_GROUP');
  const [pricePerPersonText, setPricePerPersonText] = useState(toNumberInputText(state.pricePerPerson));

  const recurrenceInterval = useMemo(() => {
    const parsed = parseInteger(recurrenceIntervalText);
    return parsed && parsed > 0 ? parsed : 1;
  }, [recurrenceIntervalText]);

  const handleNext = () => {
    const fullStartDate = new Date(date);
    fullStartDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const fullEndDate = new Date(date);
    fullEndDate.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    if (fullEndDate <= fullStartDate) {
      Alert.alert(t('common.error'), t('eventWizard.errors.invalidTimeRange'));
      return;
    }

    if (fullStartDate.getTime() <= Date.now()) {
      Alert.alert(t('common.error'), t('eventWizard.errors.datePast'));
      return;
    }

    if (isRecurrent) {
      if (!recurrenceStartDate || !recurrenceEndDate) {
        Alert.alert(t('common.error'), t('eventWizard.errors.recurrenceDatesRequired'));
        return;
      }
      if (recurrenceEndDate < recurrenceStartDate) {
        Alert.alert(t('common.error'), t('eventWizard.errors.recurrenceInvalidRange'));
        return;
      }
      if (recurrenceFrequency === 'week' && recurrenceDays.length === 0) {
        Alert.alert(t('common.error'), t('eventWizard.errors.recurrenceDaysRequired'));
        return;
      }
    }

    const payload = {
      date: fullStartDate,
      endTime: fullEndDate,
      isRecurrent,
      pricePerPerson: isReservation ? parseDecimal(pricePerPersonText) : null,
      recurrenceDays: isRecurrent && recurrenceFrequency === 'week' ? recurrenceDays : [],
      recurrenceEndDate: isRecurrent ? recurrenceEndDate : null,
      recurrenceFrequency,
      recurrenceInterval,
      recurrenceStartDate: isRecurrent ? recurrenceStartDate : null,
      reservationMode,
      startTime: fullStartDate,
    };

    dispatch({
      payload,
      type: 'SET_LOGISTICS',
    });

    navigation.navigate(RouteNames.EventWizardParticipants);
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={10}
      stepIndex={4}
      subtitle={t('eventWizard.steps.logistics.subtitle')}
      title={t('eventWizard.steps.logistics.title')}
    >
      <View style={[Spaces.gap[20]]}>
        <DateTimeSelector
          display="inline"
          label={t('eventEdit.fields.date.label')}
          mode="date"
          onChange={setDate}
          value={date}
        />

        <View style={[Alignments.row, Spaces.gap[16]]}>
          <View style={{ flex: 1 }}>
            <DateTimeSelector
              display="inline"
              label={t('eventEdit.fields.startTime.label')}
              mode="time"
              onChange={setStartTime}
              value={startTime}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeSelector
              display="inline"
              label={t('eventEdit.fields.endTime.label')}
              mode="time"
              onChange={setEndTime}
              value={endTime}
            />
          </View>
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            { backgroundColor: cardSurface, borderColor: cardBorder },
          ]}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('eventWizard.steps.logistics.isRecurrent')}
          </Text>
          <Switch
            onValueChange={setIsRecurrent}
            thumbColor={Colors.neutral00}
            trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
            value={isRecurrent}
          />
        </View>

        {isRecurrent ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], { backgroundColor: cardSurface, borderColor: cardBorder }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('eventWizard.steps.logistics.recurrenceTitle')}
            </Text>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('eventEdit.fields.recurrenceFrequency.label')}
              </Text>
              <View style={[Alignments.row, Spaces.gap[12]]}>
                {['week', 'month'].map((value) => {
                  const selected = recurrenceFrequency === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setRecurrenceFrequency(value)}
                      style={[
                        ApplicationStyle.card,
                        Spaces.paddingVertical[8],
                        Spaces.paddingHorizontal[16],
                        {
                          backgroundColor: selected ? 'rgba(1, 179, 244, 0.16)' : chipSurface,
                          borderColor: selected ? Colors.primary500 : chipBorder,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2Bold, selected ? Fonts.primary100 : Fonts.neutral100]}>
                        {value === 'week'
                          ? t('eventEdit.fields.recurrenceFrequency.options.week')
                          : t('eventEdit.fields.recurrenceFrequency.options.month')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>
                {t('eventWizard.steps.logistics.recurrenceInterval')}
              </Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={setRecurrenceIntervalText}
                placeholder="1"
                placeholderTextColor={Colors.neutral500}
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[12],
                  Fonts.p1,
                  { backgroundColor: fieldSurface, borderColor: fieldBorder, color: Colors.neutral00 },
                ]}
                value={recurrenceIntervalText}
              />
            </View>

            {recurrenceFrequency === 'week' ? (
              <View>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {t('eventWizard.steps.logistics.recurrenceDays')}
                </Text>
                <DayPicker
                  onChange={setRecurrenceDays}
                  selectedDays={recurrenceDays}
                />
              </View>
            ) : null}

            <DateTimeSelector
              label={t('eventEdit.fields.recurrenceStartDate.label')}
              mode="date"
              onChange={setRecurrenceStartDate}
              value={recurrenceStartDate || new Date()}
            />
            <DateTimeSelector
              label={t('eventEdit.fields.recurrenceEndDate.label')}
              mode="date"
              onChange={setRecurrenceEndDate}
              value={recurrenceEndDate || new Date()}
            />
          </View>
        ) : null}

        {isReservation ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], { backgroundColor: cardSurface, borderColor: cardBorder }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('eventWizard.steps.logistics.reservationTitle')}
            </Text>

            <View>
              <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>
                {t('eventEdit.fields.pricePerPerson.label')}
              </Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setPricePerPersonText}
                placeholder={t('eventEdit.fields.pricePerPerson.placeholder')}
                placeholderTextColor={Colors.neutral500}
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[12],
                  Fonts.p1,
                  { backgroundColor: fieldSurface, borderColor: fieldBorder, color: Colors.neutral00 },
                ]}
                value={pricePerPersonText}
              />
            </View>

            <View>
              <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>
                {t('eventWizard.steps.logistics.reservationMode')}
              </Text>
              <View style={[Alignments.row, Spaces.gap[12]]}>
                {[
                  { key: 'FULL_GROUP', label: t('reservation.mode.fullGroup') },
                  { key: 'RECRUITING', label: t('reservation.mode.recruiting') },
                ].map((option) => {
                  const selected = reservationMode === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setReservationMode(option.key)}
                      style={[
                        ApplicationStyle.card,
                        Spaces.paddingVertical[8],
                        Spaces.paddingHorizontal[16],
                        {
                          backgroundColor: selected ? 'rgba(1, 179, 244, 0.16)' : chipSurface,
                          borderColor: selected ? Colors.primary500 : chipBorder,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2Bold, selected ? Fonts.primary100 : Fonts.neutral100]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardLogistics;
