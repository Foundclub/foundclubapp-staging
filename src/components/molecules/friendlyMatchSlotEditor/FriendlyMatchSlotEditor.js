import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import {
  getSlotHoursLabel,
  toIsoDay,
  toReadableDay,
} from '@/views/friendlyMatch/friendlyMatchDateLabels';

/**
 * Choisir une ou plusieurs dates candidates, et les voir.
 *
 * Extrait de FriendlyMatchWizardDates : le meme bloc est desormais necessaire a
 * la publication (§4.1 etape 3) ET au repostage d une annonce expiree (§4.7).
 * Recopie, il aurait derive : les regles de saisie (pas de date passee, fin
 * apres debut, une seule heure par jour) ne se devinent pas.
 *
 * Le composant ne stocke QUE le formulaire d ajout. La liste des creneaux
 * appartient a l appelant — c est lui qui sait ou elle doit vivre (brouillon du
 * tunnel, etat local d une feuille).
 * @param {object} props
 * @param {string} [props.emptyHint] - Phrase affichee tant qu aucune date n est posee.
 * @param {(slot: any) => void} props.onAdd
 * @param {(isoDay: string) => void} props.onRemove
 * @param {any[]} props.slots
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchSlotEditor({
  emptyHint,
  onAdd,
  onRemove,
  slots,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const [dayValue, setDayValue] = useState('');
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [addError, setAddError] = useState('');

  const safeSlots = Array.isArray(slots) ? slots : [];

  const handleAdd = () => {
    const isoDay = toIsoDay(dayValue);
    if (!isoDay) {
      setAddError('Choisis d’abord une date.');
      return;
    }
    if (startValue && endValue && endValue <= startValue) {
      setAddError('L’heure de fin doit être après l’heure de début.');
      return;
    }

    onAdd({
      date: isoDay,
      ...(endValue ? { end: endValue } : {}),
      ...(startValue ? { start: startValue } : {}),
    });

    setAddError('');
    setDayValue('');
    setStartValue('');
    setEndValue('');
  };

  return (
    <View style={[Spaces.gap[16]]}>
      <DatePickerInput
        error={addError || undefined}
        label="Date"
        minimumDate={new Date()}
        onChange={(/** @type {any} */ value) => {
          setDayValue(value);
          setAddError('');
        }}
        value={dayValue}
      />

      <View style={[Alignments.row, Spaces.gap[12]]}>
        <View style={{ flex: 1 }}>
          <TimePickerInput
            label="Début (facultatif)"
            onChange={setStartValue}
            value={startValue}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TimePickerInput
            label="Fin (facultatif)"
            onChange={setEndValue}
            value={endValue}
          />
        </View>
      </View>

      <Button
        disabled={!dayValue}
        onPress={handleAdd}
        title="Ajouter cette date"
        variant="Secondary"
      />

      {safeSlots.length === 0 ? (
        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
          {emptyHint || 'Aucune date proposée pour l’instant.'}
        </Text>
      ) : (
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {safeSlots.length > 1 ? `${safeSlots.length} dates proposées` : '1 date proposée'}
          </Text>

          {safeSlots.map((/** @type {any} */ slot) => (
            <View
              key={slot.date}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.padding[12],
                {
                  backgroundColor: withAlpha(Colors.primary900, 0.94),
                  borderColor: withAlpha(Colors.primary500, 0.15),
                  borderRadius: 12,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
                  {toReadableDay(slot.date)}
                </Text>
                <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
                  {getSlotHoursLabel(slot)}
                </Text>
              </View>

              <TouchableOpacity
                accessibilityLabel={`Retirer la date du ${toReadableDay(slot.date)}`}
                accessibilityRole="button"
                onPress={() => onRemove(slot.date)}
                style={{
                  alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
                }}
              >
                <Text style={[Fonts.p1Bold, { color: Colors.neutral300 }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default FriendlyMatchSlotEditor;
