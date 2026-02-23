import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * Modal to invite a trainer after creation
 * @param {object} props
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {Function} props.onClose - Function to call when closing the modal (e.g. navigation.goBack)
 * @param {Function} props.onInvite - Function to call when clicking on "Invite"
 * @param {string} props.trainerName - Name of the trainer
 */
function TrainerInvitedModal({
  isVisible,
  onClose,
  onInvite,
  trainerName,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const handleInvite = useCallback(() => {
    onInvite();
  }, [onInvite]);

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={[Spaces.gap[16], { paddingBottom: 20 }]}>
          <Button
            onPress={handleInvite}
            title={t('addCoach.actions.invite')}
            variant="Primary"
          />
          <Button
            onPress={onClose}
            title={t('actions.later')}
            variant="Secondary"
          />
        </View>
      )}
      headerComponent={( // Removed headerComponent to have custom layout inside children for better control
        null
      )}
      hideCloseButton
      isVisible={isVisible}
    >
      <View style={[Spaces.gap[24], Alignments.alignCenter, { paddingVertical: 20 }]}>
        <Text style={[Fonts.h2, { color: Colors.primary500, textAlign: 'center' }]}>
          {t('addCoach.alerts.success.title')}
        </Text>
        <Text style={[Fonts.p1, { textAlign: 'center' }]}>
          {t('addCoach.alerts.success.description', { trainerName })}
        </Text>
      </View>
    </BottomModal>
  );
}

export default TrainerInvitedModal;
