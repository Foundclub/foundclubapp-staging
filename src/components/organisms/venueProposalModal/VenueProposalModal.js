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

import { useAppFeedback } from '@/context/AppFeedbackContext';

/**
 * @param {Date} [sourceDate]
 */
const buildDefaultStartTime = (sourceDate = getParisNowAsDeviceDate()) => {
  const date = new Date(sourceDate);
  date.setHours(20, 0, 0, 0);
  return date;
};

/**
 * @param {Date} [sourceDate]
 */
const buildDefaultEndTime = (sourceDate = getParisNowAsDeviceDate()) => {
  const date = new Date(sourceDate);
  date.setHours(21, 0, 0, 0);
  return date;
};

/**
 * @param {Date | string | number | null | undefined} value
 * @param {Date} [fallback]
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
 * @param {Date} left
 * @param {Date} right
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
 * @property {() => void} onClose
 * @property {(payload: VenueProposalPayload) => void} onSend
 * @property {(() => void) | undefined} [onSkip]
 */

/**
 * Proposal modal used to negotiate venue/date/time for a league match.
 * V1 simplification: one free text field for place/address.
 * @param {VenueProposalModalProps} props
 */
function VenueProposalModal({
  initialDate,
  initialEndTime,
  initialStartTime,
  isVisible,
  onClose,
  onSend,
  onSkip,
}) {
  const { Colors, Fonts } = useTheme();
  const { showBanner } = useAppFeedback();

  const [venueInput, setVenueInput] = useState('');
  const [date, setDate] = useState(getParisNowAsDeviceDate());
  const [startTime, setStartTime] = useState(() => buildDefaultStartTime());
  const [endTime, setEndTime] = useState(() => buildDefaultEndTime());
  const modalScrollRef = useRef(
    /** @type {{ scrollTo?: (options: { y: number; animated?: boolean }) => void; scrollToOffset?: (options: { offset: number; animated?: boolean }) => void } | null} */ (null),
  );
  const hasHydratedInitialValuesRef = useRef(false);
  const [dateSelectorY, setDateSelectorY] = useState(0);
  const [timeSelectorY, setTimeSelectorY] = useState(0);

  const datePresets = useMemo(() => {
    const now = getParisNowAsDeviceDate();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const plusTwoDays = new Date(now);
    plusTwoDays.setDate(now.getDate() + 2);
    return [
      { id: 'today', label: "Aujourd'hui", value: now },
      { id: 'tomorrow', label: 'Demain', value: tomorrow },
      { id: 'plus-two', label: '+2 jours', value: plusTwoDays },
    ];
  }, []);

  useEffect(() => {
    if (!isVisible) {
      hasHydratedInitialValuesRef.current = false;
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
      : new Date(nextStart.getTime() + (60 * 60 * 1000));

    setVenueInput('');
    setDate(baseDate);
    setStartTime(nextStart);
    setEndTime(nextEnd > nextStart ? nextEnd : new Date(nextStart.getTime() + (60 * 60 * 1000)));
    hasHydratedInitialValuesRef.current = true;
  }, [isVisible, initialDate, initialStartTime, initialEndTime]);

  useEffect(() => {
    const nextEnd = new Date(startTime);
    nextEnd.setMinutes(nextEnd.getMinutes() + 60);
    setEndTime(nextEnd);
  }, [startTime]);

  const isSendDisabled = useMemo(() => !venueInput?.trim(), [venueInput]);
  const venueSummary = useMemo(() => venueInput?.trim() || 'A definir', [venueInput]);
  const dateSummary = useMemo(
    () => date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      weekday: 'short',
      year: 'numeric',
    }),
    [date],
  );
  const timeSummary = useMemo(
    () => `${startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    [startTime, endTime],
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

  const handleSend = () => {
    const venue = venueInput?.trim();
    if (!venue) return;

    const finalStartDate = new Date(date);
    finalStartDate.setHours(startTime.getHours());
    finalStartDate.setMinutes(startTime.getMinutes());
    finalStartDate.setSeconds(0, 0);

    const startUtcDate = toParisUtcDateFromLocalSelection(finalStartDate);
    const startIso = toParisIsoFromLocalSelection(finalStartDate);
    if (!startUtcDate || !startIso) {
      showBanner({
        body: 'Impossible de convertir le créneau sélectionné.',
        title: 'Erreur',
        tone: 'error',
      });
      return;
    }

    if (startUtcDate <= new Date()) {
      showBanner({
        body: 'Ce créneau est déjà passé (heure de Paris). Choisis une date ou une heure future.',
        title: 'Créneau passé',
        tone: 'error',
      });
      return;
    }

    const finalEndDate = new Date(startUtcDate.getTime() + (60 * 60 * 1000));

    onSend({
      address: venue,
      addressCity: venue,
      addressObject: {
        address: venue,
        fallback_label: venue,
        label: venue,
      },
      date: startIso,
      endDate: finalEndDate.toISOString(),
      venue,
    });

    onClose();
    setVenueInput('');
  };

  const setDateFromPreset = (/** @type {Date} */ presetDate) => {
    const next = new Date(presetDate);
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setDate(next);
  };

  const scrollModalTo = useCallback((/** @type {number} */ y, animated = true) => {
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

  const handleSelectorOpen = useCallback((/** @type {'date' | 'time'} */ target = 'date') => {
    const baseY = target === 'time' ? timeSelectorY : dateSelectorY;
    const firstY = Math.max(baseY - 12, 0);
    const expandedBoost = target === 'time' ? 130 : 170;
    const secondY = Math.max(firstY + expandedBoost, 0);

    scrollModalTo(firstY, true);
    setTimeout(() => {
      scrollModalTo(secondY, true);
    }, 220);
  }, [dateSelectorY, timeSelectorY, scrollModalTo]);

  return (
    <BottomModal
      close={onClose}
      contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
      headerComponent={(
        <LeagueModalHeader
          description="Propose un terrain et un créneau à ton adversaire."
          title="Où jouer ?"
        />
      )}
      isVisible={isVisible}
      scrollViewRef={modalScrollRef}
      snapPoints={['85%']}
    >
      <View>
        <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 10 }]}>Lieu</Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
          Renseigne le nom du lieu ou son adresse en un seul champ.
        </Text>

        <Input
          onChangeText={setVenueInput}
          placeholder="Ex: Z5 Aix, 12 rue des Sports Marseille"
          value={venueInput}
          wrapperStyle={{ marginTop: 4 }}
        />
      </View>

      <View>
        <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 12 }]}>Créneau</Text>
        <View
          style={{
            backgroundColor: 'rgba(1, 179, 244, 0.12)',
            borderColor: 'rgba(1, 179, 244, 0.28)',
            borderRadius: 10,
            borderWidth: 1,
            marginBottom: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            Créneau commun sélectionné automatiquement
          </Text>
        </View>

        <View
          onLayout={(/** @type {{ nativeEvent?: { layout?: { y?: number } } }} */ event) => {
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
          flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8,
        }}
        >
          {datePresets.map((preset) => {
            const isSelected = isSameCalendarDay(date, preset.value);
            return (
              <TouchableOpacity
                key={preset.id}
                onPress={() => setDateFromPreset(preset.value)}
                style={{
                  backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.18)' : 'rgba(255,255,255,0.06)',
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

        <View
          onLayout={(/** @type {{ nativeEvent?: { layout?: { y?: number } } }} */ event) => {
            setTimeSelectorY(event?.nativeEvent?.layout?.y || 0);
          }}
          style={{ flexDirection: 'row', gap: 16 }}
        >
          <View style={{ flex: 1 }}>
            <DateTimeSelector
              buttonStyle={glassPickerStyle}
              display="inline"
              label="Début"
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
              Durée fixe : 60 min
            </Text>
          </View>
        </View>
      </View>

      <View style={{ gap: 12, marginTop: 16 }}>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.16)',
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 4 }]}>
            Lieu:
            {' '}
            {venueSummary}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 2 }]}>
            Date:
            {' '}
            {dateSummary}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            Heure:
            {' '}
            {timeSummary}
          </Text>
        </View>
        <Button
          disabled={isSendDisabled}
          onPress={handleSend}
          style={{ backgroundColor: isSendDisabled ? Colors.neutral700 : Colors.gold500 }}
          textStyle={{ color: isSendDisabled ? Colors.neutral300 : Colors.neutral00, fontWeight: 'bold' }}
          title="ENVOYER LA PROPOSITION"
          variant="Primary"
        />

        {onSkip && (
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
              Passer et accéder au chat
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomModal>
  );
}

export default VenueProposalModal;
