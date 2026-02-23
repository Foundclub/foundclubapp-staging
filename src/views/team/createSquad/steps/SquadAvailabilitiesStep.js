import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import { WheelPicker } from '@/components/molecules/dateTimeSelector/DateTimeSelector';
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
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadAvailabilitiesStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [slotDraft, setSlotDraft] = useState(null);
  const [slotDraftValid, setSlotDraftValid] = useState(false);

  // New slot state
  /* REMOVED UNUSED STATE & HANDLERS - Managed by TeamSlotCreationForm now */

  const toggleAddSlot = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAddingSlot(!isAddingSlot);
  };

  const handleAddSlot = (slotData) => {
    if (!slotData) return;

    const slotToAdd = {
      id: Date.now().toString(),
      ...slotData,
    };
    const currentSlots = data.slots || [];
    updateData('slots', [...currentSlots, slotToAdd]);

    // Reset and close
    toggleAddSlot();
    setSlotDraft(null);
    setSlotDraftValid(false);
  };

  const handleContinue = () => {
    if (isAddingSlot) {
      if (!slotDraftValid || !slotDraft) {
        Alert.alert('Creneau incomplet', "Valide d'abord ton creneau avec le bouton Ajouter.");
        return;
      }

      handleAddSlot(slotDraft);
    }

    onNext();
  };

  const removeSlot = (id) => {
    const currentSlots = data.slots || [];
    updateData('slots', currentSlots.filter((s) => s.id !== id));
  };

  /* Removed unused isFormValid */

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
        Quand votre équipe joue-t-elle habituellement ?
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginBottom: 10 }}
      >
        {/* List of existing slots */}
        {sortedSlots.map((slot) => {
          const dayLabel = DAYS.find((d) => d.value === slot.day)?.label || slot.day;
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
                padding: 12, // Reduced padding
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

        {/* Empty state (only if no slots and not adding) */}
        {(!sortedSlots || sortedSlots.length === 0) && !isAddingSlot && (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <Text style={[Fonts.p2, { color: Colors.neutral500, textAlign: 'center' }]}>
            Ajoutez vos créneaux réguliers pour faciliter le matchmaking.
          </Text>
        </View>
        )}

        {/* Add Slot Button or Form */}
        {!isAddingSlot ? (
          <Button
            onPress={toggleAddSlot}
            style={{ marginTop: 10 }}
            title="+ Ajouter un créneau"
            variant="Secondary"
          />
        ) : (
          <View style={{ marginTop: 10 }}>
            <TeamSlotCreationForm
              onAdd={handleAddSlot}
              onCancel={toggleAddSlot}
              onDraftChange={({ isValid, slot }) => {
                setSlotDraftValid(Boolean(isValid));
                setSlotDraft(slot);
              }}
            />
          </View>
        )}
      </ScrollView>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button
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
