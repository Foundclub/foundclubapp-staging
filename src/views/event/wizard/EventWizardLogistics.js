import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
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

import Button from '@/components/atoms/button/Button';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import DayPicker from '@/components/molecules/dayPicker/DayPicker';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardLogisticsStepIndex,
  getEventWizardStepCount,
  isTournamentEventType,
} from './eventWizardDetectionUtils';

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

const ONE_HOUR_IN_MINUTES = 60;
const MIN_RECURRENCE_INTERVAL = 1;

const toMinutesOfDay = (dateValue) => (
  (dateValue?.getHours?.() || 0) * 60 + (dateValue?.getMinutes?.() || 0)
);

const buildAutomaticEndTime = (startDate) => {
  const nextEnd = new Date(startDate);
  nextEnd.setMinutes(nextEnd.getMinutes() + ONE_HOUR_IN_MINUTES);

  if (nextEnd.getDate() !== startDate.getDate()) {
    const cappedEnd = new Date(startDate);
    cappedEnd.setHours(23, 59, 0, 0);
    return cappedEnd;
  }

  return nextEnd;
};

const ensureEndAfterStart = (startDate, endDate) => {
  if (toMinutesOfDay(endDate) <= toMinutesOfDay(startDate)) {
    return buildAutomaticEndTime(startDate);
  }
  return endDate;
};

const buildNextAvailableStart = (referenceDate = new Date()) => {
  const next = new Date(referenceDate);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
};

const areSameDay = (firstDate, secondDate) => (
  firstDate.getFullYear() === secondDate.getFullYear()
  && firstDate.getMonth() === secondDate.getMonth()
  && firstDate.getDate() === secondDate.getDate()
);

const buildDefaultRecurrenceEndDate = (startDate, frequency, interval) => {
  const fallbackEnd = new Date(startDate);
  if (frequency === 'month') {
    fallbackEnd.setMonth(fallbackEnd.getMonth() + Math.max(1, interval));
    return fallbackEnd;
  }
  fallbackEnd.setDate(fallbackEnd.getDate() + (7 * Math.max(1, interval)));
  return fallbackEnd;
};

const buildDateKey = (value) => format(new Date(value), 'yyyy-MM-dd');

