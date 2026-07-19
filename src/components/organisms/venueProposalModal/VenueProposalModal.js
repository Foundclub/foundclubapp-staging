import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import LeagueModalHeader from '@/components/molecules/header/LeagueModalHeader';
import Input from '@/components/molecules/input/Input';

import {
  getParisNowAsDeviceDate,
  toDeviceDateFromParisInstant,
  toParisIsoFromLocalSelection,
  toParisUtcDateFromLocalSelection,
} from '@/utils/parisTime';

import {
  buildLeagueLegalAcceptancePayload,
  LEAGUE_ADULT_REQUIRED_SCOPES,
  LEAGUE_LEGAL_SCOPES,
} from '@/constants/leagueLegalAcceptance';
import { useAppFeedback } from '@/context/AppFeedbackContext';

/**
 * Build the default proposal start time for a given day.
 * @param {Date} [sourceDate]
 * @returns {Date}
 */
const buildDefaultStartTime = (sourceDate = getParisNowAsDeviceDate()) => {
  const date = new Date(sourceDate);
  date.setHours(20, 0, 0, 0);
  return date;
};

/**
 * Build the default proposal end time from the default start time.
 * @param {Date} [sourceDate]
 * @param {number} [durationMinutes]
 * @returns {Date}
 */
const buildDefaultEndTime = (sourceDate = getParisNowAsDeviceDate(), durationMinutes = 60) => {
  const date = buildDefaultStartTime(sourceDate);
  date.setMinutes(date.getMinutes() + durationMinutes);
  return date;
};

/**
 * Convert a raw date-like value into a safe Date instance.
 * @param {Date | string | number | null | undefined} value
 * @param {Date} [fallback]
 * @returns {Date}
 */
const safeDate = (value, fallback = getParisNowAsDeviceDate()) => {
  if (value === 0 || value === '0') {
    return new Date(fallback);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) {
    return new Date(fallback);
  }

  return parsed;
};

/**
 * Compare two dates using only their calendar day.
 * @param {Date} left
 * @param {Date} right
 * @returns {boolean}
 */
const isSameCalendarDay = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

/**
 * @typedef {object} VenueProposalPayload
 * @property {string} venue
 * @property {string} address
 * @property {string} addressCity
 * @property {{ address: string; fallback_label: string; label: string }} addressObject
 * @property {string} date
 * @property {string} endDate
 */

/**
 * @typedef {object} VenueProposalModalProps
 * @property {Date | string | null | undefined} [initialDate]
 * @property {Date | string | null | undefined} [initialEndTime]
 * @property {Date | string | null | undefined} [initialStartTime]
 * @property {boolean} isVisible
 * @property {boolean} [isSubmitting]
 * @property {{
 *  metadata?: Record<string, unknown>,
 *  scope?: string,
 *  sourceScreen?: string,
 *  targetDocumentId?: string,
 *  targetLabel?: string,
 *  targetType?: string,
 * } | null | undefined} [legalAcceptanceConfig]
 * @property {() => void} onClose
 * @property {(payload: VenueProposalPayload, options?: { legalAcceptance?: Record<string, unknown> }) => Promise<void> | void} onSend
 * @property {(() => void) | undefined} [onSkip]
 * @property {number} [durationMinutes]
 * @property {boolean} [venueRequired]
 */

/**
 * @typedef {{
 *  scrollTo?: (options: { y: number; animated?: boolean }) => void;
 *  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
 * }} VenueProposalScrollRef
 */

/**
 * Build the wizard step definitions shown in the proposal tunnel.
 * @param {number} durationMinutes
 * @param {boolean} venueRequired
 * @returns {Array<{ key: string; title: string; description: string }>}
 */
const buildStepDefinitions = (durationMinutes, venueRequired) => ([
  {
    description: venueRequired
      ? 'Propose quand et ou jouer à ton adversaire. Tu choisiras la date, l heure et le lieu.'
      : 'Propose quand jouer à ton adversaire. Tu pourras aussi ajouter un lieu si besoin.',
    key: 'intro',
    title: 'Envoyer une proposition de match',
  },
  {
    description: 'Une seule décision ici : choisis le jour à proposer.',
    key: 'date',
    title: 'Choisis la date',
  },
  {
    description: [
      'Choisis l heure de début.',
      `La fin reste calculee automatiquement (${durationMinutes} min).`,
    ].join(' '),
    key: 'time',
    title: 'Choisis l heure',
  },
  {
    description: venueRequired
      ? 'Renseigne un seul lieu ou une seule adresse pour cette proposition.'
      : 'Tu peux déjà proposer un lieu, mais ce n est pas obligatoire pour ce format.',
    key: 'venue',
    title: venueRequired ? 'Choisis le lieu' : 'Ajoute un lieu si besoin',
  },
  {
    description: 'Vérifie les informations avant de les envoyer à ton adversaire.',
    key: 'recap',
    title: 'Vérifie la proposition',
  },
]);

