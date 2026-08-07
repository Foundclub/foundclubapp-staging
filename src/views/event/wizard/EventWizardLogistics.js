import { format, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import DayPicker from '@/components/molecules/dayPicker/DayPicker';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardLogisticsStepIndex,
  getEventWizardNextRoute,
  getEventWizardStepCount,
  isTournamentEventType,
} from './eventWizardDetectionUtils';

const DATE_INPUT_FORMAT = 'dd/MM/yyyy';
const TIME_INPUT_FORMAT = 'HH:mm';

/**
 * 🧨 LA HAUTEUR DE LA FEUILLE « REPETER », ET POURQUOI ELLE EST OBLIGATOIRE.
 *
 * Defaut trouve a la recette du 2026-08-07 : la feuille « ne defile pas jusqu'en
 * bas » et « ses boutons sont inatteignables » ⇒ la recurrence est inutilisable
 * sur un vrai telephone. Ce n'est pas une impression, c'est une soustraction.
 *
 * `BottomModal` a DEUX mises en page, et c'est `snapPoints` qui choisit.
 *  - SANS `snapPoints` : la feuille se dimensionne sur son contenu, et sa seule
 *    zone defilante est plafonnee a 70 % de la hauteur d'ECRAN
 *    (`BottomModal.js:322`) dans un conteneur SANS flex. L'entete et le pied
 *    s'empilent PAR-DESSUS ce plafond, ils ne s'y taillent pas une place.
 *  - AVEC `snapPoints` : conteneur et zone defilante passent en `flex: 1`
 *    (`BottomModal.js:298` et `:322`). La zone defilante prend exactement ce
 *    que l'entete et le pied lui laissent. Le pied reste donc toujours a
 *    l'ecran, quel que soit le contenu.
 *
 * Le calcul qui condamne la premiere mise en page, sur un iPhone 14
 * (ecran 844 pt, encoche 47) : la feuille ne peut pas depasser
 * 844 - (47 + 20) = 777 pt (`topInset`, `BottomModal.js:274`), or
 * entete 64 + zone defilante 0,7 x 844 = 590,8 + pied 162 = 816,8 pt.
 * Des que le contenu reclame plus de 777 - 64 - 162 = 551 pt, le pied — qui
 * n'est PAS dans la zone defilante — passe sous le bord bas de la feuille, et
 * AUCUN defilement ne peut l'y ramener. La feuille de recurrence (frequence,
 * cadence, jours, deux dates) depasse ce seuil.
 *
 * ⛔ `BottomModal` est utilise par 70 fichiers, dont les feuilles payantes : on
 * ne le modifie pas. On utilise la mise en page qu'il prevoit deja pour ce cas,
 * comme le font deja une quarantaine de feuilles de ce depot.
 * @type {string[]}
 */
const RECURRENCE_SHEET_SNAP_POINTS = ['90%'];

const toDateInputText = (dateValue) => format(dateValue, DATE_INPUT_FORMAT);
const toTimeInputText = (dateValue) => format(dateValue, TIME_INPUT_FORMAT);

const mergeDateInput = (text, fallbackDate) => {
  const parsed = parse(text, DATE_INPUT_FORMAT, fallbackDate);
  return isValid(parsed) ? parsed : fallbackDate;
};

const mergeTimeInput = (text, referenceDate) => {
  const [hours, minutes] = String(text || '').split(':').map(Number);
  const merged = new Date(referenceDate);
  merged.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return merged;
};

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

/**
 * Le libelle d'une cadence : « Toutes les semaines », « Tous les 3 mois »…
 *
 * Ecrit UNE fois : la rangee « Repeter » de l'etape l'affiche pour la valeur
 * enregistree, et la feuille l'affiche pour le brouillon en cours d'edition.
 * @param {any} t Traducteur `useTranslation` (son type surcharge ne se decrit
 *   pas en JSDoc sans reecrire les surcharges d'i18next).
 * @param {string} frequency `week` ou `month`.
 * @param {number} interval Nombre de periodes.
 * @returns {string} Le libelle affichable.
 */
