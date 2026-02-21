import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { addMinutes, format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';

import useTheme from '@/theme/themeContext';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';
import { useCreateBooking } from '@/services/facility/facilityQueries';

/**
 * @typedef {object} BookingDurationOption
 * @property {number} duration
 * @property {number} slots
 * @property {number} price
 * @property {string} label
 */

/**
 * @typedef {object} BookingConfigModalProps
 * @property {boolean} isVisible
 * @property {() => void} onClose
 * @property {(() => void) | undefined} [onSuccess]
 * @property {{ documentId?: string; slotDuration?: number; pricePerSlot?: number } | undefined} [facility]
 * @property {string | Date} date
 * @property {{ time: string; maxDuration?: number } | undefined} [selectedSlot]
 * @property {any} [availability]
 */

/**
 * BookingConfigModal - Two-step booking configuration
 * Step 1: Duration selection
 * Step 2: Mode selection (Private vs Shared/Match Ouvert)
 * @param {BookingConfigModalProps} props
 */
function BookingConfigModal({
  isVisible,
  onClose,
  onSuccess,
  facility,
  date,
  selectedSlot,
  availability,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces, Alignments } = useTheme();

  // State
  const [step, setStep] = useState(1);
  const [selectedDuration, setSelectedDuration] = useState(/** @type {BookingDurationOption | null} */ (null));
  const [mode, setMode] = useState('private');
  const [currentPlayers, setCurrentPlayers] = useState(1);
  const [targetPlayers, setTargetPlayers] = useState(10);

  // Mutation
  const createBookingMutation = useCreateBooking();

  // Calculate available durations based on maxDuration
  const durationOptions = useMemo(() => {
    if (!selectedSlot || !facility) return [];
    
    const slotDuration = facility.slotDuration || 30;
    const maxDuration = selectedSlot.maxDuration || slotDuration;
    const options = /** @type {BookingDurationOption[]} */ ([]);
    
    let duration = slotDuration;
    while (duration <= maxDuration && duration <= 180) { // Max 3 hours
      const slots = duration / slotDuration;
      const price = slots * (facility.pricePerSlot || 0);
      options.push({
        duration,
        slots,
        price,
        label: duration >= 60 
          ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? duration % 60 : ''}`
          : `${duration}min`,
      });
      duration += slotDuration;
    }
    
    return options;
  }, [selectedSlot, facility]);

  // Calculate end time based on selected duration
  const endTime = useMemo(() => {
    if (!selectedSlot || !selectedDuration) return null;
    const startDate = parse(selectedSlot.time, 'HH:mm', new Date());
    const endDate = addMinutes(startDate, selectedDuration.duration);
    return format(endDate, 'HH:mm');
  }, [selectedSlot, selectedDuration]);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setStep(1);
    setSelectedDuration(null);
    setMode('private');
    setCurrentPlayers(1);
    onClose();
  }, [onClose]);

  // Handle step navigation
  const handleNext = useCallback(() => {
    if (step === 1 && selectedDuration) {
      setStep(2);
    }
  }, [step, selectedDuration]);

  const handleBack = useCallback(() => {
    if (step === 2) {
      setStep(1);
    }
  }, [step]);

  // Handle booking confirmation
  const handleConfirm = useCallback(async () => {
    if (!facility || !selectedSlot || !selectedDuration || !endTime) return;

    try {
      await createBookingMutation.mutateAsync({
        facilityId: facility.documentId || '',
        date,
        startTime: selectedSlot.time,
        endTime,
        mode,
        targetPlayers: mode === 'shared' ? targetPlayers : undefined,
        currentPlayers: mode === 'shared' ? currentPlayers : undefined,
      });
      
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error('Booking error:', error);
    }
  }, [facility, selectedSlot, selectedDuration, date, endTime, mode, targetPlayers, currentPlayers, createBookingMutation, handleClose, onSuccess]);

  // Stepper handlers
  const incrementPlayers = useCallback(() => {
    setCurrentPlayers((p) => Math.min(p + 1, targetPlayers - 1));
  }, [targetPlayers]);

  const decrementPlayers = useCallback(() => {
    setCurrentPlayers((p) => Math.max(p - 1, 1));
  }, []);

  const incrementTarget = useCallback(() => {
    setTargetPlayers((p) => Math.min(p + 1, 22));
  }, []);

  const decrementTarget = useCallback(() => {
    setTargetPlayers((p) => Math.max(p - 1, currentPlayers + 1));
  }, [currentPlayers]);

  // Calculate price per person for shared mode
  const pricePerPerson = useMemo(() => {
    if (!selectedDuration || mode !== 'shared') return 0;
    return Math.ceil(selectedDuration.price / targetPlayers);
  }, [selectedDuration, targetPlayers, mode]);

  if (!selectedSlot) return null;

  return (
    <BottomModal
      isVisible={isVisible}
      close={handleClose}
    >
      <ScrollView 
        style={styles.content}
        contentContainerStyle={[Spaces.padding[16], { paddingBottom: 32 }]}
      >
        {/* Step 1: Duration Selection */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginBottom[16]]}>
              Créneau sélectionné : {selectedSlot.time} - {format(new Date(date), 'dd MMMM', { locale: fr })}
            </Text>

            {durationOptions.map((option) => {
              const isSelected = selectedDuration?.duration === option.duration;
              return (
                <Pressable
                  key={option.duration}
                  onPress={() => setSelectedDuration(option)}
                  style={[
                    styles.optionCard,
                    isSelected && { borderColor: Colors.primary500, backgroundColor: 'rgba(240, 85, 45, 0.15)' },
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.radio, isSelected && { borderColor: Colors.primary500 }]}>
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: Colors.primary500 }]} />}
                    </View>
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {option.label}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      ({option.slots} créneau{option.slots > 1 ? 'x' : ''})
                    </Text>
                  </View>
                  <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                    {option.price}€
                  </Text>
                </Pressable>
              );
            })}

            <Button
              title="Suivant"
              variant="Primary"
              onPress={handleNext}
              disabled={!selectedDuration}
              style={Spaces.marginTop[24]}
            />
          </View>
        )}

        {/* Step 2: Mode Selection */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Pressable onPress={handleBack} style={Spaces.marginBottom[16]}>
              <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
                ← Retour
              </Text>
            </Pressable>

            <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginBottom[16]]}>
              {selectedSlot.time} - {endTime} • {selectedDuration?.label} • {selectedDuration?.price}€
            </Text>

            {/* Private Option */}
            <Pressable
              onPress={() => setMode('private')}
              style={[
                styles.modeCard,
                mode === 'private' && { borderColor: Colors.primary500, backgroundColor: 'rgba(240, 85, 45, 0.15)' },
              ]}
            >
              <View style={styles.modeHeader}>
                <Text style={[Fonts.h3, Fonts.neutral00]}>🔒 PRIVATISER</Text>
                {mode === 'private' && (
                  <View style={[styles.checkBadge, { backgroundColor: Colors.primary500 }]}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[Fonts.p2, Fonts.neutral300]}>
                Je réserve le terrain pour mon groupe
              </Text>
              <Text style={[Fonts.p1Bold, { color: Colors.primary500 }, Spaces.marginTop[8]]}>
                Prix total: {selectedDuration?.price}€
              </Text>
            </Pressable>

            {/* Shared Option */}
            <Pressable
              onPress={() => setMode('shared')}
              style={[
                styles.modeCard,
                mode === 'shared' && { borderColor: Colors.success500, backgroundColor: 'rgba(46, 204, 113, 0.15)' },
              ]}
            >
              <View style={styles.modeHeader}>
                <Text style={[Fonts.h3, Fonts.neutral00]}>👥 MATCH OUVERT</Text>
                {mode === 'shared' && (
                  <View style={[styles.checkBadge, { backgroundColor: Colors.success500 }]}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[Fonts.p2, Fonts.neutral300]}>
                Je cherche des joueurs pour compléter
              </Text>

              {mode === 'shared' && (
                <View style={[styles.sharedConfig, Spaces.marginTop[16]]}>
                  <View style={styles.stepperRow}>
                    <Text style={[Fonts.p2, Fonts.neutral00]}>Joueurs recherchés :</Text>
                    <View style={styles.stepper}>
                      <Pressable onPress={decrementTarget} style={styles.stepperBtn}>
                        <Text style={styles.stepperBtnText}>-</Text>
                      </Pressable>
                      <Text style={[Fonts.p1Bold, Fonts.neutral00, styles.stepperValue]}>
                        {targetPlayers}
                      </Text>
                      <Pressable onPress={incrementTarget} style={styles.stepperBtn}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.stepperRow}>
                    <Text style={[Fonts.p2, Fonts.neutral00]}>Vous êtes combien ?</Text>
                    <View style={styles.stepper}>
                      <Pressable onPress={decrementPlayers} style={styles.stepperBtn}>
                        <Text style={styles.stepperBtnText}>-</Text>
                      </Pressable>
                      <Text style={[Fonts.p1Bold, Fonts.neutral00, styles.stepperValue]}>
                        {currentPlayers}
                      </Text>
                      <Pressable onPress={incrementPlayers} style={styles.stepperBtn}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.priceInfo, { backgroundColor: 'rgba(46, 204, 113, 0.1)' }]}>
                    <Text style={[Fonts.p2, Fonts.neutral00]}>
                      Il manque {targetPlayers - currentPlayers} joueur{targetPlayers - currentPlayers > 1 ? 's' : ''}
                    </Text>
                    <Text style={[Fonts.p1Bold, { color: Colors.success500 }]}>
                      {pricePerPerson}€/joueur
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>

            <Button
              title={createBookingMutation.isPending ? 'Réservation...' : 'Confirmer la réservation'}
              variant="Primary"
              onPress={handleConfirm}
              disabled={createBookingMutation.isPending}
              style={Spaces.marginTop[24]}
            />
          </View>
        )}

        {createBookingMutation.isPending && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.primary500} size="large" />
          </View>
        )}
      </ScrollView>
    </BottomModal>
  );
}

const styles = StyleSheet.create({
  content: {
    maxHeight: 500,
  },
  stepContent: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sharedConfig: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BookingConfigModal;
