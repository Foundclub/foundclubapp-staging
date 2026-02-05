import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * Modal for joining an event
 * @param {object} props
 * @param {string} props.eventId - ID of the event to join
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {() => void} props.onClose - Function to call when closing the modal
 * @param {import('@tanstack/react-query').UseMutationResult<EventParticipation,
 * Error, {user: string, event: string, reason?: string},
 * unknown>} props.createEventParticipationMutation - Mutation for creating event participation
 * @param {string} props.clubName - Name of the club
 * @returns {import('react').ReactElement} JoinEventModal component
 */
function JoinEventModal({
  clubName,
  createEventParticipationMutation,
  eventId,
  isVisible,
  onClose,
}) {
  const [acceptResponsibility, setAcceptResponsibility] = useState(false);
  const [acceptConditions, setAcceptConditions] = useState(false);

  const { userData } = useAuth();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  const handleClose = useCallback(() => {
    onClose();
    setAcceptResponsibility(false);
    setAcceptConditions(false);
  }, [onClose]);

  const handleConfirmParticipation = useCallback(() => {
    if (eventId && acceptResponsibility && acceptConditions && userData?.documentId) {
      createEventParticipationMutation.mutate({
        event: eventId,
        user: userData.documentId,
      });
      handleClose(); // Force close on confirm
    }
  }, [eventId, acceptResponsibility, acceptConditions, userData, createEventParticipationMutation, handleClose]);

  return (
    <BottomModal
      close={handleClose}
      hideCloseButton
      isVisible={isVisible}
      snapPoints={['90%']}
      headerComponent={(
        <Text style={[Fonts.p1Black, Fonts.neutral00, { textAlign: 'center' }]}>
          {t('eventList.joinModal.title')}
        </Text>
      )}
      footerComponent={(
        <View style={[Spaces.gap[16]]}>
          <Button
            disabled={!acceptResponsibility || !acceptConditions}
            onPress={handleConfirmParticipation}
            title={t('eventList.joinModal.actions.confirm')}
            variant="Primary"
          />
          <Button
            onPress={handleClose}
            title={t('eventList.joinModal.actions.cancel')}
            variant="Secondary"
          />
        </View>
      )}
    >
      <View style={[Spaces.gap[32]]}>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {t('eventList.joinModal.description', { clubName })}
        </Text>

        <View style={[Spaces.gap[16]]}>
          <Checkable
            fontStyle={[Fonts.p2, Fonts.neutral00]}
            isChecked={acceptResponsibility}
            setIsChecked={() => setAcceptResponsibility(!acceptResponsibility)}
            text={t('eventList.joinModal.checkboxes.responsibility')}
            type="square"
            wrapperStyle={[
              ApplicationStyle.borderWidth0,
              ApplicationStyle.backgroundColor.transparent,
              Spaces.padding[0],
              Alignments.rowReverse,
            ]}
          />
          <Checkable
            fontStyle={[Fonts.p2, Fonts.neutral00]}
            isChecked={acceptConditions}
            setIsChecked={() => setAcceptConditions(!acceptConditions)}
            text={t('eventList.joinModal.checkboxes.conditions')}
            type="square"
            wrapperStyle={[
              ApplicationStyle.borderWidth0,
              ApplicationStyle.backgroundColor.transparent,
              Spaces.padding[0],
              Alignments.rowReverse,
            ]}
          />
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {t('eventList.joinModal.validation')}
          </Text>
        </View>
      </View>
    </BottomModal>
  );
}

export default JoinEventModal;
