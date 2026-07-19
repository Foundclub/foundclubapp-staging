import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * ReservationModeModal component - modal for choosing participation mode
 * @param {object} props
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {object} props.reservation - The reservation object
 * @param {Function} props.onClose - Function called when modal is closed
 * @param {Function} props.onConfirm - Function called when user confirms (mode, playerCount)
 * @returns {import('react').ReactElement}
 */
function ReservationModeModal({
  isVisible,
  onClose,
  onConfirm,
  reservation,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const [selectedMode, setSelectedMode] = useState(null);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!selectedMode) {
      setError('Merci de sélectionner un mode');
      return;
    }

    const playerCount = selectedMode === 'FULL_GROUP'
      ? (reservation?.totalPlayers || 10)
      : 1;

    onConfirm(selectedMode, playerCount);

    // Reset state
    setSelectedMode(null);
    setError('');
  };

  const handleClose = () => {
    setSelectedMode(null);
    setError('');
    onClose();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={isVisible}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: '#173844',
            borderRadius: 24,
            gap: 24,
            padding: 32,
            width: '85%',
          }}
        >
          <Text style={{
            color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center',
          }}
          >
            Comment souhaites-te participer ?
          </Text>

          {/* Option FULL_GROUP */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMode('FULL_GROUP');
              setError('');
            }}
            style={{
              borderColor: selectedMode === 'FULL_GROUP' ? '#00D1FF' : '#555',
              borderRadius: 16,
              borderWidth: 2,
              padding: 16,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              Je viens avec mon groupe complet
            </Text>
            <Text style={{ color: '#aaa', fontSize: 14, marginTop: 4 }}>
              Tous les joueurs sont déjà trouvés
            </Text>
          </TouchableOpacity>

          {/* Option RECRUITING */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMode('RECRUITING');
              setError('');
            }}
            style={{
              borderColor: selectedMode === 'RECRUITING' ? '#00D1FF' : '#555',
              borderRadius: 16,
              borderWidth: 2,
              padding: 16,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              Je cherche des joueurs
            </Text>
            <Text style={{ color: '#aaa', fontSize: 14, marginTop: 4 }}>
              D'autres joueurs peuvent rejoindre
            </Text>
          </TouchableOpacity>

          {/* Message d'erreur */}
          {error ? (
            <Text style={{ color: '#ff4444', fontSize: 14, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          {/* Boutons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                alignItems: 'center',
                backgroundColor: 'transparent',
                borderColor: '#00D1FF',
                borderRadius: 12,
                borderWidth: 1,
                flex: 1,
                padding: 16,
              }}
            >
              <Text style={{ color: '#00D1FF', fontWeight: 'bold' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!selectedMode}
              onPress={handleConfirm}
              style={{
                alignItems: 'center',
                backgroundColor: selectedMode ? '#00D1FF' : '#555',
                borderRadius: 12,
                flex: 1,
                padding: 16,
              }}
            >
              <Text style={{ color: '#000', fontWeight: 'bold' }}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ReservationModeModal;
