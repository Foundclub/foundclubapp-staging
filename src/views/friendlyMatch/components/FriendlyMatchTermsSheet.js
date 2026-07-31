import { useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';

import { respondToFriendlyMatchApplication } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

import { toAgreedInstant, toShortDay } from '../friendlyMatchDateLabels';

const logger = createLogger('friendly-match-terms');

const VENUE_MAX_LENGTH = 120;

/**
 * « Convenir de la date, de l heure et du lieu » (§4.4).
 *
 * Ce que ces modalites deviennent : a l acceptation, `agreedTerms.date`
 * DEVIENT la date de l evenement et `agreedTerms.venue` son lieu
 * (friendly-match-workflow.ts:134-148). Ce n est donc pas une note de
 * discussion — c est ce qui atterrira dans le planning des deux equipes.
 *
 * ⚠️ Reserve au staff de l ANNONCE : la route `respond` appelle
 * `assertManagesAdSide` AVANT de regarder l action, y compris pour
 * `update_terms` (friendly-match-workflow.ts:305). L equipe candidate discute
 * dans le fil, mais c est l annonceur qui enregistre. Voir la note de
 * divergence avec §4.4 consignee dans le compte rendu du lot.
 * @param {object} props
 * @param {any} props.ad
 * @param {any} props.application
 * @param {() => void} props.onClose
 * @param {() => void} props.onSaved
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchTermsSheet({
  ad, application, onClose, onSaved, visible,
}) {
  const insets = useSafeAreaInsets();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const dayOptions = useMemo(() => normalizeCandidateDates(ad?.candidateDates).map((slot) => ({
    label: toShortDay(slot.date),
    value: slot.date,
  })), [ad?.candidateDates]);

  // Rouvrir repart de ce qui est DEJA convenu, sinon de ce que le candidat
  // avait choisi : on corrige un accord, on ne le ressaisit pas de zero.
  useEffect(() => {
    if (!visible) return;
    const agreed = application?.agreedTerms || {};
    const fallbackDate = String(agreed.date || application?.chosenDate || '');
    setDay(fallbackDate.slice(0, 10));
    setTime(/^\d{4}-\d{2}-\d{2}T/.test(fallbackDate)
      ? new Date(fallbackDate).toTimeString().slice(0, 5)
      : '');
    setVenue(String(agreed.venue || application?.proposedVenue || ''));
    setErrorMessage('');
  }, [application, visible]);

  const agreedInstant = toAgreedInstant(day, time);
  const canSubmit = Boolean(agreedInstant) && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await respondToFriendlyMatchApplication(application?.documentId || application?.id, {
        action: 'update_terms',
        agreedTerms: {
          date: agreedInstant,
          ...(venue.trim() ? { venue: venue.trim() } : {}),
        },
      });
      onSaved();
    } catch (error) {
      const message = /** @type {any} */ (error)?.message
        || 'Impossible d’enregistrer les modalités.';
      logger.error('Mise a jour des modalites refusee', { error });
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={{
        backgroundColor: withAlpha(Colors.neutral900, 0.55),
        flex: 1,
        justifyContent: 'flex-end',
      }}
      >
        <View style={{
          backgroundColor: Colors.primary900,
          borderColor: withAlpha(Colors.primary500, 0.19),
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
        >
          <View style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.marginBottom[16],
          ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>Ce qui est convenu</Text>
            <TouchableOpacity
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              onPress={onClose}
              style={{
                alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
              }}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral200 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[16]]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              Discutez-en dans le fil, puis note ici ce sur quoi vous tombez
              d’accord. C’est ce que le match affichera dans les plannings.
            </Text>

            {dayOptions.length > 0 ? (
              <ChoiceChipGroup
                onSelect={(value) => setDay(String(value))}
                options={dayOptions}
                selectedValue={day}
                title="Quel jour"
              />
            ) : null}

            <TimePickerInput
              label="Heure du coup d’envoi"
              onChange={setTime}
              value={time}
            />

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                Où (facultatif)
              </Text>
              <TextInput
                accessibilityLabel="Lieu du match"
                maxLength={VENUE_MAX_LENGTH}
                onChangeText={setVenue}
                placeholder="Ex : Stade Nord, terrain 2"
                placeholderTextColor={Colors.neutral400}
                style={[Fonts.p1, {
                  backgroundColor: withAlpha(Colors.primary900, 0.94),
                  borderColor: withAlpha(Colors.primary500, 0.15),
                  borderRadius: 12,
                  borderWidth: 1,
                  color: Colors.neutral00,
                  minHeight: 48,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }]}
                value={venue}
              />
            </View>

            {!agreedInstant ? (
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                Choisis un jour pour pouvoir enregistrer.
              </Text>
            ) : null}

            {errorMessage ? (
              <View style={[Spaces.padding[16], {
                backgroundColor: withAlpha(Colors.error500, 0.12),
                borderColor: withAlpha(Colors.error500, 0.4),
                borderRadius: 12,
                borderWidth: 1,
              }]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{errorMessage}</Text>
              </View>
            ) : null}

            <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
              Enregistrer n’accepte pas encore la proposition : le match ne sera
              créé qu’au moment où tu appuieras sur « Accepter ce match ».
            </Text>
          </ScrollView>

          <Button
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onPress={handleSubmit}
            title="Enregistrer ce qui est convenu"
            variant="Primary"
          />
        </View>
      </View>
    </Modal>
  );
}

export default FriendlyMatchTermsSheet;
