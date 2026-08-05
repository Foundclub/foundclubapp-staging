import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { useGetLevels } from '@/services/level/levelQueries';
import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';

import { getPositionValuesForSport } from '@/constants/positions';

// Validation mode options
const VALIDATION_MODES = [
  { label: 'Automatique', value: 'auto' },
  { label: 'Manuelle', value: 'manual' },
];

/**
 * @typedef {{
 *   documentId?: string;
 *   name?: string;
 *   sport?: { name?: string };
 *   activities?: Array<{ name?: string }>;
 * }} TeamLite
 */

/**
 * @typedef {{ documentId?: string }} EventLite
 */

/**
 * CreateAdModal - Modal for coaches to create recruitment ads
 * @param {object} props
 * @param {boolean} props.visible
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 * @param {TeamLite | null} props.team
 * @param {EventLite | null} [props.event]
 */
function CreateAdModal({
  event = null, onClose, onSuccess, team, visible,
}) {
  const {
    Colors, Fonts,
  } = useTheme();

  // Form state
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [validationMode, setValidationMode] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch levels from API
  const { data: levelsData } = useGetLevels();
  const levelOptions = useMemo(() => {
    if (!Array.isArray(levelsData)) return [];
    return levelsData.map((/** @type {any} */ level) => ({
      label: level.name || `Level ${level.id}`,
      value: level.documentId || level.id?.toString(),
    }));
  }, [levelsData]);

  // Get positions based on team sport. Meme source que l'inscription : ce fichier
  // portait sa propre liste, qui contredisait celle enregistree en base.
  const sportName = team?.sport?.name || team?.activities?.[0]?.name || 'Football';
  const positionsDuSport = getPositionValuesForSport(sportName);
  const positions = positionsDuSport.length > 0
    ? positionsDuSport
    : getPositionValuesForSport('football');

  // Handle form submission
  const handleSubmit = async () => {
    if (!team) {
      setError('Tu dois être associé à une équipe pour créer une annonce.');
      return;
    }

    if (!selectedPosition) {
      setError('Merci de sélectionner un poste.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const teamId = team.documentId || '';
      await createRecruitmentAd({
        audienceType: 'player',
        position: selectedPosition,
        team: teamId,
        ...(selectedLevel ? { minLevel: selectedLevel } : {}),
        quantity,
        validationMode,
        ...(event?.documentId ? { event: event.documentId } : {}),
      });

      // Reset form
      setSelectedPosition('');
      setSelectedLevel('');
      setQuantity(1);
      setValidationMode('auto');

      onSuccess?.();
    } catch (err) {
      const typedError = /** @type {any} */ (err);
      console.error('[CreateAdModal] Error creating ad:', typedError);
      setError(typedError?.message || 'Une erreur est survenue lors de la création de l\'annonce.');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setError('');
    setSelectedPosition('');
    setSelectedLevel('');
    setQuantity(1);
    setValidationMode('auto');
    onClose?.();
  };

  // Log when render happens
  console.log('[CreateAdModal] RENDER - visible:', visible, 'team:', team?.name || 'null');

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
              {event ? 'Recruter pour l\'événement' : 'Créer une annonce'}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* No Team Warning */}
            {!team && (
              <View style={[styles.warningBox, { backgroundColor: '#F9731620', borderColor: '#F97316' }]}>
                <Text style={[Fonts.p2Bold, { color: '#F97316', textAlign: 'center' }]}>
                  ⚠️ Aucune équipe
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
                  Tu dois être associé à une équipe pour créer une annonce de recrutement.
                </Text>
              </View>
            )}

            {/* Team Info */}
            {team && (
              <View style={[styles.infoBox, { backgroundColor: `${Colors.primary500}20`, borderColor: Colors.primary500 }]}>
                <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                  📋 Équipe:
                  {' '}
                  {team.name || 'Non spécifié'}
                </Text>
              </View>
            )}

            {/* Error Message */}
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FF3B3020', borderColor: '#FF3B30' }]}>
                <Text style={[Fonts.p3, { color: '#FF3B30', textAlign: 'center' }]}>{error}</Text>
              </View>
            ) : null}

            {/* Position Selection */}
            <View style={styles.section}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
                Poste recherché *
              </Text>
              <View style={styles.optionsGrid}>
                {positions.map((/** @type {string} */ pos) => (
                  <TouchableOpacity
                    key={pos}
                    onPress={() => setSelectedPosition(pos)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: selectedPosition === pos ? Colors.primary500 : Colors.neutral800,
                        borderColor: selectedPosition === pos ? Colors.primary500 : Colors.neutral700,
                      },
                    ]}
                  >
                    <Text style={[
                      Fonts.p3,
                      { color: selectedPosition === pos ? Colors.neutral900 : Colors.neutral00 },
                    ]}
                    >
                      {pos}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Level Selection */}
            <View style={styles.section}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
                Niveau minimum
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    onPress={() => setSelectedLevel('')}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: !selectedLevel ? Colors.primary500 : Colors.neutral800,
                        borderColor: !selectedLevel ? Colors.primary500 : Colors.neutral700,
                      },
                    ]}
                  >
                    <Text style={[
                      Fonts.p3,
                      { color: !selectedLevel ? Colors.neutral900 : Colors.neutral00 },
                    ]}
                    >
                      Tous
                    </Text>
                  </TouchableOpacity>
                  {levelOptions.map((/** @type {{ value: string; label: string }} */ level) => (
                    <TouchableOpacity
                      key={level.value}
                      onPress={() => setSelectedLevel(level.value)}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: selectedLevel === level.value ? Colors.primary500 : Colors.neutral800,
                          borderColor: selectedLevel === level.value ? Colors.primary500 : Colors.neutral700,
                        },
                      ]}
                    >
                      <Text style={[
                        Fonts.p3,
                        { color: selectedLevel === level.value ? Colors.neutral900 : Colors.neutral00 },
                      ]}
                      >
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Quantity */}
            <View style={styles.section}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
                Nombre de joueurs recherchés
              </Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  style={[styles.quantityButton, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}
                >
                  <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>−</Text>
                </TouchableOpacity>
                <Text style={[Fonts.h3Bold, { color: Colors.neutral00, minWidth: 50, textAlign: 'center' }]}>
                  {quantity}
                </Text>
                <TouchableOpacity
                  onPress={() => setQuantity(Math.min(10, quantity + 1))}
                  style={[styles.quantityButton, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}
                >
                  <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Validation Mode */}
            <View style={styles.section}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
                Mode de validation
              </Text>
              <View style={styles.optionsRow}>
                {VALIDATION_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.value}
                    onPress={() => setValidationMode(mode.value)}
                    style={[
                      styles.optionButton,
                      styles.wideOption,
                      {
                        backgroundColor: validationMode === mode.value ? Colors.primary500 : Colors.neutral800,
                        borderColor: validationMode === mode.value ? Colors.primary500 : Colors.neutral700,
                      },
                    ]}
                  >
                    <Text style={[
                      Fonts.p3,
                      { color: validationMode === mode.value ? Colors.neutral900 : Colors.neutral00 },
                    ]}
                    >
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              disabled={loading}
              onPress={handleClose}
              style={[styles.button, styles.cancelButton, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={loading || !team}
              onPress={handleSubmit}
              style={[
                styles.button,
                styles.submitButton,
                {
                  backgroundColor: team ? Colors.primary500 : Colors.neutral700,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.neutral900} size="small" />
              ) : (
                <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>Créer l&apos;annonce</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  cancelButton: {},
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  container: {
    borderRadius: 24,
    maxHeight: '90%',
    maxWidth: 400,
    padding: 24,
    width: '100%',
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoBox: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  optionButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  quantityButton: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  submitButton: {
    borderWidth: 0,
  },
  warningBox: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  wideOption: {
    alignItems: 'center',
    flex: 1,
  },
});

export default CreateAdModal;
