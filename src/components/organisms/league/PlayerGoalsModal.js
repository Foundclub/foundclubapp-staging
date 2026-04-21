import { useEffect, useState } from 'react';
import {
  FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/**
 * PlayerGoalsModal
 * Modal to enter individual player goals after a match
 * @param root0
 * @param root0.visible
 * @param root0.onClose
 * @param root0.onSubmit
 * @param root0.players
 * @param root0.totalGoals
 * @param root0.teamName
 */
function PlayerGoalsModal({
  onClose,
  onSubmit,
  players = [],
  teamName = '',
  totalGoals = 0,
  visible,
}) {
  const { Colors, Fonts } = useTheme();
  const { showBanner } = useAppFeedback();
  const [goals, setGoals] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset goals when modal opens
  useEffect(() => {
    if (visible) {
      setGoals({});
    }
  }, [visible]);

  const getCurrentTotal = () => Object.values(goals).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);

  const handleGoalChange = (playerId, value) => {
    const numValue = parseInt(value, 10) || 0;
    setGoals((prev) => ({ ...prev, [playerId]: numValue }));
  };

  const handleSubmit = async () => {
    const currentTotal = getCurrentTotal();

    if (currentTotal !== totalGoals) {
      showBanner({
        body: `Le total des buts (${currentTotal}) ne correspond pas au score (${totalGoals}). Veuillez corriger.`,
        title: 'Erreur',
        tone: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(goals);
      onClose();
    } catch (error) {
      showBanner({
        body: 'Impossible de sauvegarder les buteurs.',
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPlayer = ({ item }) => (
    <View style={styles.playerRow}>
      <Text style={[styles.playerName, { color: Colors.neutral100 }]}>
        {item.firstname || item.username}
        {' '}
        {item.lastname || ''}
      </Text>
      <View style={styles.goalInputWrapper}>
        <TouchableOpacity
          onPress={() => handleGoalChange(item.documentId, Math.max(0, (goals[item.documentId] || 0) - 1))}
          style={styles.counterButton}
        >
          <Text style={styles.counterText}>-</Text>
        </TouchableOpacity>
        <TextInput
          keyboardType="numeric"
          maxLength={2}
          onChangeText={(val) => handleGoalChange(item.documentId, val)}
          style={[styles.goalInput, { borderColor: Colors.neutral700, color: Colors.gold500 }]}
          value={String(goals[item.documentId] || 0)}
        />
        <TouchableOpacity
          onPress={() => handleGoalChange(item.documentId, (goals[item.documentId] || 0) + 1)}
          style={styles.counterButton}
        >
          <Text style={styles.counterText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const currentTotal = getCurrentTotal();
  const isValid = currentTotal === totalGoals;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>
              ⚽ Buteurs -
              {' '}
              {teamName}
            </Text>
          </View>

          {/* Score Summary */}
          <View style={[styles.scoreSummary, {
            backgroundColor: isValid ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 193, 7, 0.1)',
            borderColor: isValid ? '#4CAF50' : '#FFC107',
          }]}
          >
            <Text style={{ color: Colors.gold500, fontWeight: 'bold' }}>
              {currentTotal}
              {' '}
              /
              {totalGoals}
              {' '}
              buts attribués
            </Text>
          </View>

          {/* Players List */}
          <FlatList
            data={players}
            keyExtractor={(item) => item.documentId || item.id?.toString()}
            ListEmptyComponent={(
              <Text style={{ color: Colors.neutral500, padding: 20, textAlign: 'center' }}>
                Aucun joueur disponible
              </Text>
                          )}
            renderItem={renderPlayer}
            style={styles.list}
          />

          {/* Submit Button */}
          <Button
            disabled={!isValid || isSubmitting}
            label={isSubmitting ? 'Enregistrement...' : 'Valider les buteurs'}
            onPress={handleSubmit}
            style={{
              backgroundColor: isValid ? Colors.primary500 : Colors.neutral700,
              marginTop: 16,
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 20,
  },
  counterButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  counterText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  goalInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: 'bold',
    height: 40,
    textAlign: 'center',
    width: 50,
  },
  goalInputWrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  list: {
    maxHeight: 400,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  playerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  playerRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  scoreSummary: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
});

export default PlayerGoalsModal;
