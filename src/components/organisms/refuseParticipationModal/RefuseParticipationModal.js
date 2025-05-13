import {
  useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard, Text, View, // Removed TextInput import
} from 'react-native'; // Removed Modal and Platform import
import { ScrollView } from 'react-native-gesture-handler';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal'; // Added BottomModal import
import Input from '@/components/molecules/input/Input';

/**
 * Modal for refusing a participation request with a reason
 * @param {object} props
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {() => void} props.onClose - Function to call when closing the modal
 * @param {(reason: string) => void} props.onSubmit - Function to call when submitting the reason
 * @returns {import('react').ReactElement} RefuseParticipationModal component
 */
function RefuseParticipationModal({
  isVisible,
  onClose,
  onSubmit,
}) {
  const { t } = useTranslation();
  const {
    Alignments,
    Fonts,
    Spaces,
  } = useTheme();
  const [reason, setReason] = useState('');
  const inputRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      // @ts-ignore: Assuming .focus() exists, to bypass potential type issues with simplified ref
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
    setReason('');
    onClose();
  };

  return (
    <BottomModal
      close={onClose}
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
        <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
          {t('eventDetails.modals.refuse.title')}
        </Text>
        <Input
          label={t('eventDetails.modals.refuse.fields.reason.label')}
          multiline
          numberOfLines={4}
          onChangeText={setReason}
          placeholder={t('eventDetails.modals.refuse.fields.reason.placeholder')}
          ref={inputRef}
          textAlignVertical="top"
          value={reason}
        />
        <View style={[
          Alignments.row, Spaces.gap[16], Alignments.fullWidth, Spaces.marginTop[24]]}
        >
          <Button
            onPress={onClose}
            style={Alignments.fill}
            title={t('eventDetails.modals.actions.cancel')}
            variant="SecondaryLight"
          />
          <Button
            disabled={!reason.trim()}
            onPress={handleSubmit}
            style={Alignments.fill}
            title={t('eventDetails.modals.actions.confirm')}
            variant="Primary"
          />
        </View>
      </ScrollView>
    </BottomModal>
  );
}

export default RefuseParticipationModal;