/**
 * Proposal modal used to negotiate venue/date/time for a league match.
 * Now presented as a compact tunnel to keep each step focused.
 * @param {VenueProposalModalProps} props
 * @returns {import('react').ReactElement}
 */
function VenueProposalModal({
  durationMinutes = 60,
  initialDate,
  initialEndTime,
  initialStartTime,
  isSubmitting = false,
  isVisible,
  legalAcceptanceConfig = null,
  onClose,
  onSend,
  onSkip,
  venueRequired = true,
}) {
  const { Colors, Fonts } = useTheme();
  const { showBanner } = useAppFeedback();

  const [venueInput, setVenueInput] = useState('');
  const [date, setDate] = useState(getParisNowAsDeviceDate());
  const [startTime, setStartTime] = useState(() => buildDefaultStartTime());
  const [endTime, setEndTime] = useState(() => buildDefaultEndTime(undefined, durationMinutes));
  const [stepIndex, setStepIndex] = useState(0);
  const [acceptedContext, setAcceptedContext] = useState(false);
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [acceptedAdult, setAcceptedAdult] = useState(false);
  const [acceptedExtra, setAcceptedExtra] = useState(false);
  const [dateSelectorY, setDateSelectorY] = useState(0);
  const [timeSelectorY, setTimeSelectorY] = useState(0);
  const modalScrollRef = useRef(
    /** @type {VenueProposalScrollRef | null} */ (null),
  );
  const hasHydratedInitialValuesRef = useRef(false);

  const stepDefinitions = useMemo(
    () => buildStepDefinitions(durationMinutes, venueRequired),
    [durationMinutes, venueRequired],
  );
  const currentStep = stepDefinitions[stepIndex] || stepDefinitions[0];
  const stepCount = Math.max(stepDefinitions.length - 1, 1);
  const maxStepIndex = Math.max(stepDefinitions.length - 1, 0);
  const isLastStep = stepIndex === stepDefinitions.length - 1;
  const currentStepNumber = stepIndex === 0 ? 0 : stepIndex;
  const stepIndicatorLabel = stepIndex === 0
    ? 'Avant de commencer'
    : `Etape ${currentStepNumber}/${stepCount}`;
  const normalizedLegalScope = String(legalAcceptanceConfig?.scope || '').trim();
  const hasInlineLegalConfirmation = Boolean(normalizedLegalScope);
  const needsAdultConfirmation = hasInlineLegalConfirmation
    && LEAGUE_ADULT_REQUIRED_SCOPES.includes(normalizedLegalScope);
  const needsCaptainResponsibility = [
    LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
    LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
  ].includes(normalizedLegalScope);
  const needsVenueResponsibility = normalizedLegalScope === LEAGUE_LEGAL_SCOPES.MATCH_VENUE_BOOKING;
  const hasExtraConfirmation = needsCaptainResponsibility || needsVenueResponsibility;
  const isLegalConfirmationValid = !hasInlineLegalConfirmation || (
    acceptedContext
    && acceptedRisk
    && acceptedRules
    && (!needsAdultConfirmation || acceptedAdult)
    && (!hasExtraConfirmation || acceptedExtra)
  );

  const datePresets = useMemo(() => {
    const now = getParisNowAsDeviceDate();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const plusTwoDays = new Date(now);
    plusTwoDays.setDate(now.getDate() + 2);
    return [
      { id: 'today', label: 'Aujourd hui', value: now },
      { id: 'tomorrow', label: 'Demain', value: tomorrow },
      { id: 'plus-two', label: '+2 jours', value: plusTwoDays },
    ];
  }, []);

  const scrollModalTo = useCallback((y, animated = true) => {
    const ref = modalScrollRef.current;
    if (!ref) return;

    if (typeof ref.scrollTo === 'function') {
      ref.scrollTo({ animated, y });
      return;
    }

    if (typeof ref.scrollToOffset === 'function') {
      ref.scrollToOffset({ animated, offset: y });
    }
  }, []);

  useEffect(() => {
    if (!isVisible) {
      hasHydratedInitialValuesRef.current = false;
      setStepIndex(0);
      setAcceptedContext(false);
      setAcceptedRisk(false);
      setAcceptedRules(false);
      setAcceptedAdult(false);
      setAcceptedExtra(false);
      return;
    }

    if (hasHydratedInitialValuesRef.current) return;

    const initialParisDate = toDeviceDateFromParisInstant(initialDate || initialStartTime || null);
    const initialParisStart = toDeviceDateFromParisInstant(initialStartTime || null);
    const initialParisEnd = toDeviceDateFromParisInstant(initialEndTime || null);
    const baseDate = safeDate(initialParisDate || getParisNowAsDeviceDate());
    const nextStart = initialParisStart
      ? safeDate(initialParisStart, baseDate)
      : buildDefaultStartTime(baseDate);
    const nextEnd = initialParisEnd
      ? safeDate(initialParisEnd, nextStart)
      : new Date(nextStart.getTime() + (durationMinutes * 60 * 1000));

    setVenueInput('');
    setDate(baseDate);
    setStartTime(nextStart);
    setEndTime(
      nextEnd > nextStart
        ? nextEnd
        : new Date(nextStart.getTime() + (durationMinutes * 60 * 1000)),
    );
    setStepIndex(0);
    hasHydratedInitialValuesRef.current = true;
  }, [durationMinutes, initialDate, initialEndTime, initialStartTime, isVisible]);

  useEffect(() => {
    const nextEnd = new Date(startTime);
    nextEnd.setMinutes(nextEnd.getMinutes() + durationMinutes);
    setEndTime(nextEnd);
  }, [durationMinutes, startTime]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const timer = setTimeout(() => {
      scrollModalTo(0, true);
    }, 40);
    return () => clearTimeout(timer);
  }, [isVisible, scrollModalTo, stepIndex]);

  const venueSummary = useMemo(() => venueInput?.trim() || 'A définir', [venueInput]);
  const dateSummary = useMemo(
    () => date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      weekday: 'short',
      year: 'numeric',
    }),
    [date],
  );
  const timeSummary = useMemo(() => {
    const formattedStartTime = startTime.toLocaleTimeString(
      'fr-FR',
      { hour: '2-digit', minute: '2-digit' },
    );
    const formattedEndTime = endTime.toLocaleTimeString(
      'fr-FR',
      { hour: '2-digit', minute: '2-digit' },
    );
    return `${formattedStartTime} - ${formattedEndTime}`;
  }, [endTime, startTime]);
  const selectedStartDate = useMemo(() => {
    const nextStartDate = new Date(date);
    nextStartDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    return nextStartDate;
  }, [date, startTime]);
  const selectedStartUtcDate = useMemo(
    () => toParisUtcDateFromLocalSelection(selectedStartDate),
    [selectedStartDate],
  );
  const isPastSelection = useMemo(
    () => Boolean(selectedStartUtcDate && selectedStartUtcDate <= new Date()),
    [selectedStartUtcDate],
  );
  const isVenueStepValid = useMemo(
    () => (venueRequired ? Boolean(venueInput?.trim()) : true),
    [venueInput, venueRequired],
  );
  const isSendDisabled = useMemo(
    () => !isVenueStepValid || isPastSelection,
    [isPastSelection, isVenueStepValid],
  );

  const glassPickerStyle = useMemo(() => ({
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    shadowColor: Colors.neutral00,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  }), [Colors.neutral00]);

  const progressTrackStyle = useMemo(() => ({
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  }), []);
  const progressFillStyle = useMemo(() => ({
    backgroundColor: Colors.primary500,
    borderRadius: 999,
    height: '100%',
    width: `${(currentStepNumber / stepCount) * 100}%`,
  }), [Colors.primary500, currentStepNumber, stepCount]);

  const handleSend = useCallback(async () => {
    const venue = venueInput?.trim();
    if (venueRequired && !venue) return;
    if (isSubmitting) return;
    if (!isLegalConfirmationValid) {
      showBanner({
        body: 'Confirme le cadre League avant d envoyer la proposition.',
        title: 'Confirmation requise',
        tone: 'error',
      });
      return;
    }

    const finalStartDate = new Date(date);
    finalStartDate.setHours(startTime.getHours());
    finalStartDate.setMinutes(startTime.getMinutes());
    finalStartDate.setSeconds(0, 0);

    const startUtcDate = toParisUtcDateFromLocalSelection(finalStartDate);
    const startIso = toParisIsoFromLocalSelection(finalStartDate);
    if (!startUtcDate || !startIso) {
      showBanner({
        body: 'Impossible de convertir le créneau sélectionne.',
        title: 'Erreur',
        tone: 'error',
      });
      return;
    }

    if (startUtcDate <= new Date()) {
      showBanner({
        body: 'Ce créneau est déjà passé. Choisis une date ou une heure future.',
        title: 'Créneau passe',
        tone: 'error',
      });
      return;
    }

    const finalEndDate = new Date(startUtcDate.getTime() + (durationMinutes * 60 * 1000));

    const legalAcceptance = hasInlineLegalConfirmation
      ? buildLeagueLegalAcceptancePayload({
        metadata: {
          ...(legalAcceptanceConfig?.metadata || {}),
          ...(venue ? { venueLabel: venue } : {}),
        },
        scope: normalizedLegalScope,
        sourceScreen: legalAcceptanceConfig?.sourceScreen,
        targetDocumentId: legalAcceptanceConfig?.targetDocumentId,
        targetType: legalAcceptanceConfig?.targetType,
      })
      : undefined;

    await onSend({
      address: venue || '',
      addressCity: venue || '',
      addressObject: {
        address: venue || '',
        fallback_label: venue || '',
        label: venue || '',
      },
      date: startIso,
      endDate: finalEndDate.toISOString(),
      venue: venue || '',
    }, legalAcceptance ? { legalAcceptance } : undefined);
  }, [
    date,
    durationMinutes,
    hasInlineLegalConfirmation,
    isLegalConfirmationValid,
    isSubmitting,
    legalAcceptanceConfig?.metadata,
    legalAcceptanceConfig?.sourceScreen,
    legalAcceptanceConfig?.targetDocumentId,
    legalAcceptanceConfig?.targetType,
    normalizedLegalScope,
    onSend,
    showBanner,
    startTime,
    venueInput,
    venueRequired,
  ]);

  const handleAdvance = useCallback(() => {
    if (currentStep?.key === 'venue' && !isVenueStepValid) {
      showBanner({
        body: 'Ajoute un lieu pour continuer.',
        title: 'Lieu requis',
        tone: 'error',
      });
      return;
    }

    if (isLastStep) {
      handleSend();
      return;
    }

    setStepIndex((currentValue) => Math.min(currentValue + 1, maxStepIndex));
  }, [currentStep?.key, handleSend, isLastStep, isVenueStepValid, maxStepIndex, showBanner]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      onClose();
      return;
    }

    setStepIndex((currentValue) => Math.max(currentValue - 1, 0));
  }, [onClose, stepIndex]);

  const setDateFromPreset = (presetDate) => {
    const next = new Date(presetDate);
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setDate(next);
  };

  const handleSelectorOpen = useCallback((target = 'date') => {
    const baseY = target === 'time' ? timeSelectorY : dateSelectorY;
    const firstY = Math.max(baseY - 12, 0);
    const expandedBoost = target === 'time' ? 130 : 170;
    const secondY = Math.max(firstY + expandedBoost, 0);

    scrollModalTo(firstY, true);
    setTimeout(() => {
      scrollModalTo(secondY, true);
    }, 220);
  }, [dateSelectorY, scrollModalTo, timeSelectorY]);

  const venueFieldLabel = venueRequired ? 'Lieu' : 'Lieu (optionnel)';
  const venueFieldHint = venueRequired
    ? 'Renseigne le nom du lieu ou son adresse en un seul champ.'
    : 'Tu peux déjà proposer un lieu, mais ce n est pas obligatoire pour ce format.';
  let isPrimaryDisabled = false;
  if (currentStep?.key === 'recap') {
    isPrimaryDisabled = isSendDisabled || !isLegalConfirmationValid || isSubmitting;
  } else if (currentStep?.key === 'venue') {
    isPrimaryDisabled = !isVenueStepValid || isSubmitting;
  } else {
    isPrimaryDisabled = isSubmitting;
  }
  let primaryButtonTitle = 'Continuer';
  if (stepIndex === 0) {
    primaryButtonTitle = 'Commencer';
  } else if (isLastStep) {
    primaryButtonTitle = 'Envoyer la proposition';
  }

  const renderStepContent = () => {
    if (currentStep?.key === 'intro') {
      return (
        <View style={{ gap: 14 }}>
          <View
            style={{
              backgroundColor: 'rgba(1, 179, 244, 0.10)',
              borderColor: 'rgba(1, 179, 244, 0.24)',
              borderRadius: 14,
              borderWidth: 1,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 10 }]}>
              En bref
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral100, lineHeight: 24 }]}>
              Propose quand et ou jouer à ton adversaire en quelques étapes simples.
            </Text>

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 14,
            }}
            >
              {['Date', 'Heure', 'Lieu'].map((item) => (
                <View
                  key={item}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.18)',
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.gold500, marginBottom: 6 }]}>
              Réponse adverse
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 22 }]}>
              Ton adversaire pourra accepter, refuser ou contre-proposer.
            </Text>
          </View>
        </View>
      );
    }

    if (currentStep?.key === 'date') {
      return (
        <View style={{ gap: 18 }}>
          <View
            style={{
              backgroundColor: 'rgba(1, 179, 244, 0.12)',
              borderColor: 'rgba(1, 179, 244, 0.28)',
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500, marginBottom: 4 }]}>
              Créneau commun déjà trouve
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              On commence juste par choisir le jour à proposer.
            </Text>
          </View>

          <View
            onLayout={(event) => {
              setDateSelectorY(event?.nativeEvent?.layout?.y || 0);
            }}
          >
            <DateTimeSelector
              buttonStyle={glassPickerStyle}
              display="inline"
              label="Date"
              mode="date"
              onChange={setDate}
              onOpen={() => handleSelectorOpen('date')}
              value={date}
            />
          </View>

          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: 8,
          }}
          >
            {datePresets.map((preset) => {
              const isSelected = isSameCalendarDay(date, preset.value);
              return (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => setDateFromPreset(preset.value)}
                  style={{
                    backgroundColor: isSelected
                      ? 'rgba(1, 179, 244, 0.18)'
                      : 'rgba(255,255,255,0.06)',
                    borderColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.18)',
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={[
                      Fonts.p3Bold,
                      { color: isSelected ? Colors.primary500 : Colors.neutral200 },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (currentStep?.key === 'time') {
      return (
        <View style={{ gap: 18 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.14)',
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 4 }]}>
              Date choisie
            </Text>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {dateSummary}
            </Text>
          </View>

          <View
            onLayout={(event) => {
              setTimeSelectorY(event?.nativeEvent?.layout?.y || 0);
            }}
            style={{ flexDirection: 'row', gap: 16 }}
          >
            <View style={{ flex: 1 }}>
              <DateTimeSelector
                buttonStyle={glassPickerStyle}
                display="inline"
                label="Debut"
                mode="time"
                onChange={setStartTime}
                onOpen={() => handleSelectorOpen('time')}
                value={startTime}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00, { marginBottom: 8 }]}>
                Fin (auto)
              </Text>
              <View
                style={[glassPickerStyle, {
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 52,
                  opacity: 0.85,
                }]}
              >
                <Text style={[Fonts.p1, Fonts.neutral00]}>
                  {endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
                {`Durée fixe : ${durationMinutes} min`}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    if (currentStep?.key === 'venue') {
      return (
        <View style={{ gap: 18 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.14)',
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 4 }]}>
              Créneau retenu
            </Text>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {dateSummary}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 2 }]}>
              {timeSummary}
            </Text>
          </View>

          <View>
            <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 10 }]}>
              {venueFieldLabel}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
              {venueFieldHint}
            </Text>

            <Input
              onChangeText={setVenueInput}
              placeholder="Ex: Z5 Aix, 12 rue des Sports Marseille"
              value={venueInput}
              wrapperStyle={{ marginTop: 4 }}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={{ gap: 16 }}>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.16)',
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 6 }]}>
            Lieu
          </Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
            {venueSummary}
          </Text>

          <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 6 }]}>
            Date
          </Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
            {dateSummary}
          </Text>

          <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 6 }]}>
            Heure
          </Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            {timeSummary}
          </Text>
        </View>

        {hasInlineLegalConfirmation ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255, 215, 0, 0.22)',
              borderRadius: 12,
              borderWidth: 1,
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          >
            <View>
              <Text style={[Fonts.p2Bold, { color: Colors.gold500, marginBottom: 6 }]}>
                Confirmation avant envoi
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 22 }]}>
                Confirme ces 4 points pour envoyer la proposition à ton adversaire.
              </Text>
            </View>

            {[
              {
                checked: acceptedContext,
                key: 'context',
                label: 'Je comprends que FoundClub facilite la mise en relation sans organiser le match.',
                toggle: () => setAcceptedContext((previous) => !previous),
              },
              {
                checked: acceptedRisk,
                key: 'risk',
                label: 'J accepte les risques normaux liés à la pratique sportive et je vérifie mon aptitude à jouer.',
                toggle: () => setAcceptedRisk((previous) => !previous),
              },
              {
                checked: acceptedRules,
                key: 'rules',
                label: 'Je respecte les règles du lieu, les consignes de sécurité et la couverture d assurance applicable.',
                toggle: () => setAcceptedRules((previous) => !previous),
              },
              ...(needsAdultConfirmation ? [{
                checked: acceptedAdult,
                key: 'adult',
                label: 'Je certifie avoir 18 ans ou plus pour cette action League.',
                toggle: () => setAcceptedAdult((previous) => !previous),
              }] : []),
              ...(hasExtraConfirmation ? [{
                checked: acceptedExtra,
                key: 'extra',
                label: needsVenueResponsibility
                  ? 'Je confirme que le lieu, les horaires et les conditions du terrain ont été verifies.'
                  : 'Je confirme agir comme membre référent de mon équipe pour cette proposition de match.',
                toggle: () => setAcceptedExtra((previous) => !previous),
              }] : []),
            ].map((item) => (
              <TouchableOpacity
                activeOpacity={0.85}
                key={item.key}
                onPress={item.toggle}
                style={{
                  alignItems: 'flex-start',
                  backgroundColor: item.checked ? 'rgba(1, 179, 244, 0.12)' : 'rgba(255,255,255,0.03)',
                  borderColor: item.checked ? 'rgba(1, 179, 244, 0.45)' : 'rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  borderWidth: 1,
                  flexDirection: 'row',
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: item.checked ? Colors.primary500 : 'transparent',
                    borderColor: item.checked ? Colors.primary500 : 'rgba(255,255,255,0.55)',
                    borderRadius: 4,
                    borderWidth: 2,
                    height: 22,
                    justifyContent: 'center',
                    marginTop: 2,
                    width: 22,
                  }}
                >
                  {item.checked ? (
                    <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>✓</Text>
                  ) : null}
                </View>
                <Text style={[Fonts.p3, { color: Colors.neutral100, flex: 1, lineHeight: 22 }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {isPastSelection ? (
          <View
            style={{
              backgroundColor: 'rgba(255, 94, 94, 0.10)',
              borderColor: 'rgba(255, 94, 94, 0.32)',
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.error700, marginBottom: 4 }]}>
              Créneau à corriger
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              Cette proposition tombe dans le passé. Reviens en arrière pour
              choisir une date ou une heure future.
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <BottomModal
      close={onClose}
      contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
      headerComponent={(
        <View style={{ gap: 14 }}>
          <LeagueModalHeader
            align="left"
            description={currentStep?.description}
            title={currentStep?.title}
          />

          <View style={{ gap: 8 }}>
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              {stepIndicatorLabel}
            </Text>
            <View style={progressTrackStyle}>
              <View style={progressFillStyle} />
            </View>
          </View>
        </View>
      )}
      isVisible={isVisible}
      scrollViewRef={modalScrollRef}
      snapPoints={['88%']}
    >
      {renderStepContent()}

      <View
        style={{
          gap: 12,
          marginTop: 22,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            onPress={handleBack}
            style={{ flex: 1 }}
            title="Retour"
            variant="Secondary"
          />
          <Button
            disabled={isPrimaryDisabled}
            isLoading={Boolean(isLastStep && isSubmitting)}
            onPress={handleAdvance}
            style={{ flex: 1.35 }}
            title={primaryButtonTitle}
            variant="Primary"
          />
        </View>

        {isLastStep && onSkip ? (
          <TouchableOpacity
            onPress={onSkip}
            style={{
              alignItems: 'center',
              borderColor: Colors.primary500,
              borderRadius: 10,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
              Passer et acceder au chat
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomModal>
  );
}

export default VenueProposalModal;
