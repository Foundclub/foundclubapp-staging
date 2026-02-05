import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import useTheme from '@/theme/themeContext';
import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';
import { useGetLevels } from '@/services/level/levelQueries';

// Position options by sport
const POSITIONS_BY_SPORT = {
  Football: ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'],
  Basketball: ['Meneur', 'Arrière', 'Ailier', 'Ailier fort', 'Pivot'],
  Handball: ['Gardien', 'Arrière', 'Ailier', 'Demi-centre', 'Pivot'],
  Volleyball: ['Passeur', 'Central', 'Réceptionneur-Attaquant', 'Pointu', 'Libéro'],
};

// Validation mode options
const VALIDATION_MODES = [
  { value: 'auto', label: 'Automatique' },
  { value: 'manual', label: 'Manuelle' },
];

/**
 * CreateAdModal - Modal for coaches to create recruitment ads
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 * @param {Object|null} props.team
 * @param {Object|null} [props.event]
 */
const CreateAdModal = ({ visible, onClose, onSuccess, team, event = null }) => {
  const { Colors, Fonts, Spaces, Alignments, Images } = useTheme();
  
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
    if (!levelsData?.data) return [];
    return levelsData.data.map((level) => ({
      value: level.documentId || level.id?.toString(),
      label: level.name || `Level ${level.id}`,
    }));
  }, [levelsData]);

  // Get positions based on team sport
  const sportName = team?.sport?.name || team?.activities?.[0]?.name || 'Football';
  const capitalizedSport = sportName.charAt(0).toUpperCase() + sportName.slice(1).toLowerCase();
  const positions = POSITIONS_BY_SPORT[capitalizedSport] || POSITIONS_BY_SPORT.Football;

  // Handle form submission
  const handleSubmit = async () => {
    if (!team) {
      setError('Vous devez être associé à une équipe pour créer une annonce.');
      return;
    }

    if (!selectedPosition) {
      setError('Veuillez sélectionner un poste.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createRecruitmentAd({
        team: team.documentId,
        position: selectedPosition,
        level: selectedLevel || null,
        quantity,
        validationMode,
        event: event?.documentId || null,
      });

      // Reset form
      setSelectedPosition('');
      setSelectedLevel('');
      setQuantity(1);
      setValidationMode('auto');
      
      onSuccess?.();
    } catch (err) {
      console.error('[CreateAdModal] Error creating ad:', err);
      setError(err?.message || 'Une erreur est survenue lors de la création de l\'annonce.');
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
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
              {event ? 'Recruter pour l\'événement' : 'Créer une annonce'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={[Fonts.h3, { color: Colors.neutral300 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* No Team Warning */}
            {!team && (
              <View style={[styles.warningBox, { backgroundColor: '#F9731620', borderColor: '#F97316' }]}>
                <Text style={[Fonts.p2Bold, { color: '#F97316', textAlign: 'center' }]}>
                  ⚠️ Aucune équipe
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center', marginTop: 8 }]}>
                  Vous devez être associé à une équipe pour créer une annonce de recrutement.
                </Text>
              </View>
            )}

            {/* Team Info */}
            {team && (
              <View style={[styles.infoBox, { backgroundColor: Colors.primary500 + '20', borderColor: Colors.primary500 }]}>
                <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                  📋 Équipe: {team.name || 'Non spécifié'}
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
                {positions.map((pos) => (
                  <TouchableOpacity
                    key={pos}
                    style={[
                      styles.optionButton,
                      { 
                        backgroundColor: selectedPosition === pos ? Colors.primary500 : Colors.neutral800,
                        borderColor: selectedPosition === pos ? Colors.primary500 : Colors.neutral700,
                      }
                    ]}
                    onPress={() => setSelectedPosition(pos)}
                  >
                    <Text style={[
                      Fonts.p3,
                      { color: selectedPosition === pos ? Colors.neutral900 : Colors.neutral00 }
                    ]}>
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
                    style={[
                      styles.optionButton,
                      { 
                        backgroundColor: !selectedLevel ? Colors.primary500 : Colors.neutral800,
                        borderColor: !selectedLevel ? Colors.primary500 : Colors.neutral700,
                      }
                    ]}
                    onPress={() => setSelectedLevel('')}
                  >
                    <Text style={[
                      Fonts.p3,
                      { color: !selectedLevel ? Colors.neutral900 : Colors.neutral00 }
                    ]}>
                      Tous
                    </Text>
                  </TouchableOpacity>
                  {levelOptions.map((level) => (
                    <TouchableOpacity
                      key={level.value}
                      style={[
                        styles.optionButton,
                        { 
                          backgroundColor: selectedLevel === level.value ? Colors.primary500 : Colors.neutral800,
                          borderColor: selectedLevel === level.value ? Colors.primary500 : Colors.neutral700,
                        }
                      ]}
                      onPress={() => setSelectedLevel(level.value)}
                    >
                      <Text style={[
                        Fonts.p3,
                        { color: selectedLevel === level.value ? Colors.neutral900 : Colors.neutral00 }
                      ]}>
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
                  style={[styles.quantityButton, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>−</Text>
                </TouchableOpacity>
                <Text style={[Fonts.h3Bold, { color: Colors.neutral00, minWidth: 50, textAlign: 'center' }]}>
                  {quantity}
                </Text>
                <TouchableOpacity
                  style={[styles.quantityButton, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}
                  onPress={() => setQuantity(Math.min(10, quantity + 1))}
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
                    style={[
                      styles.optionButton,
                      styles.wideOption,
                      { 
                        backgroundColor: validationMode === mode.value ? Colors.primary500 : Colors.neutral800,
                        borderColor: validationMode === mode.value ? Colors.primary500 : Colors.neutral700,
                      }
                    ]}
                    onPress={() => setValidationMode(mode.value)}
                  >
                    <Text style={[
                      Fonts.p3,
                      { color: validationMode === mode.value ? Colors.neutral900 : Colors.neutral00 }
                    ]}>
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
              style={[styles.button, styles.cancelButton, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.submitButton, 
                { 
                  backgroundColor: team ? Colors.primary500 : Colors.neutral700,
                  opacity: loading ? 0.7 : 1,
                }
              ]}
              onPress={handleSubmit}
              disabled={loading || !team}
            >
              {loading ? (
                <ActivityIndicator color={Colors.neutral900} size="small" />
              ) : (
                <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>Créer l'annonce</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  warningBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
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
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  wideOption: {
    flex: 1,
    alignItems: 'center',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {},
  submitButton: {
    borderWidth: 0,
  },
});

export default CreateAdModal;
