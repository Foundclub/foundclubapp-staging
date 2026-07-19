import { useEffect, useMemo, useState } from 'react';
import {
  Platform, Text, TouchableOpacity, UIManager, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import { WheelPicker } from '@/components/molecules/dateTimeSelector/DateTimeSelector';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const DAYS = [
  { label: 'Lundi', value: 'monday' },
  { label: 'Mardi', value: 'tuesday' },
  { label: 'Mercredi', value: 'wednesday' },
  { label: 'Jeudi', value: 'thursday' },
  { label: 'Vendredi', value: 'friday' },
  { label: 'Samedi', value: 'saturday' },
  { label: 'Dimanche', value: 'sunday' },
];

const LOCATION_MODES = [
  { label: 'Recoit', value: 'host' },
  { label: 'Se deplace', value: 'travel' },
  { label: 'Les deux', value: 'both' },
];

/**
 * @typedef {{ day: string, startTime: string, endTime: string, locationMode?: string | null }} TeamSlotDraft
 */

/**
 * @param {object} props
 * @param {(slotOrSlots: TeamSlotDraft | TeamSlotDraft[]) => void} props.onAdd
 * @param {() => void} props.onCancel
 * @param {{ day?: string, startTime?: string, endTime?: string, locationMode?: string | null } | null} [props.initialValues]
 * @param {() => void} [props.onDelete]
 * @param {(draft: { isValid: boolean, slot: TeamSlotDraft | null, slots: TeamSlotDraft[] }) => void} [props.onDraftChange]
 * @param {boolean} [props.requireLocationMode]
 */
function TeamSlotCreationForm({
  initialValues, onAdd, onCancel, onDelete, onDraftChange, requireLocationMode = false,
}) {
  const { Colors, Fonts } = useTheme();
  const isEditMode = Boolean(initialValues);

  const [selectedDay, setSelectedDay] = useState(() => {
    if (initialValues?.day) {
      return DAYS.find((d) => d.value === initialValues.day) || null;
    }
    return null;
  });

  const [selectedDays, setSelectedDays] = useState(
    /** @type {{ label: string, value: string }[]} */ ([]),
  );
  const [locationMode, setLocationMode] = useState(() => {
    if (!requireLocationMode) return 'both';
    return initialValues?.locationMode || 'both';
  });

  const [startTimeDate, setStartTimeDate] = useState(() => {
    const d = new Date();
    if (initialValues?.startTime) {
      const [h, m] = initialValues.startTime.split(':');
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    } else {
      d.setHours(20, 0, 0, 0);
    }
    return d;
  });

  const [endTimeDate, setEndTimeDate] = useState(() => {
    const d = new Date();
    if (initialValues?.endTime) {
      const [h, m] = initialValues.endTime.split(':');
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    } else {
      d.setHours(22, 0, 0, 0);
    }
    return d;
  });

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  /**
   * @param {Date} date
   * @returns {string}
   */
  const formatTime = (date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  /**
   * @param {'hour' | 'minute'} type
   * @param {number} value
   */
  const handleStartTimeChange = (type, value) => {
    const newStart = new Date(startTimeDate);
    if (type === 'hour') newStart.setHours(value);
    if (type === 'minute') newStart.setMinutes(value);
    setStartTimeDate(newStart);

    const minEnd = new Date(newStart);
    minEnd.setHours(minEnd.getHours() + 1);

    if (endTimeDate <= newStart) {
      setEndTimeDate(minEnd);
    }
  };

  /**
   * @param {'hour' | 'minute'} type
   * @param {number} value
   */
  const handleEndTimeChange = (type, value) => {
    const newEnd = new Date(endTimeDate);
    if (type === 'hour') newEnd.setHours(value);
    if (type === 'minute') newEnd.setMinutes(value);
    setEndTimeDate(newEnd);
  };

  const selectedDayValues = useMemo(() => {
    if (isEditMode) {
      return selectedDay?.value ? [selectedDay.value] : [];
    }

    return selectedDays
      .map((day) => day?.value)
      .filter((day) => typeof day === 'string' && day.length > 0);
  }, [isEditMode, selectedDay, selectedDays]);

  const hasValidTimeRange = useMemo(() => endTimeDate > startTimeDate, [endTimeDate, startTimeDate]);

  const slotsDraft = useMemo(() => {
    if (!hasValidTimeRange || selectedDayValues.length === 0) return [];

    const startTime = formatTime(startTimeDate);
    const endTime = formatTime(endTimeDate);

    return selectedDayValues.map((dayValue) => ({
      day: dayValue,
      endTime,
      locationMode: requireLocationMode ? locationMode : null,
      startTime,
    }));
  }, [endTimeDate, hasValidTimeRange, locationMode, requireLocationMode, selectedDayValues, startTimeDate]);

  const isFormValid = useMemo(
    () => hasValidTimeRange && slotsDraft.length > 0 && (!requireLocationMode || Boolean(locationMode)),
    [hasValidTimeRange, locationMode, requireLocationMode, slotsDraft],
  );

  useEffect(() => {
    if (!onDraftChange) return;

    onDraftChange({
      isValid: Boolean(isFormValid),
      slot: isFormValid && slotsDraft.length > 0 ? slotsDraft[0] : null,
      slots: isFormValid ? slotsDraft : [],
    });
  }, [onDraftChange, isFormValid, slotsDraft]);

  const handleAdd = () => {
    if (!isFormValid || slotsDraft.length === 0) return;
    onAdd(isEditMode ? slotsDraft[0] : slotsDraft);
  };

  const daySelectValue = isEditMode
    ? (selectedDay?.label || '')
    : selectedDays
      .map((day) => String(day.value || ''))
      .filter(Boolean);

  const dayModalTitle = isEditMode ? 'Jour' : 'Choisir les jours';
  const dayPlaceholder = isEditMode ? 'Choisir un jour' : 'Choisir un ou plusieurs jours';

  return (
    <View style={{
      backgroundColor: Colors.neutral800,
      borderColor: Colors.neutral700,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 40,
      paddingVertical: 16,
    }}
    >
      <View style={{ marginBottom: 16 }}>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
          {isEditMode ? 'Jour' : 'Jour(s)'}
        </Text>
        <AutocompleteSelect
          confirmButtonLabel="Enregistrer"
          isMulti={!isEditMode}
          isSearchable={false}
          modalSnapPoints={['88%']}
          modalTitle={dayModalTitle}
          options={DAYS}
          placeholder={dayPlaceholder}
          setValue={(value) => {
            if (isEditMode) {
              let nextSelectedDay = null;
              if (Array.isArray(value)) {
                nextSelectedDay = value[0] || null;
              } else if (value) {
                nextSelectedDay = value;
              }
              setSelectedDay(nextSelectedDay);
              return;
            }

            let nextSelectedDays = [];
            if (Array.isArray(value)) {
              nextSelectedDays = value.filter((option) => Boolean(option?.value));
            } else if (value) {
              nextSelectedDays = [value];
            }
            setSelectedDays(nextSelectedDays);
          }}
          value={daySelectValue}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Début</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <WheelPicker
              data={hours}
              isOpen
              onValueChange={(h) => handleStartTimeChange('hour', h)}
              selectedValue={startTimeDate.getHours()}
              visibleItems={3}
              width={40}
            />
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>:</Text>
            <WheelPicker
              data={minutes}
              isOpen
              onValueChange={(m) => handleStartTimeChange('minute', m)}
              selectedValue={startTimeDate.getMinutes()}
              visibleItems={3}
              width={40}
            />
          </View>
        </View>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Fin</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <WheelPicker
              data={hours}
              isOpen
              onValueChange={(h) => handleEndTimeChange('hour', h)}
              selectedValue={endTimeDate.getHours()}
              visibleItems={3}
              width={40}
            />
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>:</Text>
            <WheelPicker
              data={minutes}
              isOpen
              onValueChange={(m) => handleEndTimeChange('minute', m)}
              selectedValue={endTimeDate.getMinutes()}
              visibleItems={3}
              width={40}
            />
          </View>
        </View>
      </View>

      {requireLocationMode ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 10 }]}>
            Sur ce créneau
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {LOCATION_MODES.map((option) => {
              const isActive = locationMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setLocationMode(option.value)}
                  style={{
                    backgroundColor: isActive ? `${Colors.primary500}20` : Colors.neutral900,
                    borderColor: isActive ? Colors.primary500 : Colors.neutral700,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={[Fonts.p3Bold, { color: isActive ? Colors.primary500 : Colors.neutral200 }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 12, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            onPress={onCancel}
            style={{ flex: 1 }}
            title="Annuler"
            variant="Secondary"
          />
          <Button
            disabled={!isFormValid}
            onPress={handleAdd}
            style={{ flex: 1 }}
            title={initialValues ? 'Modifier' : 'Ajouter'}
            variant="Primary"
          />
        </View>

        {initialValues && onDelete && (
          <Button
            onPress={onDelete}
            style={{ borderColor: Colors.error500, borderWidth: 1 }}
            textStyle={{ color: Colors.error500 }}
            title="Supprimer ce créneau"
            variant="Secondary"
          />
        )}
      </View>
    </View>
  );
}

export default TeamSlotCreationForm;
