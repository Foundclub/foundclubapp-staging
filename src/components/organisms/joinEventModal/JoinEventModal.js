import { useCallback, useEffect, useState } from 'react';
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
 * @param {((acceptance: { acceptConditions: boolean, acceptResponsibility: boolean, acceptRiskDeclaration: boolean }) => Promise<void> | void)} props.onConfirm - Confirm handler controlled by the parent
 * @param {boolean} [props.isSubmitting] - Optional loading state for custom confirm handler
 * @param {string} [props.confirmLabel]
 * @param {string} [props.contextNote] - Optional contextual note shown above the base declaration
 * @param {string} props.clubName - Name of the club
 * @param {string} [props.description]
 * @param {string | null} [props.errorMessage]
 * @param {string} [props.title]
 * @returns {import('react').ReactElement} JoinEventModal component
 */
function JoinEventModal({
  clubName,
  confirmLabel,
  contextNote,
  description,
  errorMessage = null,
  isSubmitting = false,
  isVisible,
  onClose,
  onConfirm,
  title,
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
  const checkableWrapperStyle = [
    ApplicationStyle.borderWidth0,
    ApplicationStyle.backgroundColor.transparent,
    Spaces.padding[0],
    Alignments.rowReverse,
    { flex: 0, width: '100%' },
  ];

  const handleClose = useCallback(() => {
    onClose();
    setAcceptResponsibility(false);
    setAcceptConditions(false);
  }, [onClose]);

  useEffect(() => {
    if (!isVisible) {
      setAcceptResponsibility(false);
      setAcceptConditions(false);
    }
  }, [isVisible]);

  const handleConfirmParticipation = useCallback(async () => {
    if (!acceptResponsibility || !acceptConditions || !userData?.documentId) return;
    await Promise.resolve(onConfirm?.({
      acceptConditions,
      acceptResponsibility,
      acceptRiskDeclaration: acceptResponsibility && acceptConditions,
    }));
  }, [
    acceptConditions,
    acceptResponsibility,
    userData,
    onConfirm,
  ]);

  return (
    <BottomModal
      close={handleClose}
      footerComponent={(
        <View style={[Spaces.gap[16]]}>
          <Button
            disabled={!acceptResponsibility || !acceptConditions}
            isLoading={isSubmitting}
            onPress={handleConfirmParticipation}
            title={confirmLabel || t('eventList.joinModal.actions.confirm')}
            variant="Primary"
          />
          <Button
            onPress={handleClose}
            title={t('eventList.joinModal.actions.cancel')}
            variant="Secondary"
          />
        </View>
      )}
      headerComponent={(
        <Text style={[Fonts.p1Black, Fonts.neutral00, { textAlign: 'center' }]}>
          {title || t('eventList.joinModal.title')}
        </Text>
      )}
      hideCloseButton
      isVisible={isVisible}
      snapPoints={['90%']}
    >
      <View style={[Spaces.gap[32]]}>
        {contextNote ? (
          <View
            style={[
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              {
                borderColor: 'rgba(1, 179, 244, 0.24)',
              },
            ]}
          >
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {contextNote}
            </Text>
          </View>
        ) : null}

        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {description || t('eventList.joinModal.description', { clubName })}
        </Text>

        {errorMessage ? (
          <View
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              {
                backgroundColor: 'rgba(176, 43, 59, 0.18)',
                borderColor: 'rgba(255, 107, 129, 0.35)',
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: '#FFB5C0' }]}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View style={[Spaces.gap[16]]}>
          <Checkable
            fontStyle={[Fonts.p2, Fonts.neutral00]}
            isChecked={acceptResponsibility}
            setIsChecked={() => setAcceptResponsibility((previous) => !previous)}
            text={t('eventList.joinModal.checkboxes.responsibility')}
            type="square"
            wrapperStyle={checkableWrapperStyle}
          />
          <Checkable
            fontStyle={[Fonts.p2, Fonts.neutral00]}
            isChecked={acceptConditions}
            setIsChecked={() => setAcceptConditions((previous) => !previous)}
            text={t('eventList.joinModal.checkboxes.conditions')}
            type="square"
            wrapperStyle={checkableWrapperStyle}
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
