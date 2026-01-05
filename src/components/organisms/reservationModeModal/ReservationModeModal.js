import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  reservation,
  onClose,
  onConfirm,
}) {
  const { t } = useTranslation();
  const { Alignments, ApplicationStyle, Colors, Fonts, Spaces } = useTheme();

  const [selectedMode, setSelectedMode] = useState(null);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!selectedMode) {
      setError('Veuillez sélectionner un mode');
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
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
      >
        <View
          style={{
            backgroundColor: '#173844',
            borderRadius: 24,
            padding: 32,
            gap: 24,
            width: '85%',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' }}>
            Comment souhaitez-vous participer ?
          </Text>

          {/* Option FULL_GROUP */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMode('FULL_GROUP');
              setError('');
            }}
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: selectedMode === 'FULL_GROUP' ? '#00D1FF' : '#555',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
              Je viens avec mon groupe complet
            </Text>
            <Text style={{ fontSize: 14, color: '#aaa', marginTop: 4 }}>
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
              padding: 16,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: selectedMode === 'RECRUITING' ? '#00D1FF' : '#555',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
              Je cherche des joueurs
            </Text>
            <Text style={{ fontSize: 14, color: '#aaa', marginTop: 4 }}>
              D'autres joueurs peuvent rejoindre
            </Text>
          </TouchableOpacity>

          {/* Message d'erreur */}
          {error ? (
            <Text style={{ fontSize: 14, color: '#ff4444', textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          {/* Boutons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 12,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: '#00D1FF',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#00D1FF', fontWeight: 'bold' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!selectedMode}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 12,
                backgroundColor: selectedMode ? '#00D1FF' : '#555',
                alignItems: 'center',
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
