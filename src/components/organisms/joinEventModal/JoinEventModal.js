import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useCreateEventParticipation } from '@/services/eventParticipation/eventParticipationQueries';

/**
 * Modal for joining an event
 * @param {object} props
 * @param {string} props.eventId - ID of the event to join
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {() => void} props.onClose - Function to call when closing the modal
 * @param {() => void} props.onSuccess - Function to call when successfully joining
 * @returns {import('react').ReactElement} JoinEventModal component
 */
function JoinEventModal({
  eventId,
  isVisible,
  onClose,
  onSuccess,
}) {
  const [acceptResponsibility, setAcceptResponsibility] = useState(false);
  const [acceptConditions, setAcceptConditions] = useState(false);

  const createEventParticipation = useCreateEventParticipation();
  const { userData } = useAuth();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  const handleConfirmParticipation = useCallback(() => {
    if (eventId && acceptResponsibility && acceptConditions && userData?.documentId) {
      createEventParticipation.mutate({
        event: eventId,
        user: userData.documentId,
      }, {
        onSuccess: () => {
          onClose();
          onSuccess();
        },
      });
    }
  }, [
    eventId,
    acceptResponsibility,
    acceptConditions,
    userData,
    createEventParticipation,
    onClose,
    onSuccess,
  ]);

  const handleClose = useCallback(() => {
    onClose();
    setAcceptResponsibility(false);
    setAcceptConditions(false);
  }, [onClose]);

  return (
    <BottomModal
      close={handleClose}
      isVisible={isVisible}
    >
      <ScrollView contentContainerStyle={[Spaces.gap[32], Spaces.padding[24]]}>
        <Text style={[Fonts.p1Black, Fonts.neutral00]}>
          {t('eventList.joinModal.title')}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {t('eventList.joinModal.description')}
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
        </View>
      </ScrollView>

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
    </BottomModal>
  );
}

export default JoinEventModal;
