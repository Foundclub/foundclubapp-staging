import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * @param {{
 *  visible: boolean;
 *  title: string;
 *  subtitle?: string;
 *  onEdit: () => void;
 *  onCopyId: () => void;
 *  onDelete: () => void;
 *  onClose: () => void;
 *  labels: {
 *    edit: string;
 *    copyId: string;
 *    remove: string;
 *    close: string;
 *  };
 * }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEntryActionsSheet({
  labels,
  onClose,
  onCopyId,
  onDelete,
  onEdit,
  subtitle = '',
  title,
  visible,
}) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <BottomModal
      close={onClose}
      isVisible={visible}
      scrollable={false}
      snapPoints={['46%']}
    >
      <Text numberOfLines={1} style={[Fonts.h3, Fonts.neutral00]}>
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[6]]}>
          {subtitle}
        </Text>
      ) : null}

      <View style={[Spaces.gap[10], Spaces.marginTop[14]]}>
        <Button onPress={onEdit} title={labels.edit} variant="Secondary" />
        <Button onPress={onCopyId} title={labels.copyId} variant="SecondaryLight" />
        <TouchableOpacity
          onPress={onDelete}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingVertical[12],
            {
              alignItems: 'center',
              backgroundColor: 'rgba(255, 40, 79, 0.14)',
              borderColor: Colors.error500,
              borderWidth: 1,
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.error500 }]}>{labels.remove}</Text>
        </TouchableOpacity>
        <Button onPress={onClose} title={labels.close} variant="Secondary" />
      </View>
    </BottomModal>
  );
}

export default SuperAdminEntryActionsSheet;
