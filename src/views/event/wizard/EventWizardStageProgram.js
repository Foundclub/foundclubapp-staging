import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardStageProgramStepIndex,
  getEventWizardStepCount,
  isTournamentEventType,
  shouldSkipEventWizardLocationStep,
} from './eventWizardDetectionUtils';

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

const ensureEndAfterStart = (startTime, endTime) => {
  if (endTime.getTime() > startTime.getTime()) return endTime;
  const nextEnd = new Date(startTime);
  nextEnd.setHours(startTime.getHours() + 1, startTime.getMinutes(), 0, 0);
  return nextEnd;
};

const buildStageDayState = ({
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
  const endTime = ensureEndAfterStart(startTime, inheritedEnd);

  return {
    date,
    endTime,
    facilityId: previousDay?.hasLocationOverride ? previousDay.facilityId || null : null,
    hasCustomTime: Boolean(previousDay?.hasCustomTime),
    hasLocationOverride: Boolean(previousDay?.hasLocationOverride),
    isActive: previousDay?.isActive !== false,
    location: previousDay?.hasLocationOverride ? previousDay.location || null : null,
    startTime,
  };
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

const serializeStageSchedule = (stageDays = []) => stageDays.map((day) => ({
  date: new Date(day.date),
  endTime: new Date(day.endTime),
  facilityId: day.hasLocationOverride ? day.facilityId || null : null,
  hasCustomTime: day.hasCustomTime,
  hasLocationOverride: day.hasLocationOverride,
  isActive: day.isActive !== false,
  location: day.hasLocationOverride ? day.location || null : null,
  startTime: new Date(day.startTime),
}));

/**
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardStageProgram({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const { userData } = useAuth();
  const clubId = state.team?.club?.documentId || null;
  const cmId = state.team?.club?.parentMultisport?.documentId || null;
  // Creation d'installation reservee aux dirigeants (403 serveur pour les autres roles).
  const facilityManagerRoleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canManageFacilities = facilityManagerRoleKey === 'president'
    || facilityManagerRoleKey === 'superAdmin';
  const isTournament = isTournamentEventType(state.type?.name);
  const copyRoot = isTournament ? 'eventWizard.tournamentProgram' : 'eventWizard.stage';
  const copy = (key, fallback) => t(`${copyRoot}.${key}`, fallback);

  const initialStartDate = state.stageStartDate ? new Date(state.stageStartDate) : new Date(state.date || new Date());
  const initialEndDate = state.stageEndDate ? new Date(state.stageEndDate) : new Date(initialStartDate);
  const initialDefaultStartTime = state.stageDefaultStartTime
    ? new Date(state.stageDefaultStartTime)
    : new Date(state.startTime || new Date());
  const initialDefaultEndTime = state.stageDefaultEndTime
    ? new Date(state.stageDefaultEndTime)
    : new Date(state.endTime || new Date());

  const [stageStartDate, setStageStartDate] = useState(initialStartDate);
  const [stageEndDate, setStageEndDate] = useState(initialEndDate);
  const [defaultStartTime, setDefaultStartTime] = useState(initialDefaultStartTime);
  const [defaultEndTime, setDefaultEndTime] = useState(
    ensureEndAfterStart(initialDefaultStartTime, initialDefaultEndTime),
  );
  const [stageDays, setStageDays] = useState(() => normalizeInitialSchedule(state.stageSchedule || []));

  useEffect(() => {
    if (stageEndDate < stageStartDate) {
      setStageEndDate(new Date(stageStartDate));
    }
  }, [stageEndDate, stageStartDate]);

  useEffect(() => {
    setDefaultEndTime((currentEnd) => ensureEndAfterStart(defaultStartTime, currentEnd));
  }, [defaultStartTime]);

  useEffect(() => {
    const days = buildDayRange(stageStartDate, stageEndDate);
    setStageDays((currentDays) => {
      const previousByDate = new Map(
        currentDays.map((day) => [buildDateKey(day.date), day]),
      );

      return days.map((dayDate) => buildStageDayState({
        date: dayDate,
        defaultEndTime,
        defaultStartTime,
        previousDay: previousByDate.get(buildDateKey(dayDate)),
      }));
    });
  }, [defaultEndTime, defaultStartTime, stageEndDate, stageStartDate]);

  const handleToggleDay = (dateKey, isActive) => {
    setStageDays((currentDays) => currentDays.map((day) => (
      buildDateKey(day.date) === dateKey
        ? { ...day, isActive }
        : day
    )));
  };

  const handleTimeModeChange = (dateKey, hasCustomTime) => {
    setStageDays((currentDays) => currentDays.map((day) => {
      if (buildDateKey(day.date) !== dateKey) return day;
      if (!hasCustomTime) {
        return {
          ...day,
          endTime: buildDayStartTime(day.date, defaultEndTime),
          hasCustomTime: false,
          startTime: buildDayStartTime(day.date, defaultStartTime),
        };
      }
      return { ...day, hasCustomTime: true };
    }));
  };

  const handleLocationModeChange = (dateKey, hasLocationOverride) => {
    setStageDays((currentDays) => currentDays.map((day) => {
      if (buildDateKey(day.date) !== dateKey) return day;
      if (!hasLocationOverride) {
        return {
          ...day,
          facilityId: null,
          hasLocationOverride: false,
          location: null,
        };
      }
      return { ...day, hasLocationOverride: true };
    }));
  };

  const handleUpdateDay = (dateKey, partialUpdate) => {
    setStageDays((currentDays) => currentDays.map((day) => (
      buildDateKey(day.date) === dateKey
        ? { ...day, ...partialUpdate }
        : day
    )));
  };

  const applyDefaultsToAllDays = () => {
    setStageDays((currentDays) => currentDays.map((day) => ({
      ...day,
      endTime: buildDayStartTime(day.date, defaultEndTime),
      facilityId: null,
      hasCustomTime: false,
      hasLocationOverride: false,
      location: null,
      startTime: buildDayStartTime(day.date, defaultStartTime),
    })));
  };

  const activeDays = useMemo(
    () => stageDays.filter((day) => day.isActive !== false),
    [stageDays],
  );
  const stageSchedulePayload = useMemo(
    () => serializeStageSchedule(stageDays),
    [stageDays],
  );
  const projectedWizardState = useMemo(() => ({
    ...state,
    isMultiDayTournament: isTournament ? true : state.isMultiDayTournament,
    stageSchedule: stageSchedulePayload,
  }), [isTournament, stageSchedulePayload, state]);

  const handleAddFacility = () => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId,
      cmId,
    });
  };

  const handleNext = () => {
    if (!activeDays.length) {
      Alert.alert(
        t('common.error', 'Erreur'),
        copy('errors.noActiveDays', isTournament
          ? 'Active au moins une journée de tournoi pour continuer.'
          : 'Active au moins une journée pour continuer.'),
      );
      return;
    }

    const invalidDay = activeDays.find((day) => day.endTime <= day.startTime);
    if (invalidDay) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('eventWizard.errors.invalidTimeRange', 'L heure de fin doit être après l heure de début.'),
      );
      return;
    }

    const invalidLocationDay = activeDays.find((day) => day.hasLocationOverride && !day.facilityId && !day.location);
    if (invalidLocationDay) {
      Alert.alert(
        t('common.error', 'Erreur'),
        copy(
          'errors.locationOverrideRequired',
          'Complète le lieu personnalise pour chaque jour concerne.',
        ),
      );
      return;
    }

    const firstActiveDay = [...activeDays].sort((left, right) => left.date - right.date)[0];
    const nextPayload = {
      date: new Date(firstActiveDay.startTime),
      endTime: new Date(firstActiveDay.endTime),
      isMultiDayTournament: isTournament,
      isRecurrent: false,
      recurrenceDays: [],
      recurrenceEndDate: null,
      recurrenceStartDate: null,
      stageDefaultEndTime: defaultEndTime,
      stageDefaultStartTime: defaultStartTime,
      stageEndDate,
      stageSchedule: stageSchedulePayload,
      stageStartDate,
      startTime: new Date(firstActiveDay.startTime),
    };
    const nextWizardState = {
      ...state,
      ...nextPayload,
    };

    dispatch({
      payload: nextPayload,
      type: 'SET_STAGE_PROGRAM',
    });
    navigation.navigate(getEventWizardExitRoute(
      shouldSkipEventWizardLocationStep(nextWizardState)
        ? RouteNames.EventWizardTournamentSettings
        : getEventWizardNextRoute(RouteNames.EventWizardStageProgram, nextWizardState),
      route?.params,
    ));
  };

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedWizardState)}
      stepIndex={getEventWizardStageProgramStepIndex(projectedWizardState)}
      subtitle={t(
        `${copyRoot}.subtitle`,
        isTournament
          ? 'Définis la période du tournoi, les horaires par défaut et les exceptions sur certains jours.'
          : 'Définis la période du stage, les horaires par défaut et les exceptions sur certains jours.',
      )}
      title={copy('title', isTournament ? 'Programme du tournoi' : 'Programme du stage')}
    >
      <View style={[Spaces.gap[24]]}>
        <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], cardSurfaceStyle]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {copy('periodTitle', 'Periode')}
          </Text>
          <View style={[Spaces.gap[16]]}>
            <DateTimeSelector
              label={copy('startDate', 'Date de début')}
              mode="date"
              onChange={setStageStartDate}
              value={stageStartDate}
            />
            <DateTimeSelector
              label={copy('endDate', 'Date de fin')}
              mode="date"
              onChange={setStageEndDate}
              value={stageEndDate}
            />
          </View>
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], cardSurfaceStyle]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {copy('defaultHoursTitle', 'Horaires par défaut')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {copy(
                'defaultHoursHelper',
                isTournament
                  ? 'Ces horaires servent de base pour toutes les journées actives du tournoi.'
                  : 'Ces horaires servent de base pour toutes les journées actives du stage.',
              )}
            </Text>
          </View>

          <View style={[Spaces.gap[16]]}>
            <View style={[Spaces.gap[12]]}>
              <DateTimeSelector
                label={copy('defaultStartTime', 'Heure de début')}
                mode="time"
                onChange={setDefaultStartTime}
                value={defaultStartTime}
              />
              <DateTimeSelector
                label={copy('defaultEndTime', 'Heure de fin')}
                mode="time"
                onChange={(nextEndTime) => setDefaultEndTime(
                  ensureEndAfterStart(defaultStartTime, nextEndTime),
                )}
                value={defaultEndTime}
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Button
                onPress={applyDefaultsToAllDays}
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                title={copy('applyToAll', 'Appliquer à tous')}
                variant="Secondary"
              />
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {copy(
                  'applyToAllHelper',
                  isTournament
                    ? 'Réinitialise les horaires personnalises et reapplique la base du tournoi.'
                    : 'Réinitialise les horaires personnalises et reapplique la base du stage.',
                )}
              </Text>
            </View>
          </View>
        </View>

        <View style={[Spaces.gap[16]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {copy('daysTitle', isTournament ? 'Jours du tournoi' : 'Jours du stage')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {copy(
                'daysHelper',
                'Active ou personnalise uniquement les journées qui sortent du cadre par défaut.',
              )}
            </Text>
          </View>

          {stageDays.map((day) => {
            const dateKey = buildDateKey(day.date);
            const inheritedHours = !day.hasCustomTime;
            const locationModeLabel = day.hasLocationOverride
              ? copy('customLocation', 'Lieu personnalise')
              : copy('mainLocation', 'Lieu principal');

            return (
              <View
                key={dateKey}
                style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], cardSurfaceStyle]}
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
                    onValueChange={(value) => handleToggleDay(dateKey, value)}
                    thumbColor={day.isActive !== false ? Colors.primary500 : Colors.neutral500}
                    trackColor={{
                      false: `${Colors.neutral500}55`,
                      true: `${Colors.primary500}55`,
                    }}
                    value={day.isActive !== false}
                  />
                </View>

                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {inheritedHours
                      ? copy(
                        'inheritedHours',
                        isTournament ? 'Horaires hérités du tournoi' : 'Horaires hérités du stage',
                      )
                      : copy('customHours', 'Horaires personnalises')}
                  </Text>
                  <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    <TouchableOpacity
                      onPress={() => handleTimeModeChange(dateKey, !day.hasCustomTime)}
                      style={[
                        ApplicationStyle.card,
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          backgroundColor: day.hasCustomTime ? `${Colors.primary500}18` : 'rgba(255,255,255,0.06)',
                          borderColor: `${Colors.primary500}55`,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3Bold, day.hasCustomTime ? Fonts.primary500 : Fonts.neutral200]}>
                        {day.hasCustomTime
                          ? copy('useDefaultHours', 'Revenir aux horaires par défaut')
                          : copy('customizeHours', 'Personnaliser les horaires')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleLocationModeChange(dateKey, !day.hasLocationOverride)}
                      style={[
                        ApplicationStyle.card,
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          backgroundColor: day.hasLocationOverride ? `${Colors.primary500}18` : 'rgba(255,255,255,0.06)',
                          borderColor: `${Colors.primary500}55`,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3Bold, day.hasLocationOverride ? Fonts.primary500 : Fonts.neutral200]}>
                        {day.hasLocationOverride
                          ? copy('useMainLocation', 'Revenir au lieu principal')
                          : copy('customizeLocation', 'Personnaliser le lieu')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {day.hasCustomTime ? (
                  <View style={[Spaces.gap[16]]}>
                    <DateTimeSelector
                      label={copy('dayStartTime', 'Heure de début du jour')}
                      mode="time"
                      onChange={(nextStartTime) => {
                        const adjustedStart = buildDayStartTime(day.date, nextStartTime);
                        handleUpdateDay(dateKey, {
                          endTime: ensureEndAfterStart(adjustedStart, day.endTime),
                          startTime: adjustedStart,
                        });
                      }}
                      value={day.startTime}
                    />
                    <DateTimeSelector
                      label={copy('dayEndTime', 'Heure de fin du jour')}
                      mode="time"
                      onChange={(nextEndTime) => handleUpdateDay(dateKey, {
                        endTime: ensureEndAfterStart(day.startTime, buildDayStartTime(day.date, nextEndTime)),
                      })}
                      value={day.endTime}
                    />
                  </View>
                ) : null}

                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {locationModeLabel}
                </Text>

                {day.hasLocationOverride ? (
                  <FacilitySelector
                    clubId={clubId}
                    cmId={cmId}
                    facilityId={day.facilityId}
                    location={day.location}
                    occupancyWindow={{
                      end: day.endTime.toISOString(),
                      start: day.startTime.toISOString(),
                    }}
                    onAddFacility={canManageFacilities ? handleAddFacility : undefined}
                    onChange={({ facilityId, location }) => handleUpdateDay(dateKey, {
                      facilityId: facilityId || null,
                      location: location || null,
                    })}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardStageProgram;
