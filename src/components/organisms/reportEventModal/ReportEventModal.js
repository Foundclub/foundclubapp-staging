import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard, Text, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

/**
 * @typedef {object} ReportEventModalProps
 * @property {boolean} isVisible - Whether the modal is visible.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {(reason: string) => void} onSubmit - Function to call when the report is submitted.
 * @property {boolean} [isLoading] - Whether the submission is in progress.
 */

/**
 * Modal for reporting an event.
 * @param {ReportEventModalProps} props - The props.
 * @returns {import('react').ReactElement}
 */
function ReportEventModal({
  isLoading, isVisible, onClose, onSubmit,
}) {
  const [reason, setReason] = useState('');
  const { t } = useTranslation();
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const inputRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      // @ts-ignore: Assuming .focus() exists
      inputRef.current.focus();
    }
  }, [isVisible, inputRef]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleSubmit = () => {
    onSubmit(reason);
  };

  const handleClose = () => {
    setReason(''); // Reset reason when closing
    onClose();
  };

  return (
    <BottomModal
      close={handleClose}
      isVisible={isVisible}
    >
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[24],
          { paddingBottom: keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        style={[Alignments.fullHeight]}
      >
        <View style={[Spaces.gap[8], Spaces.marginBottom[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.modals.reportEvent.title')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('eventDetails.modals.reportEvent.description')}
          </Text>
        </View>
        <Input
          label={t('eventDetails.modals.reportEvent.fields.reason.label')}
          maxLength={500}
          multiline
          numberOfLines={4}
          onChangeText={setReason}
          placeholder={t('eventDetails.modals.reportEvent.fields.reason.placeholder')}
          ref={inputRef}
          textAlignVertical="top"
        />
        <View style={[
          Alignments.row, Spaces.gap[16], Alignments.fullWidth, Spaces.marginTop[24]]}
        >
          <Button
            disabled={isLoading}
            onPress={handleClose}
            style={Alignments.fill}
            title={t('eventDetails.modals.actions.cancel')}
            variant="SecondaryLight"
          />
          <Button
            disabled={!reason.trim() || isLoading}
            isLoading={isLoading}
            onPress={handleSubmit}
            style={Alignments.fill}
            title={t('eventDetails.modals.actions.report')}
            variant="Primary"
          />
        </View>
      </ScrollView>
    </BottomModal>
  );
}

export default ReportEventModal;