const buildRecurrenceIntervalLabel = (t, frequency, interval) => {
  const safeInterval = Math.max(MIN_RECURRENCE_INTERVAL, interval);
  if (frequency === 'month') {
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
};

/**
 * Ce que la feuille « Repeter » edite, tant qu'on n'a pas touche « Appliquer ».
 * @typedef {object} BrouillonDeRecurrence
 * @property {any[]} days Les jours de la semaine retenus.
 * @property {any} endDate Date de fin de la repetition.
 * @property {string} frequency `week` ou `month`.
 * @property {string} intervalText Nombre de periodes, tel que saisi.
 * @property {any} startDate Date a partir de laquelle la repetition court.
 */

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
    Images,
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
  // Grammaire d'intertitre du pack : petite capitale espacee, gris clair. La
  // maquette demande 11,5 pt ; la rampe saute de 10 (`p4`) a 12 (`p3`) — on
  // prend le VOISIN plutot qu'une taille en dur qu'aucune porte ne verrait.
  const intertitreStyle = [Fonts.p3Bold, Fonts.neutral300, { letterSpacing: 1 }];

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

  const recurrenceIntervalLabel = useMemo(
    () => buildRecurrenceIntervalLabel(t, recurrenceFrequency, recurrenceInterval),
    [recurrenceFrequency, recurrenceInterval, t],
  );

  // D09 — la recurrence se replie dans une feuille du bas. Elle s'y edite sur un
  // BROUILLON : sortir par le fond ou par le geste ne doit RIEN enregistrer.
  // Seul « Appliquer » ecrit, seul « Ne pas repeter » eteint.
  const [isRecurrenceSheetOpen, setIsRecurrenceSheetOpen] = useState(false);
  const [recurrenceDraft, setRecurrenceDraft] = useState(
    /** @type {BrouillonDeRecurrence | null} */ (null),
  );

  const draftInterval = useMemo(() => {
    const parsed = parseInteger(recurrenceDraft?.intervalText);
    return parsed && parsed > 0 ? parsed : MIN_RECURRENCE_INTERVAL;
  }, [recurrenceDraft?.intervalText]);

  const draftIntervalLabel = useMemo(
    () => buildRecurrenceIntervalLabel(t, recurrenceDraft?.frequency || 'week', draftInterval),
    [draftInterval, recurrenceDraft?.frequency, t],
  );

  const canDecreaseRecurrenceInterval = draftInterval > MIN_RECURRENCE_INTERVAL;

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

  const patchRecurrenceDraft = (/** @type {Partial<BrouillonDeRecurrence>} */ partialUpdate) => {
    setRecurrenceDraft((current) => (current ? { ...current, ...partialUpdate } : current));
  };

  const handleDecreaseRecurrenceInterval = () => {
    patchRecurrenceDraft({
      intervalText: toNumberInputText(Math.max(MIN_RECURRENCE_INTERVAL, draftInterval - 1)),
    });
  };

  const handleIncreaseRecurrenceInterval = () => {
    patchRecurrenceDraft({ intervalText: toNumberInputText(draftInterval + 1) });
  };

  /**
   * Ouvre la feuille sur une COPIE des valeurs enregistrees.
   *
   * Le jour de base est seme ici quand aucun n'est encore choisi : c'est ce que
   * faisait deja l'effet qui suit l'allumage de la recurrence, on le rend
   * simplement visible des l'ouverture.
   */
  const handleOpenRecurrenceSheet = () => {
    const baseStartDate = recurrenceStartDate ? new Date(recurrenceStartDate) : new Date(date);
    setRecurrenceDraft({
      days: recurrenceDays.length > 0 ? recurrenceDays : [date.getDay()],
      endDate: recurrenceEndDate
        ? new Date(recurrenceEndDate)
        : buildDefaultRecurrenceEndDate(baseStartDate, recurrenceFrequency, recurrenceInterval),
      frequency: recurrenceFrequency,
      intervalText: recurrenceIntervalText,
      startDate: baseStartDate,
    });
    setIsRecurrenceSheetOpen(true);
  };

  /** Enregistre le brouillon et allume la recurrence. Le SEUL chemin d'ecriture. */
  const handleApplyRecurrence = () => {
    if (!recurrenceDraft) return;
    setRecurrenceFrequency(recurrenceDraft.frequency);
    setRecurrenceIntervalText(recurrenceDraft.intervalText);
    setRecurrenceDays(recurrenceDraft.days);
    setRecurrenceStartDate(recurrenceDraft.startDate);
    setRecurrenceEndDate(recurrenceDraft.endDate);
    setIsRecurrent(true);
    setIsRecurrenceSheetOpen(false);
  };

  /** Revient a « une seule fois ». Les valeurs saisies restent, elles ne servent plus. */
  const handleClearRecurrence = () => {
    setIsRecurrent(false);
    setIsRecurrenceSheetOpen(false);
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
            'Active au moins une journée de tournoi pour continuer.',
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
      getEventWizardNextRoute(RouteNames.EventWizardLogistics, projectedWizardState),
    );
  };

  const showSingleDateTimeFields = !(isTournament && isMultiDayTournament);

  return (
    <WizardStepLayout
      headerVariant="focus"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedWizardState)}
      stepIndex={getEventWizardLogisticsStepIndex(projectedWizardState)}
      subtitle={t('eventWizard.steps.logistics.focusSubtitle', "Quand a lieu l'événement ?")}
      title={t('eventWizard.steps.logistics.focusTitle', 'Date & horaire')}
    >
      <View style={[Spaces.gap[24]]}>
        {showSingleDateTimeFields ? (
          <View style={[Spaces.gap[12]]}>
            <Text style={intertitreStyle}>
              {t('eventWizard.steps.logistics.dateTimeGroupLabel', 'DATE ET HORAIRE')}
            </Text>

            <DatePickerInput
              label={t('eventEdit.fields.date.label')}
              minimumDate={new Date()}
              onChange={(text) => setDate(mergeDateInput(text, date))}
              value={toDateInputText(date)}
            />

            <View style={[Alignments.row, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <TimePickerInput
                  label={t('eventEdit.fields.startTime.label')}
                  onChange={(text) => handleStartTimeChange(mergeTimeInput(text, startTime))}
                  value={toTimeInputText(startTime)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimePickerInput
                  label={t('eventEdit.fields.endTime.label')}
                  onChange={(text) => handleEndTimeChange(mergeTimeInput(text, endTime))}
                  value={toTimeInputText(endTime)}
                />
              </View>
            </View>

            {/* D09 — « Repeter » est une RANGEE-VALEUR a chevron, pas un
                interrupteur : un switch qui ouvre une fenetre serait
                incoherent. La valeur reste lisible sans ouvrir la feuille, et
                le defaut est « Une seule fois ». */}
            {!isTournament ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: isRecurrenceSheetOpen }}
                activeOpacity={0.85}
                onPress={handleOpenRecurrenceSheet}
                style={[
                  ApplicationStyle.card,
                  Spaces.paddingHorizontal[16],
                  Alignments.row,
                  Alignments.alignCenter,
                  {
                    backgroundColor: cardSurface,
                    borderColor: cardBorder,
                    borderRadius: 16,
                    columnGap: 12,
                    minHeight: 56,
                  },
                ]}
              >
                <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
                  {t('eventWizard.steps.logistics.repeatRowLabel', 'Répéter')}
                </Text>
                <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                  {isRecurrent
                    ? recurrenceIntervalLabel
                    : t('eventWizard.steps.logistics.repeatRowOnce', 'Une seule fois')}
                </Text>
                <Image
                  source={Images.chevronDown}
                  style={{
                    height: 16,
                    tintColor: Colors.neutral600,
                    transform: [{ rotate: '-90deg' }],
                    width: 16,
                  }}
                />
              </TouchableOpacity>
            ) : null}
          </View>
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
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {t('eventWizard.tournamentProgram.logisticsToggleTitle', 'Tournoi sur plusieurs jours')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'eventWizard.tournamentProgram.logisticsToggleHelper',
                  'Active cette option pour définir une période, les jours actifs et les horaires par jour.',
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
        ) : null}

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
                    'Définis directement les dates du tournoi avant de choisir le lieu.',
                  )}
                </Text>
              </View>
              <View style={[Spaces.gap[16]]}>
                <DatePickerInput
                  label={t('eventWizard.tournamentProgram.startDate', 'Date de début')}
                  minimumDate={new Date()}
                  onChange={(text) => setTournamentStartDate(mergeDateInput(text, tournamentStartDate))}
                  value={toDateInputText(tournamentStartDate)}
                />
                <DatePickerInput
                  label={t('eventWizard.tournamentProgram.endDate', 'Date de fin')}
                  minimumDate={tournamentStartDate}
                  onChange={(text) => setTournamentEndDate(mergeDateInput(text, tournamentEndDate))}
                  value={toDateInputText(tournamentEndDate)}
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
                  {t('eventWizard.tournamentProgram.defaultHoursTitle', 'Horaires par défaut')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
                  {t(
                    'eventWizard.tournamentProgram.defaultHoursHelper',
                    'Ces horaires servent de base pour toutes les journées actives du tournoi.',
                  )}
                </Text>
              </View>

              <View style={[Alignments.row, Spaces.gap[16]]}>
                <View style={{ flex: 1 }}>
                  <TimePickerInput
                    label={t('eventWizard.tournamentProgram.defaultStartTime', 'Heure de début')}
                    onChange={(text) => handleTournamentDefaultStartTimeChange(
                      mergeTimeInput(text, tournamentDefaultStartTime),
                    )}
                    value={toTimeInputText(tournamentDefaultStartTime)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePickerInput
                    label={t('eventWizard.tournamentProgram.defaultEndTime', 'Heure de fin')}
                    onChange={(text) => handleTournamentDefaultEndTimeChange(
                      mergeTimeInput(text, tournamentDefaultEndTime),
                    )}
                    value={toTimeInputText(tournamentDefaultEndTime)}
                  />
                </View>
              </View>

              <View style={{ rowGap: 8 }}>
                <Button
                  onPress={applyTournamentDefaultsToAllDays}
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  title={t('eventWizard.tournamentProgram.applyToAll', 'Appliquer à tous')}
                  variant="Secondary"
                />
                <Text style={[Fonts.p4, Fonts.neutral300, { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.tournamentProgram.applyToAllHelper',
                    'Réinitialise les horaires personnalises et reapplique la base du tournoi.',
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
                    'Active ou personnalise uniquement les journées qui sortent du cadre par défaut.',
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
                          ? t('eventWizard.tournamentProgram.inheritedHours', 'Horaires hérités du tournoi')
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
                            ? t('eventWizard.tournamentProgram.useDefaultHours', 'Revenir aux horaires par défaut')
                            : t('eventWizard.tournamentProgram.customizeHours', 'Personnaliser les horaires')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {day.hasCustomTime ? (
                      <View style={[Spaces.gap[16]]}>
                        <TimePickerInput
                          label={t('eventWizard.tournamentProgram.dayStartTime', 'Heure de début du jour')}
                          onChange={(text) => {
                            const adjustedStart = buildDayStartTime(
                              day.date,
                              mergeTimeInput(text, day.startTime),
                            );
                            handleUpdateTournamentDay(dateKey, {
                              endTime: ensureEndAfterStart(adjustedStart, day.endTime),
                              startTime: adjustedStart,
                            });
                          }}
                          value={toTimeInputText(day.startTime)}
                        />
                        <TimePickerInput
                          label={t('eventWizard.tournamentProgram.dayEndTime', 'Heure de fin du jour')}
                          onChange={(text) => handleUpdateTournamentDay(dateKey, {
                            endTime: ensureEndAfterStart(
                              day.startTime,
                              buildDayStartTime(day.date, mergeTimeInput(text, day.endTime)),
                            ),
                          })}
                          value={toTimeInputText(day.endTime)}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* D09 — la recurrence a quitte la page pour une feuille du bas :
            l'etape ne s'allonge plus jamais. Les champs sont les MEMES, le
            defaut reste « une seule fois ». */}
        {!isTournament && recurrenceDraft ? (
          <BottomModal
            close={() => setIsRecurrenceSheetOpen(false)}
            footerComponent={(
              <View style={[Spaces.gap[8]]}>
                <Button
                  onPress={handleApplyRecurrence}
                  title={t('eventWizard.steps.logistics.repeatApply', 'Appliquer')}
                  variant="Primary"
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleClearRecurrence}
                  style={Spaces.paddingVertical[12]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral200, Fonts.textCenter]}>
                    {t('eventWizard.steps.logistics.repeatClear', 'Ne pas répéter')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            headerComponent={(
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                {t('eventWizard.steps.logistics.repeatSheetTitle', "Répéter l'événement")}
              </Text>
            )}
            isVisible={isRecurrenceSheetOpen}
            snapPoints={RECURRENCE_SHEET_SNAP_POINTS}
          >
            <View style={[Spaces.gap[16]]}>
              <View style={[Spaces.gap[8]]}>
                <Text style={intertitreStyle}>
                  {t('eventEdit.fields.recurrenceFrequency.label')}
                </Text>
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  {['week', 'month'].map((value) => {
                    const selected = recurrenceDraft.frequency === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => patchRecurrenceDraft({ frequency: value })}
                        style={[
                          ApplicationStyle.card,
                          Spaces.paddingVertical[8],
                          Spaces.paddingHorizontal[16],
                          {
                            backgroundColor: selected
                              ? withAlpha(Colors.primary500, 0.16)
                              : chipSurface,
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

              <View style={[Spaces.gap[8]]}>
                <Text style={intertitreStyle}>
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
                      "Reduire l'intervalle de récurrence",
                    )}
                    disabled={!canDecreaseRecurrenceInterval}
                    onPress={handleDecreaseRecurrenceInterval}
                    style={intervalAdjustButtonStyle(canDecreaseRecurrenceInterval)}
                  >
                    <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
                  </TouchableOpacity>

                  <View style={[
                    Alignments.alignCenter,
                    Spaces.gap[4],
                    { flex: 1 },
                    Spaces.paddingHorizontal[12],
                  ]}
                  >
                    <Text style={[Fonts.h2, Fonts.neutral00, { textAlign: 'center' }]}>
                      {draftInterval}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                      {draftIntervalLabel}
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityLabel={t(
                      'eventWizard.steps.logistics.recurrenceIntervalIncrement',
                      "Augmenter l'intervalle de récurrence",
                    )}
                    onPress={handleIncreaseRecurrenceInterval}
                    style={intervalAdjustButtonStyle(true)}
                  >
                    <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {recurrenceDraft.frequency === 'week' ? (
                <View style={[Spaces.gap[8]]}>
                  <Text style={intertitreStyle}>
                    {t('eventWizard.steps.logistics.recurrenceDays')}
                  </Text>
                  <DayPicker
                    onChange={(days) => patchRecurrenceDraft({ days })}
                    selectedDays={recurrenceDraft.days}
                  />
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {t(
                      'eventWizard.steps.logistics.recurrenceBaseDayHint',
                      "Le jour de l'événement est présélectionné. Tu peux ajouter d'autres jours.",
                    )}
                  </Text>
                </View>
              ) : null}

              {/* ⚠️ Le pack ne montre que « Jusqu'au ». La date de DEBUT est
                  conservee : elle est saisissable aujourd'hui et alimente
                  `recurrenceStartDate`. La retirer supprimerait une donnee,
                  pas un ornement. */}
              <DatePickerInput
                label={t('eventEdit.fields.recurrenceStartDate.label')}
                onChange={(text) => patchRecurrenceDraft({
                  startDate: mergeDateInput(text, recurrenceDraft.startDate || new Date()),
                })}
                value={toDateInputText(recurrenceDraft.startDate || new Date())}
              />
              <DatePickerInput
                label={t('eventEdit.fields.recurrenceEndDate.label')}
                onChange={(text) => patchRecurrenceDraft({
                  endDate: mergeDateInput(text, recurrenceDraft.endDate || new Date()),
                })}
                value={toDateInputText(recurrenceDraft.endDate || new Date())}
              />
            </View>
          </BottomModal>
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