const buildDayRange = (startDate, endDate) => {
  const days = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const boundary = new Date(endDate);
  boundary.setHours(0, 0, 0, 0);

  while (cursor <= boundary) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const buildDayStartTime = (dayDate, sourceTime) => {
  const date = new Date(dayDate);
  date.setHours(sourceTime.getHours(), sourceTime.getMinutes(), 0, 0);
  return date;
};

const normalizeInitialSchedule = (rawSchedule = []) => rawSchedule.map((entry) => ({
  date: entry?.date ? new Date(entry.date) : new Date(),
  endTime: entry?.endTime ? new Date(entry.endTime) : new Date(),
  facilityId: entry?.facilityId || entry?.facility?.documentId || entry?.facility || null,
  hasCustomTime: Boolean(entry?.startTime && entry?.endTime),
  hasLocationOverride: Boolean(entry?.facilityId || entry?.facility || entry?.location),
  isActive: entry?.isActive !== false,
  location: entry?.location || null,
  startTime: entry?.startTime ? new Date(entry.startTime) : new Date(),
}));

const buildTournamentDayState = ({
  date,
  defaultEndTime,
  defaultStartTime,
  previousDay,
}) => {
  const startTime = previousDay?.hasCustomTime
    ? new Date(previousDay.startTime)
    : buildDayStartTime(date, defaultStartTime);
  const inheritedEnd = previousDay?.hasCustomTime
    ? new Date(previousDay.endTime)
    : buildDayStartTime(date, defaultEndTime);

  return {
    date,
    endTime: ensureEndAfterStart(startTime, inheritedEnd),
    facilityId: previousDay?.facilityId || null,
    hasCustomTime: Boolean(previousDay?.hasCustomTime),
    hasLocationOverride: Boolean(previousDay?.hasLocationOverride),
    isActive: previousDay?.isActive !== false,
    location: previousDay?.location || null,
    startTime,
  };
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
  const intervalControlSurface = 'rgba(1, 179, 244, 0.1)';
  const intervalControlBorder = 'rgba(1, 179, 244, 0.28)';

  const isReservation = isReservationTypeName(state.type?.name);
  const isTournament = isTournamentEventType(state.type?.name);

  const [date, setDate] = useState(state.date ? new Date(state.date) : new Date());
  const [startTime, setStartTime] = useState(
    state.startTime ? new Date(state.startTime) : new Date(),
  );
  const [endTime, setEndTime] = useState(() => {
    const initialStart = state.startTime ? new Date(state.startTime) : new Date();
    const initialEnd = state.endTime
      ? new Date(state.endTime)
      : buildAutomaticEndTime(initialStart);
    return ensureEndAfterStart(initialStart, initialEnd);
  });
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
  const [isMultiDayTournament, setIsMultiDayTournament] = useState(Boolean(state.isMultiDayTournament));
  const [tournamentStartDate, setTournamentStartDate] = useState(
    state.stageStartDate ? new Date(state.stageStartDate) : new Date(date),
  );
  const [tournamentEndDate, setTournamentEndDate] = useState(
    state.stageEndDate ? new Date(state.stageEndDate) : new Date(date),
  );
  const [tournamentDefaultStartTime, setTournamentDefaultStartTime] = useState(
    state.stageDefaultStartTime ? new Date(state.stageDefaultStartTime) : new Date(startTime),
  );
  const [tournamentDefaultEndTime, setTournamentDefaultEndTime] = useState(
    state.stageDefaultEndTime
      ? ensureEndAfterStart(
        state.stageDefaultStartTime ? new Date(state.stageDefaultStartTime) : new Date(startTime),
        new Date(state.stageDefaultEndTime),
      )
      : new Date(endTime),
  );
  const [tournamentDays, setTournamentDays] = useState(
    () => normalizeInitialSchedule(state.stageSchedule || []),
  );
  const [reservationMode, setReservationMode] = useState(state.reservationMode || 'FULL_GROUP');
  const [pricePerPersonText, setPricePerPersonText] = useState(toNumberInputText(state.pricePerPerson));
  const projectedWizardState = useMemo(() => ({
    ...state,
    isMultiDayTournament: isTournament ? isMultiDayTournament : false,
  }), [isMultiDayTournament, isTournament, state]);

  const recurrenceInterval = useMemo(() => {
    const parsed = parseInteger(recurrenceIntervalText);
    return parsed && parsed > 0 ? parsed : MIN_RECURRENCE_INTERVAL;
  }, [recurrenceIntervalText]);

  const recurrenceIntervalLabel = useMemo(() => {
    const safeInterval = Math.max(MIN_RECURRENCE_INTERVAL, recurrenceInterval);
    if (recurrenceFrequency === 'month') {
      return safeInterval === 1
        ? t('eventWizard.steps.logistics.recurrenceIntervalMonthlyOne', 'Tous les mois')
        : t(
          'eventWizard.steps.logistics.recurrenceIntervalMonthlyMany',
          'Tous les {{count}} mois',
          { count: safeInterval },
        );
    }

    return safeInterval === 1
      ? t('eventWizard.steps.logistics.recurrenceIntervalWeeklyOne', 'Toutes les semaines')
      : t(
        'eventWizard.steps.logistics.recurrenceIntervalWeeklyMany',
        'Toutes les {{count}} semaines',
        { count: safeInterval },
      );
  }, [recurrenceFrequency, recurrenceInterval, t]);

  const canDecreaseRecurrenceInterval = recurrenceInterval > MIN_RECURRENCE_INTERVAL;

  const intervalAdjustButtonStyle = (isEnabled) => ([
    ApplicationStyle.card,
    Alignments.alignCenter,
    Alignments.justifyCenter,
    {
      backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.16)' : 'rgba(1, 179, 244, 0.08)',
      borderColor: intervalControlBorder,
      borderRadius: 14,
      height: 46,
      opacity: isEnabled ? 1 : 0.45,
      width: 46,
    },
  ]);

  const handleDecreaseRecurrenceInterval = () => {
    setRecurrenceIntervalText((currentValue) => {
      const parsed = parseInteger(currentValue);
      const safeCurrent = parsed && parsed > 0 ? parsed : MIN_RECURRENCE_INTERVAL;
      return toNumberInputText(Math.max(MIN_RECURRENCE_INTERVAL, safeCurrent - 1));
    });
  };

  const handleIncreaseRecurrenceInterval = () => {
    setRecurrenceIntervalText((currentValue) => {
      const parsed = parseInteger(currentValue);
      const safeCurrent = parsed && parsed > 0 ? parsed : MIN_RECURRENCE_INTERVAL;
      return toNumberInputText(safeCurrent + 1);
    });
  };

  useEffect(() => {
    const now = new Date();
    const fullStartDate = new Date(date);
    fullStartDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    if (fullStartDate.getTime() > now.getTime()) return;

    const suggestedStart = buildNextAvailableStart(now);
    const suggestedEnd = buildAutomaticEndTime(suggestedStart);

    if (!areSameDay(date, suggestedStart)) {
      setDate(suggestedStart);
    }

    setStartTime(suggestedStart);
    setEndTime(suggestedEnd);
  // Intentionally run once on mount to fix stale/past defaults.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRecurrent || recurrenceFrequency !== 'week') return;

    const baseDay = date.getDay();
    setRecurrenceDays((current) => {
      const normalizedCurrent = Array.isArray(current)
        ? current.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : [];

      if (normalizedCurrent.length === 0) {
        return [baseDay];
      }

      if (!normalizedCurrent.includes(baseDay)) {
        return [baseDay, ...normalizedCurrent];
      }

      return normalizedCurrent;
    });
  }, [date, isRecurrent, recurrenceFrequency]);

  useEffect(() => {
    if (!isTournament || !isMultiDayTournament) return;
    if (tournamentEndDate < tournamentStartDate) {
      setTournamentEndDate(new Date(tournamentStartDate));
    }
  }, [isMultiDayTournament, isTournament, tournamentEndDate, tournamentStartDate]);

  useEffect(() => {
    if (!isTournament || !isMultiDayTournament) return;
    setTournamentDefaultEndTime((currentEnd) => ensureEndAfterStart(
      tournamentDefaultStartTime,
      currentEnd,
    ));
  }, [isMultiDayTournament, isTournament, tournamentDefaultStartTime]);

  useEffect(() => {
    if (!isTournament || !isMultiDayTournament) return;

    const days = buildDayRange(tournamentStartDate, tournamentEndDate);
    setTournamentDays((currentDays) => {
      const previousByDate = new Map(
        currentDays.map((day) => [buildDateKey(day.date), day]),
      );

      return days.map((dayDate) => buildTournamentDayState({
        date: dayDate,
        defaultEndTime: tournamentDefaultEndTime,
        defaultStartTime: tournamentDefaultStartTime,
        previousDay: previousByDate.get(buildDateKey(dayDate)),
      }));
    });
  }, [
    isMultiDayTournament,
    isTournament,
    tournamentDefaultEndTime,
    tournamentDefaultStartTime,
    tournamentEndDate,
    tournamentStartDate,
  ]);

  const handleStartTimeChange = (nextStartTime) => {
    setStartTime(nextStartTime);
    setEndTime(buildAutomaticEndTime(nextStartTime));
  };

  const handleEndTimeChange = (nextEndTime) => {
    setEndTime(ensureEndAfterStart(startTime, nextEndTime));
  };

  const handleTournamentToggle = (value) => {
    setIsMultiDayTournament(value);

    if (value) {
      const nextTournamentStartDate = new Date(date);
      const nextTournamentEndDate = tournamentEndDate && tournamentEndDate >= date
        ? new Date(tournamentEndDate)
        : new Date(date);
      const nextDefaultStartTime = new Date(startTime);
      const nextDefaultEndTime = ensureEndAfterStart(startTime, endTime);

      setIsRecurrent(false);
      setTournamentStartDate(nextTournamentStartDate);
      setTournamentEndDate(nextTournamentEndDate);
      setTournamentDefaultStartTime(nextDefaultStartTime);
      setTournamentDefaultEndTime(nextDefaultEndTime);
      setTournamentDays((currentDays) => {
        const previousByDate = new Map(
          currentDays.map((day) => [buildDateKey(day.date), day]),
        );

        return buildDayRange(nextTournamentStartDate, nextTournamentEndDate)
          .map((dayDate) => buildTournamentDayState({
            date: dayDate,
            defaultEndTime: nextDefaultEndTime,
            defaultStartTime: nextDefaultStartTime,
            previousDay: previousByDate.get(buildDateKey(dayDate)),
          }));
      });
      return;
    }

    setDate(new Date(tournamentStartDate));
    setStartTime(new Date(tournamentDefaultStartTime));
    setEndTime(ensureEndAfterStart(tournamentDefaultStartTime, tournamentDefaultEndTime));
  };

  const handleTournamentDefaultStartTimeChange = (nextStartTime) => {
    setTournamentDefaultStartTime(nextStartTime);
    setTournamentDefaultEndTime((currentEndTime) => ensureEndAfterStart(nextStartTime, currentEndTime));
  };

  const handleTournamentDefaultEndTimeChange = (nextEndTime) => {
    setTournamentDefaultEndTime(ensureEndAfterStart(tournamentDefaultStartTime, nextEndTime));
  };

  const handleToggleTournamentDay = (dateKey, isActive) => {
    setTournamentDays((currentDays) => currentDays.map((day) => (
      buildDateKey(day.date) === dateKey
        ? { ...day, isActive }
        : day
    )));
  };

  const handleTournamentTimeModeChange = (dateKey, hasCustomTime) => {
    setTournamentDays((currentDays) => currentDays.map((day) => {
      if (buildDateKey(day.date) !== dateKey) return day;
      if (!hasCustomTime) {
        return {
          ...day,
          endTime: buildDayStartTime(day.date, tournamentDefaultEndTime),
          hasCustomTime: false,
          startTime: buildDayStartTime(day.date, tournamentDefaultStartTime),
        };
      }
      return { ...day, hasCustomTime: true };
    }));
  };

  const handleUpdateTournamentDay = (dateKey, partialUpdate) => {
    setTournamentDays((currentDays) => currentDays.map((day) => (
      buildDateKey(day.date) === dateKey
        ? { ...day, ...partialUpdate }
        : day
    )));
  };

  const applyTournamentDefaultsToAllDays = () => {
    setTournamentDays((currentDays) => currentDays.map((day) => ({
      ...day,
      endTime: buildDayStartTime(day.date, tournamentDefaultEndTime),
      hasCustomTime: false,
      startTime: buildDayStartTime(day.date, tournamentDefaultStartTime),
    })));
  };

  const activeTournamentDays = useMemo(
    () => tournamentDays.filter((day) => day.isActive !== false),
    [tournamentDays],
  );

  const handleNext = () => {
    const fullStartDate = new Date(date);
    fullStartDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const fullEndDate = new Date(date);
    fullEndDate.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    if (isTournament && isMultiDayTournament) {
      if (!activeTournamentDays.length) {
        Alert.alert(
          t('common.error'),
          t(
            'eventWizard.tournamentProgram.errors.noActiveDays',
            'Active au moins une journee de tournoi pour continuer.',
          ),
        );
        return;
      }

      const invalidDay = activeTournamentDays.find((day) => day.endTime <= day.startTime);
      if (invalidDay) {
        Alert.alert(t('common.error'), t('eventWizard.errors.invalidTimeRange'));
        return;
      }

      const firstActiveDay = [...activeTournamentDays]
        .sort((left, right) => left.date - right.date)[0];

      if (firstActiveDay.startTime.getTime() <= Date.now()) {
        Alert.alert(t('common.error'), t('eventWizard.errors.datePast'));
        return;
      }

      dispatch({
        payload: {
          date: new Date(firstActiveDay.startTime),
          endTime: new Date(firstActiveDay.endTime),
          isMultiDayTournament: true,
          isRecurrent: false,
          pricePerPerson: isReservation ? parseDecimal(pricePerPersonText) : null,
          recurrenceDays: [],
          recurrenceEndDate: null,
          recurrenceFrequency,
          recurrenceInterval,
          recurrenceStartDate: null,
          reservationMode,
          stageDefaultEndTime: tournamentDefaultEndTime,
          stageDefaultStartTime: tournamentDefaultStartTime,
          stageEndDate: tournamentEndDate,
          stageSchedule: tournamentDays.map((day) => ({
            date: new Date(day.date),
            endTime: new Date(day.endTime),
            facilityId: day.facilityId || null,
            hasCustomTime: day.hasCustomTime,
            hasLocationOverride: day.hasLocationOverride,
            isActive: day.isActive !== false,
            location: day.location || null,
            startTime: new Date(day.startTime),
          })),
          stageStartDate: tournamentStartDate,
          startTime: new Date(firstActiveDay.startTime),
        },
        type: 'SET_LOGISTICS',
      });

      navigation.navigate(RouteNames.EventWizardLocation);
      return;
    }

    if (fullEndDate <= fullStartDate) {
      Alert.alert(t('common.error'), t('eventWizard.errors.invalidTimeRange'));
      return;
    }

    if (fullStartDate.getTime() <= Date.now()) {
      Alert.alert(t('common.error'), t('eventWizard.errors.datePast'));
      return;
    }

    let normalizedRecurrenceStartDate = null;
    let normalizedRecurrenceEndDate = null;

    const effectiveIsRecurrent = isTournament ? false : isRecurrent;

    if (effectiveIsRecurrent) {
      normalizedRecurrenceStartDate = recurrenceStartDate
        ? new Date(recurrenceStartDate)
        : new Date(fullStartDate);

      normalizedRecurrenceEndDate = recurrenceEndDate
        ? new Date(recurrenceEndDate)
        : buildDefaultRecurrenceEndDate(
          normalizedRecurrenceStartDate,
          recurrenceFrequency,
          recurrenceInterval,
        );
    }

    if (effectiveIsRecurrent) {
      if (!recurrenceStartDate) {
        setRecurrenceStartDate(normalizedRecurrenceStartDate);
      }
      if (!recurrenceEndDate) {
        setRecurrenceEndDate(normalizedRecurrenceEndDate);
      }
    }

    if (effectiveIsRecurrent) {
      if (
        !normalizedRecurrenceStartDate
        || !normalizedRecurrenceEndDate
      ) {
        Alert.alert(
          t('common.error'),
          t('eventWizard.errors.recurrenceDatesRequired'),
        );
        return;
      }
      if (normalizedRecurrenceEndDate < normalizedRecurrenceStartDate) {
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
      isMultiDayTournament: isTournament ? isMultiDayTournament : false,
      isRecurrent: effectiveIsRecurrent,
      pricePerPerson: isReservation ? parseDecimal(pricePerPersonText) : null,
      recurrenceDays: effectiveIsRecurrent && recurrenceFrequency === 'week' ? recurrenceDays : [],
      recurrenceEndDate: normalizedRecurrenceEndDate,
      recurrenceFrequency,
      recurrenceInterval,
      recurrenceStartDate: normalizedRecurrenceStartDate,
      reservationMode,
      stageDefaultEndTime: fullEndDate,
      stageDefaultStartTime: fullStartDate,
      stageEndDate: isTournament && isMultiDayTournament && state.stageEndDate
        ? state.stageEndDate
        : fullStartDate,
      stageSchedule: isTournament && isMultiDayTournament ? state.stageSchedule : [],
      stageStartDate: fullStartDate,
      startTime: fullStartDate,
    };

    dispatch({
      payload,
      type: 'SET_LOGISTICS',
    });

    navigation.navigate(
      RouteNames.EventWizardLocation,
    );
  };

  const showSingleDateTimeFields = !(isTournament && isMultiDayTournament);

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedWizardState)}
      stepIndex={getEventWizardLogisticsStepIndex(projectedWizardState)}
      subtitle={t('eventWizard.steps.logistics.subtitle')}
      title={t('eventWizard.steps.logistics.title')}
    >
      <View style={[Spaces.gap[24]]}>
        {showSingleDateTimeFields ? (
          <>
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
                  onChange={handleStartTimeChange}
                  value={startTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateTimeSelector
                  display="inline"
                  label={t('eventEdit.fields.endTime.label')}
                  mode="time"
                  onChange={handleEndTimeChange}
                  value={endTime}
                />
              </View>
            </View>
          </>
        ) : null}

        {isTournament ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Alignments.row,
              Alignments.alignCenter,
              Alignments.justifySpaceBetween,
              Spaces.gap[16],
              { backgroundColor: cardSurface, borderColor: cardBorder },
            ]}
          >
            <View style={[Spaces.gap[6], { flex: 1 }]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {t('eventWizard.tournamentProgram.logisticsToggleTitle', 'Tournoi sur plusieurs jours')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'eventWizard.tournamentProgram.logisticsToggleHelper',
                  'Active cette option pour definir une periode, les jours actifs et les horaires par jour.',
                )}
              </Text>
            </View>
            <Switch
              onValueChange={handleTournamentToggle}
              thumbColor={Colors.neutral00}
              trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
              value={isMultiDayTournament}
            />
          </View>
        ) : (
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
        )}

        {isTournament && isMultiDayTournament ? (
          <View style={[Spaces.gap[24]]}>
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[16],
                { backgroundColor: cardSurface, borderColor: cardBorder },
              ]}
            >
              <View style={{ rowGap: 6 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('eventWizard.tournamentProgram.periodTitle', 'Periode')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
                  {t(
                    'eventWizard.tournamentProgram.inlinePeriodHelper',
                    'Definis directement les dates du tournoi avant de choisir le lieu.',
                  )}
                </Text>
              </View>
              <View style={[Spaces.gap[16]]}>
                <DateTimeSelector
                  display="inline"
                  label={t('eventWizard.tournamentProgram.startDate', 'Date de debut')}
                  mode="date"
                  onChange={setTournamentStartDate}
                  value={tournamentStartDate}
                />
                <DateTimeSelector
                  display="inline"
                  label={t('eventWizard.tournamentProgram.endDate', 'Date de fin')}
                  mode="date"
                  onChange={setTournamentEndDate}
                  value={tournamentEndDate}
                />
              </View>
            </View>

            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[16],
                { backgroundColor: cardSurface, borderColor: cardBorder },
              ]}
            >
              <View style={{ rowGap: 6 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('eventWizard.tournamentProgram.defaultHoursTitle', 'Horaires par defaut')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
                  {t(
                    'eventWizard.tournamentProgram.defaultHoursHelper',
                    'Ces horaires servent de base pour toutes les journees actives du tournoi.',
                  )}
                </Text>
              </View>

              <View style={[Alignments.row, Spaces.gap[16]]}>
                <View style={{ flex: 1 }}>
                  <DateTimeSelector
                    display="inline"
                    label={t('eventWizard.tournamentProgram.defaultStartTime', 'Heure de debut')}
                    mode="time"
                    onChange={handleTournamentDefaultStartTimeChange}
                    value={tournamentDefaultStartTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <DateTimeSelector
                    display="inline"
                    label={t('eventWizard.tournamentProgram.defaultEndTime', 'Heure de fin')}
                    mode="time"
                    onChange={handleTournamentDefaultEndTimeChange}
                    value={tournamentDefaultEndTime}
                  />
                </View>
              </View>

              <View style={{ rowGap: 8 }}>
                <Button
                  onPress={applyTournamentDefaultsToAllDays}
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  title={t('eventWizard.tournamentProgram.applyToAll', 'Appliquer a tous')}
                  variant="Secondary"
                />
                <Text style={[Fonts.p4, Fonts.neutral300, { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.tournamentProgram.applyToAllHelper',
                    'Reinitialise les horaires personnalises et reapplique la base du tournoi.',
                  )}
                </Text>
              </View>
            </View>

            <View style={[Spaces.gap[16]]}>
              <View style={{ rowGap: 6 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('eventWizard.tournamentProgram.daysTitle', 'Jours du tournoi')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
                  {t(
                    'eventWizard.tournamentProgram.daysHelper',
                    'Active ou personnalise uniquement les journees qui sortent du cadre par defaut.',
                  )}
                </Text>
              </View>

              {tournamentDays.map((day) => {
                const dateKey = buildDateKey(day.date);
                const inheritedHours = !day.hasCustomTime;

                return (
                  <View
                    key={dateKey}
                    style={[
                      ApplicationStyle.card,
                      Spaces.padding[16],
                      Spaces.gap[16],
                      { backgroundColor: cardSurface, borderColor: cardBorder },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.h4, Fonts.neutral00]}>
                          {format(day.date, 'EEEE d MMMM', { locale: fr })}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {`${format(day.startTime, 'HH:mm')} - ${format(day.endTime, 'HH:mm')}`}
                        </Text>
                      </View>
                      <Switch
                        onValueChange={(value) => handleToggleTournamentDay(dateKey, value)}
                        thumbColor={day.isActive !== false ? Colors.primary500 : Colors.neutral500}
                        trackColor={{
                          false: `${Colors.neutral500}55`,
                          true: `${Colors.primary500}55`,
                        }}
                        value={day.isActive !== false}
                      />
                    </View>

                    <View style={{ rowGap: 10 }}>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {inheritedHours
                          ? t('eventWizard.tournamentProgram.inheritedHours', 'Horaires herites du tournoi')
                          : t('eventWizard.tournamentProgram.customHours', 'Horaires personnalises')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleTournamentTimeModeChange(dateKey, !day.hasCustomTime)}
                        style={[
                          ApplicationStyle.card,
                          Spaces.paddingHorizontal[12],
                          Spaces.paddingVertical[8],
                          {
                            alignSelf: 'flex-start',
                            backgroundColor: day.hasCustomTime ? `${Colors.primary500}18` : 'rgba(255,255,255,0.06)',
                            borderColor: `${Colors.primary500}55`,
                            borderRadius: 999,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p3Bold, day.hasCustomTime ? Fonts.primary500 : Fonts.neutral200]}>
                          {day.hasCustomTime
                            ? t('eventWizard.tournamentProgram.useDefaultHours', 'Revenir aux horaires par defaut')
                            : t('eventWizard.tournamentProgram.customizeHours', 'Personnaliser les horaires')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {day.hasCustomTime ? (
                      <View style={[Spaces.gap[16]]}>
                        <DateTimeSelector
                          display="inline"
                          label={t('eventWizard.tournamentProgram.dayStartTime', 'Heure de debut du jour')}
                          mode="time"
                          onChange={(nextStartTime) => {
                            const adjustedStart = buildDayStartTime(day.date, nextStartTime);
                            handleUpdateTournamentDay(dateKey, {
                              endTime: ensureEndAfterStart(adjustedStart, day.endTime),
                              startTime: adjustedStart,
                            });
                          }}
                          value={day.startTime}
                        />
                        <DateTimeSelector
                          display="inline"
                          label={t('eventWizard.tournamentProgram.dayEndTime', 'Heure de fin du jour')}
                          mode="time"
                          onChange={(nextEndTime) => handleUpdateTournamentDay(dateKey, {
                            endTime: ensureEndAfterStart(
                              day.startTime,
                              buildDayStartTime(day.date, nextEndTime),
                            ),
                          })}
                          value={day.endTime}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {!isTournament && isRecurrent ? (
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
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[12],
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  { backgroundColor: intervalControlSurface, borderColor: fieldBorder },
                ]}
              >
                <TouchableOpacity
                  accessibilityLabel={t(
                    'eventWizard.steps.logistics.recurrenceIntervalDecrement',
                    "Reduire l'intervalle de recurrence",
                  )}
                  disabled={!canDecreaseRecurrenceInterval}
                  onPress={handleDecreaseRecurrenceInterval}
                  style={intervalAdjustButtonStyle(canDecreaseRecurrenceInterval)}
                >
                  <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
                </TouchableOpacity>

                <View style={[Alignments.alignCenter, Spaces.gap[4], { flex: 1 }, Spaces.paddingHorizontal[12]]}>
                  <Text style={[Fonts.h2, Fonts.neutral00, { textAlign: 'center' }]}>
                    {recurrenceInterval}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                    {recurrenceIntervalLabel}
                  </Text>
                </View>

                <TouchableOpacity
                  accessibilityLabel={t(
                    'eventWizard.steps.logistics.recurrenceIntervalIncrement',
                    "Augmenter l'intervalle de recurrence",
                  )}
                  onPress={handleIncreaseRecurrenceInterval}
                  style={intervalAdjustButtonStyle(true)}
                >
                  <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
                </TouchableOpacity>
              </View>
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
                <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[8]]}>
                  {t(
                    'eventWizard.steps.logistics.recurrenceBaseDayHint',
                    "Le jour de l'événement est présélectionné. Tu peux ajouter d'autres jours.",
                  )}
                </Text>
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
