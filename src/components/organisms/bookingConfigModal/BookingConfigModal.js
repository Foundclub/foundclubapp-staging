import { addMinutes, format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

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
 */

/**
 * BookingConfigModal - Two-step booking configuration
 * Step 1: Duration selection
 * Step 2: Mode selection (Private vs Shared/Match Ouvert)
 * @param {BookingConfigModalProps} props
 */
function BookingConfigModal({
  date,
  facility,
  isVisible,
  onClose,
  onSuccess,
  selectedSlot,
}) {
  const { t } = useTranslation();
  const {
    Colors, Fonts, Spaces,
  } = useTheme();

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
        label: duration >= 60
          ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? duration % 60 : ''}`
          : `${duration}min`,
        price,
        slots,
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
      const bookingResponse = await createBookingMutation.mutateAsync({
        currentPlayers: mode === 'shared' ? currentPlayers : undefined,
        date,
        endTime,
        facilityId: facility.documentId || '',
        mode,
        startTime: selectedSlot.time,
        targetPlayers: mode === 'shared' ? targetPlayers : undefined,
      });
      const bookingData = bookingResponse?.data || bookingResponse;
      if (bookingData?.pendingReason === 'facility_overbooking') {
        Alert.alert(
          t('bookingModal.overflowRequestCreatedTitle', 'Demande d\'exception envoyée'),
          t(
            'bookingModal.overflowRequestCreatedMessage',
            'Le créneau est déjà complet. Ta réservation a été envoyée aux dirigeants pour arbitrage.',
          ),
        );
      } else if (selectedSlot?.allowsImmediateConfirmation && Number(selectedSlot?.remaining || 0) <= 0) {
        Alert.alert(
          t('bookingModal.overflowAutoApprovedTitle', 'Réservation confirmée'),
          t(
            'bookingModal.overflowAutoApprovedMessage',
            'Le créneau dépasse la capacité habituelle, mais cette installation est configuree en "Autorise et notifier". Les dirigeants ont été prevenus.',
          ),
        );
      }

      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error('Booking error:', error);
    }
  }, [createBookingMutation, currentPlayers, date, endTime, facility, handleClose, mode, onSuccess, selectedDuration, selectedSlot, t, targetPlayers]);

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
      close={handleClose}
      isVisible={isVisible}
    >
      <ScrollView
        contentContainerStyle={[Spaces.padding[16], { paddingBottom: 32 }]}
        style={styles.content}
      >
        {/* Step 1: Duration Selection */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginBottom[16]]}>
              Créneau sélectionné :
              {' '}
              {selectedSlot.time}
              {' '}
              -
              {' '}
              {format(new Date(date), 'dd MMMM', { locale: fr })}
            </Text>

            {durationOptions.map((option) => {
              const isSelected = selectedDuration?.duration === option.duration;
              return (
                <Pressable
                  key={option.duration}
                  onPress={() => setSelectedDuration(option)}
                  style={[
                    styles.optionCard,
                    isSelected && { backgroundColor: 'rgba(240, 85, 45, 0.15)', borderColor: Colors.primary500 },
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
                      (
                      {option.slots}
                      {' '}
                      créneau
                      {option.slots > 1 ? 'x' : ''}
                      )
                    </Text>
                  </View>
                  <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                    {option.price}
                    €
                  </Text>
                </Pressable>
              );
            })}

            <Button
              disabled={!selectedDuration}
              onPress={handleNext}
              style={Spaces.marginTop[24]}
              title="Suivant"
              variant="Primary"
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
              {selectedSlot.time}
              {' '}
              -
              {endTime}
              {' '}
              •
              {selectedDuration?.label}
              {' '}
              •
              {selectedDuration?.price}
              €
            </Text>

            {/* Private Option */}
            <Pressable
              onPress={() => setMode('private')}
              style={[
                styles.modeCard,
                mode === 'private' && { backgroundColor: 'rgba(240, 85, 45, 0.15)', borderColor: Colors.primary500 },
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
                Prix total:
                {' '}
                {selectedDuration?.price}
                €
              </Text>
            </Pressable>

            {/* Shared Option */}
            <Pressable
              onPress={() => setMode('shared')}
              style={[
                styles.modeCard,
                mode === 'shared' && { backgroundColor: 'rgba(46, 204, 113, 0.15)', borderColor: Colors.success500 },
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
                    <Text style={[Fonts.p2, Fonts.neutral00]}>Tu es combien ?</Text>
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
                      Il manque
                      {' '}
                      {targetPlayers - currentPlayers}
                      {' '}
                      joueur
                      {targetPlayers - currentPlayers > 1 ? 's' : ''}
                    </Text>
                    <Text style={[Fonts.p1Bold, { color: Colors.success500 }]}>
                      {pricePerPerson}
                      €/joueur
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>

            <Button
              disabled={createBookingMutation.isPending}
              onPress={handleConfirm}
              style={Spaces.marginTop[24]}
              title={createBookingMutation.isPending ? 'Réservation...' : 'Confirmer la réservation'}
              variant="Primary"
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
  checkBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    maxHeight: 500,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  modeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  optionLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  priceInfo: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 12,
  },
  radio: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioInner: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  sharedConfig: {
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 12,
  },
  stepContent: {
    gap: 12,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepperBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepperBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
  },
});

export default BookingConfigModal;
