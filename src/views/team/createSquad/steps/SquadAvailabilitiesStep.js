import { useMemo, useState } from 'react';
import {
  Alert, LayoutAnimation, Platform, ScrollView, Text, TouchableOpacity, UIManager, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamSlotCreationForm from '@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm';

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

/**
 * @typedef {{ day: string, startTime: string, endTime: string }} TeamSlotDraft
 */

/**
 * @param {object} props
 * @param {{ slots?: TeamSlotDraft[] }} props.data
 * @param {() => void} props.onNext
 * @param {() => void} props.onPrev
 * @param {(key: string, value: any) => void} props.updateData
 */
function SquadAvailabilitiesStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts } = useTheme();
  const [isAddingSlot, setIsAddingSlot] = useState(false);

  const toggleAddSlot = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAddingSlot((prev) => !prev);
  };

  /**
   * @param {TeamSlotDraft | TeamSlotDraft[] | null | undefined} slotPayload
   */
  const handleAddSlot = (slotPayload) => {
    let slotsToAdd = [];
    if (Array.isArray(slotPayload)) {
      slotsToAdd = slotPayload.filter(Boolean);
    } else if (slotPayload) {
      slotsToAdd = [slotPayload];
    }

    if (slotsToAdd.length === 0) return;

    const currentSlots = data.slots || [];
    const idSeed = Date.now();
    const preparedSlots = slotsToAdd.map((slot, index) => ({
      id: `${idSeed}-${index}-${Math.round(Math.random() * 10000)}`,
      ...slot,
    }));

    updateData('slots', [...currentSlots, ...preparedSlots]);

    if (isAddingSlot) {
      toggleAddSlot();
    }
  };

  const handleContinue = () => {
    if (isAddingSlot) {
      Alert.alert('Popup ouvert', 'Valide ou annule le popup Ajouter un creneau avant de continuer.');
      return;
    }

    onNext();
  };

  /**
   * @param {string} id
   */
  const removeSlot = (id) => {
    const currentSlots = data.slots || [];
    updateData('slots', currentSlots.filter((slot) => slot.id !== id));
  };

  const sortedSlots = useMemo(() => {
    const slots = data.slots || [];
    const dayOrder = {
      friday: 5, monday: 1, saturday: 6, sunday: 7, thursday: 4, tuesday: 2, wednesday: 3,
    };

    return [...slots].sort((a, b) => {
      const dayDiff = dayOrder[a.day] - dayOrder[b.day];
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [data.slots]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <Text style={[Fonts.h2, {
        color: Colors.neutral00, marginBottom: 10, marginTop: 0, textAlign: 'center',
      }]}
      >
        Quand votre equipe joue-t-elle habituellement ?
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginBottom: 10 }}
      >
        {sortedSlots.map((slot) => {
          const dayLabel = DAYS.find((day) => day.value === slot.day)?.label || slot.day;

          return (
            <View
              key={slot.id}
              style={{
                alignItems: 'center',
                backgroundColor: Colors.neutral800,
                borderColor: Colors.neutral700,
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
                padding: 12,
              }}
            >
              <View>
                <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>{dayLabel}</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
                  {slot.startTime}
                  {' '}
                  -
                  {slot.endTime}
                </Text>
              </View>

              <TouchableOpacity onPress={() => removeSlot(slot.id)}>
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {(!sortedSlots || sortedSlots.length === 0) && !isAddingSlot && (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Text style={[Fonts.p2, { color: Colors.neutral500, textAlign: 'center' }]}>
              Ajoutez vos creneaux reguliers pour faciliter le matchmaking.
            </Text>
          </View>
        )}

        {!isAddingSlot ? (
          <Button
            onPress={toggleAddSlot}
            style={{ marginTop: 10 }}
            title="+ Ajouter un creneau"
            variant="Secondary"
          />
        ) : (
          <View style={{ marginTop: 10 }}>
            <TeamSlotCreationForm
              onAdd={handleAddSlot}
              onCancel={toggleAddSlot}
            />
          </View>
        )}
      </ScrollView>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button
          disabled={isAddingSlot}
          onPress={handleContinue}
          title="Continuer"
          variant="Primary"
        />
        <Button
          onPress={onPrev}
          title="Retour"
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SquadAvailabilitiesStep;
