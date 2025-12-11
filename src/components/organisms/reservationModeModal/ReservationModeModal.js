import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

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
  const [playerCount, setPlayerCount] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!selectedMode) {
      setError(t('reservation.mode.selectMode', 'Veuillez sélectionner un mode'));
      return;
    }

    if (selectedMode === 'RECRUITING') {
      const count = parseInt(playerCount, 10);
      if (!playerCount || Number.isNaN(count) || count <= 0) {
        setError(t('reservation.mode.invalidPlayerCount', 'Veuillez entrer un nombre valide'));
        return;
      }
      if (count >= reservation?.totalPlayers) {
        setError(t('reservation.mode.tooManyPlayers', 'Le nombre doit être inférieur au total'));
        return;
      }
      onConfirm(selectedMode, count);
    } else {
      onConfirm(selectedMode, reservation?.totalPlayers);
    }

    // Reset state
    setSelectedMode(null);
    setPlayerCount('');
    setError('');
  };

  const handleClose = () => {
    setSelectedMode(null);
    setPlayerCount('');
    setError('');
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={isVisible}
    >
      <View
        style={[
          Alignments.fill,
          Alignments.alignCenter,
          Alignments.justifyCenter,
          { backgroundColor: 'rgba(0,0,0,0.7)' },
        ]}
      >
        <View
          style={[
            ApplicationStyle.backgroundColor.primary900,
            ApplicationStyle.borderRadius24,
            Spaces.padding[32],
            Spaces.gap[24],
            { width: '85%' },
          ]}
        >
          <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
            {t('reservation.mode.title')}
          </Text>

          {/* Option FULL_GROUP */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMode('FULL_GROUP');
              setError('');
            }}
            style={[
              Spaces.padding[16],
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth2,
              selectedMode === 'FULL_GROUP'
                ? ApplicationStyle.borderColor.primary500
                : ApplicationStyle.borderColor.neutral700,
            ]}
          >
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('reservation.mode.fullGroup')}
            </Text>
          </TouchableOpacity>

          {/* Option RECRUITING */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMode('RECRUITING');
              setError('');
            }}
            style={[
              Spaces.padding[16],
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth2,
              selectedMode === 'RECRUITING'
                ? ApplicationStyle.borderColor.primary500
                : ApplicationStyle.borderColor.neutral700,
            ]}
          >
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('reservation.mode.recruiting')}
            </Text>
          </TouchableOpacity>

          {/* Input nombre de joueurs si RECRUITING */}
          {selectedMode === 'RECRUITING' && (
            <Input
              keyboardType="number-pad"
              label={t('reservation.mode.playerCount')}
              onChangeText={(text) => {
                setPlayerCount(text);
                setError('');
              }}
              placeholder="Ex: 8"
              value={playerCount}
            />
          )}

          {/* Message d'erreur */}
          {error ? (
            <Text style={[Fonts.p2, Fonts.error500, Fonts.textCenter]}>
              {error}
            </Text>
          ) : null}

          {/* Boutons */}
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <Button
              onPress={handleClose}
              style={[Alignments.fill]}
              title={t('common.actions.cancel')}
              variant="SecondaryLight"
            />
            <Button
              isDisabled={!selectedMode}
              onPress={handleConfirm}
              style={[Alignments.fill]}
              title={t('common.actions.confirm')}
              variant="Primary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ReservationModeModal;



