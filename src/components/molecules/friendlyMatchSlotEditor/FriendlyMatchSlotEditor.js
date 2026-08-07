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
  toPickerDay,
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
  // Le jour en cours de saisie est-il DEJA pose ? L appelant remplace un creneau
  // du meme jour au lieu d en empiler un second : le bouton doit donc dire
  // « mettre a jour », sinon l appui ressemble a un doublon.
  const isEditingExistingDay = safeSlots.some(
    (/** @type {any} */ slot) => slot?.date === toIsoDay(dayValue),
  );

  /**
   * Remet un creneau deja pose dans le formulaire, pour le corriger.
   *
   * 🧨 Defaut ⑥ de la recette du 2026-08-07 — « on ne peut pas ajouter d heure
   * dans le tunnel ». Une fois la date ajoutee, le formulaire se vidait : il n y
   * avait plus AUCUN chemin pour attacher un horaire au creneau pose, ni pour
   * corriger celui d un autre jour. La croix ne savait que supprimer.
   * @param {any} slot
   * @returns {void}
   */
  const handleEdit = (slot) => {
    setDayValue(toPickerDay(slot?.date));
    setStartValue(slot?.start || '');
    setEndValue(slot?.end || '');
    setAddError('');
  };

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

      {/* ⛔ PAS de `disabled` : sans date, ce bouton etait GRIS ET MUET, et le
          message « Choisis d abord une date. » que handleAdd sait produire etait
          du code inatteignable. Un bouton vivant qui explique vaut mieux qu un
          bouton mort qui laisse deviner. */}
      <Button
        onPress={handleAdd}
        title={isEditingExistingDay ? 'Mettre à jour cette date' : 'Ajouter cette date'}
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
            <TouchableOpacity
              accessibilityHint="Remet cette date dans le formulaire pour changer son horaire"
              accessibilityLabel={`${toReadableDay(slot.date)}, ${getSlotHoursLabel(slot)}`}
              accessibilityRole="button"
              key={slot.date}
              onPress={() => handleEdit(slot)}
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
                  minHeight: 44,
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

              {/* Le mot « Modifier » et pas seulement un chevron : c est le meme
                  vocabulaire que les rangees du recapitulatif, et il dit ce que
                  l appui va faire. */}
              <Text style={[Fonts.p4, Spaces.marginRight[8], { color: Colors.primary500 }]}>
                Modifier
              </Text>

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
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default FriendlyMatchSlotEditor;
