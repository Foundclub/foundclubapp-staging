import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Web replacement for the mobile bottom sheet.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {() => void} props.close
 * @param {import('react-native').ViewStyle} [props.contentContainerStyle]
 * @param {React.ReactNode} [props.headerComponent]
 * @param {React.ReactNode} [props.footerComponent]
 * @param {boolean} [props.hideCloseButton]
 * @param {boolean} props.isVisible
 * @param {boolean} [props.scrollable]
 * @param {boolean} [props.closeOnBackdropPress]
 * @param {import('react-native').ViewStyle} [props.style]
 * @returns {import('react').ReactElement | null}
 */
function BottomModal({
  children,
  close,
  closeOnBackdropPress = true,
  contentContainerStyle,
  footerComponent,
  headerComponent,
  hideCloseButton = false,
  isVisible,
  scrollable = true,
  style,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  if (!isVisible) {
    return null;
  }

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[
        Spaces.paddingHorizontal[24],
        Spaces.paddingTop[16],
        Spaces.paddingBottom[24],
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      style={[Alignments.fill, { maxHeight: 420 }]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        Spaces.paddingHorizontal[24],
        Spaces.paddingTop[16],
        Spaces.paddingBottom[24],
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={isVisible}
    >
      <View
        style={[
          Alignments.fill,
          Alignments.justifyEnd,
          {
            backgroundColor: 'rgba(7, 12, 20, 0.72)',
          },
        ]}
      >
        <Pressable
          onPress={closeOnBackdropPress ? close : undefined}
          style={[Alignments.absolute, Alignments.fullSize]}
        />
        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius32,
            {
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              maxHeight: '86%',
              minHeight: 220,
              overflow: 'hidden',
              paddingTop: hideCloseButton ? 20 : 28,
            },
            style,
          ]}
        >
          {headerComponent ? (
            <View style={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[12]]}>
              {headerComponent}
            </View>
          ) : null}
          {content}
          {footerComponent ? (
            <View
              style={[
                Spaces.paddingHorizontal[24],
                Spaces.paddingTop[16],
                Spaces.paddingBottom[20],
                {
                  backgroundColor: Colors.primary700,
                  borderTopColor: 'rgba(255,255,255,0.1)',
                  borderTopWidth: 1,
                },
              ]}
            >
              {footerComponent}
            </View>
          ) : null}
          {!hideCloseButton ? (
            <TouchableOpacity
              onPress={close}
              style={[
                Alignments.absolute,
                {
                  height: 28,
                  right: 20,
                  top: 20,
                  width: 28,
                },
              ]}
            >
              <View
                style={[
                  Alignments.fill,
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 14,
                  },
                ]}
              >
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>×</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default BottomModal;
