import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

const buildDefaultStartTime = (sourceDate = new Date()) => {
  const date = new Date(sourceDate);
  date.setHours(20, 0, 0, 0);
  return date;
};

const buildDefaultEndTime = (sourceDate = new Date()) => {
  const date = new Date(sourceDate);
  date.setHours(21, 0, 0, 0);
  return date;
};

const safeDate = (value, fallback = new Date()) => {
  if (value === 0 || value === '0') {
    return new Date(fallback);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) {
    return new Date(fallback);
  }

  return parsed;
};

const parseCoordsFromValue = (value) => {
  if (!value || typeof value !== 'string' || !value.includes('|')) return null;
  const [lngRaw, latRaw] = value.split('|');
  const lng = Number.parseFloat(lngRaw);
  const lat = Number.parseFloat(latRaw);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
};

const isSameCalendarDay = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

/**
 * Proposal modal used to negotiate venue/date/time for a league match.
 * @param {object} root0 Component props.
 * @param {Date|string|number} [root0.initialDate] Initial day suggestion.
 * @param {Date|string|number} [root0.initialEndTime] Initial end time suggestion.
 * @param {Date|string|number} [root0.initialStartTime] Initial start time suggestion.
 * @param {boolean} root0.isVisible Whether modal is open.
 * @param {() => void} root0.onClose Close callback.
 * @param {(payload: object) => void} root0.onSend Submit callback.
 * @param {() => void} [root0.onSkip] Optional skip callback.
 * @returns {import('react').ReactElement}
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

  const [venueAddress, setVenueAddress] = useState(null);
  const [fallbackVenue, setFallbackVenue] = useState('');
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);

  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(() => buildDefaultStartTime());
  const [endTime, setEndTime] = useState(() => buildDefaultEndTime());

  const datePresets = useMemo(() => {
    const now = new Date();
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
    if (!isVisible) return;

    const baseDate = safeDate(initialDate || initialStartTime || new Date());
    const nextStart = initialStartTime
      ? safeDate(initialStartTime, baseDate)
      : buildDefaultStartTime(baseDate);
    const nextEnd = initialEndTime
      ? safeDate(initialEndTime, nextStart)
      : new Date(nextStart.getTime() + (60 * 60 * 1000));

    setVenueAddress(null);
    setFallbackVenue('');
    setIsFallbackVisible(false);
    setDate(baseDate);
    setStartTime(nextStart);
    setEndTime(nextEnd > nextStart ? nextEnd : new Date(nextStart.getTime() + (60 * 60 * 1000)));
  }, [isVisible, initialDate, initialStartTime, initialEndTime]);

  useEffect(() => {
    const nextEnd = new Date(startTime);
    nextEnd.setMinutes(nextEnd.getMinutes() + 60);
    setEndTime(nextEnd);
  }, [startTime]);

  const isSendDisabled = useMemo(
    () => !venueAddress && !fallbackVenue?.trim(),
    [venueAddress, fallbackVenue],
  );
  const venueSummary = useMemo(
    () => venueAddress?.label || venueAddress?.address || fallbackVenue?.trim() || 'A definir',
    [venueAddress, fallbackVenue],
  );
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
    const trimmedFallback = fallbackVenue?.trim() || '';
    if (!venueAddress && !trimmedFallback) return;

    const finalStartDate = new Date(date);
    finalStartDate.setHours(startTime.getHours());
    finalStartDate.setMinutes(startTime.getMinutes());
    finalStartDate.setSeconds(0, 0);

    if (finalStartDate <= new Date()) {
      Alert.alert(
        'Creneau passe',
        'Ce creneau est deja passe. Choisis une date ou une heure future.',
      );
      return;
    }

    const finalEndDate = new Date(finalStartDate.getTime() + (60 * 60 * 1000));

    const autoAddressLabel = venueAddress?.label || venueAddress?.address || '';
    const hasAutoAddress = Boolean(autoAddressLabel);
    const addressLabel = hasAutoAddress ? autoAddressLabel : trimmedFallback;
    const venueLabel = trimmedFallback || autoAddressLabel || 'Terrain';
    const parsedCoords = parseCoordsFromValue(venueAddress?.value);

    let addressObject = null;
    if (hasAutoAddress) {
      addressObject = {
        ...(venueAddress && typeof venueAddress === 'object' ? venueAddress : {}),
        ...(parsedCoords || {}),
        address: autoAddressLabel,
        fallback_label: trimmedFallback || null,
        label: autoAddressLabel,
      };
    } else if (trimmedFallback) {
      addressObject = {
        address: trimmedFallback,
        fallback_label: trimmedFallback,
        label: trimmedFallback,
      };
    }

    onSend({
      address: addressLabel || null,
      addressCity: addressLabel ? addressLabel.split('(')[0].trim() : null,
      addressObject,
      date: finalStartDate.toISOString(),
      endDate: finalEndDate.toISOString(),
      venue: venueLabel,
    });

    onClose();
    setVenueAddress(null);
    setFallbackVenue('');
    setIsFallbackVisible(false);
  };

  const setDateFromPreset = (presetDate) => {
    const next = new Date(presetDate);
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setDate(next);
  };

  return (
    <BottomModal
      close={onClose}
      contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
      headerComponent={(
        <View>
          <Text style={[Fonts.h3, { color: Colors.gold500, marginBottom: 4, textAlign: 'center' }]}>
            Ou jouer ?
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 16, textAlign: 'center' }]}>
            Propose un terrain et un creneau a ton adversaire.
          </Text>
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['85%']}
    >
      <View style={{ zIndex: 100 }}>
        <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 10 }]}>Lieu</Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
          Recherche une adresse. Si le lieu exact manque, utilise le champ libre.
        </Text>

        <View style={{ zIndex: 100 }}>
          <AutocompleteAddressInput
            address={venueAddress}
            minChars={2}
            placeholder="Rechercher un lieu ou une adresse"
            setAddress={setVenueAddress}
          />
        </View>

        <TouchableOpacity
          onPress={() => setIsFallbackVisible((prev) => !prev)}
          style={{ paddingBottom: 4, paddingTop: 10 }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
            {isFallbackVisible ? 'Masquer le champ libre' : 'Je ne trouve pas mon lieu ou preciser mon adresse'}
          </Text>
        </TouchableOpacity>

        {(isFallbackVisible || fallbackVenue?.trim()) ? (
          <Input
            onChangeText={setFallbackVenue}
            placeholder="Nom ou adresse libre (si introuvable)"
            value={fallbackVenue}
            wrapperStyle={{ marginTop: 8 }}
          />
        ) : null}
      </View>

      <View>
        <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 12 }]}>Creneau</Text>
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
            Creneau commun selectionne automatiquement
          </Text>
        </View>

        <DateTimeSelector
          buttonStyle={glassPickerStyle}
          display="inline"
          label="Date"
          mode="date"
          onChange={setDate}
          value={date}
        />

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

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <DateTimeSelector
              buttonStyle={glassPickerStyle}
              display="inline"
              label="Debut"
              mode="time"
              onChange={setStartTime}
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
              Duree fixe: 60 min
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
          <TouchableOpacity onPress={onSkip} style={{ alignItems: 'center', padding: 12 }}>
            <Text style={[Fonts.p2, { color: Colors.neutral300, textDecorationLine: 'underline' }]}>
              Passer et acceder au chat
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomModal>
  );
}

export default VenueProposalModal;
