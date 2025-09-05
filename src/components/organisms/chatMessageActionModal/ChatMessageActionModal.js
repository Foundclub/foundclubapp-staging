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
 * Modal for displaying a message action.
 * @param {object} props - The props.
 * @param {boolean} props.isVisible - Whether the modal is visible.
 * @param {() => void} props.onClose - Function to call when the modal is closed.
 * @param {(reason: string) => void} props.onSubmit - Function to call when the report is submitted.
 * @param {boolean} [props.isLoading] - Whether the submission is in progress.
 * @returns {import('react').ReactElement}
 */
function ChatMessageActionModal({
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
            {t('conversation.modals.reportMessage.title')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('conversation.modals.reportMessage.description')}
          </Text>
        </View>
        <Input
          label={t('conversation.modals.reportMessage.fields.reason.label')}
          maxLength={500}
          multiline
          numberOfLines={4}
          onChangeText={setReason}
          placeholder={t('conversation.modals.reportMessage.fields.reason.placeholder')}
          ref={inputRef}
          textAlignVertical="top"
          value={reason}
        />
        <View style={[
          Alignments.row, Spaces.gap[16], Alignments.fullWidth, Spaces.marginTop[24]]}
        >
          <Button
            disabled={isLoading}
            onPress={handleClose}
            style={Alignments.fill}
            title={t('conversation.modals.actions.cancel')}
            variant="SecondaryLight"
          />
          <Button
            disabled={!reason.trim() || isLoading}
            isLoading={isLoading}
            onPress={handleSubmit}
            style={Alignments.fill}
            title={t('conversation.modals.actions.report')}
            variant="Primary"
          />
        </View>
      </ScrollView>
    </BottomModal>
  );
}

export default ChatMessageActionModal;
