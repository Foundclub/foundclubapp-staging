import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
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
 * @param {(string|number)[]} [props.snapPoints]
 * @param {import('react-native').ViewStyle} [props.style]
 * @param {'sheet' | 'dialog'} [props.webPresentation]
 * @returns {import('react').ReactElement | null}
 */
function BottomModal({
  children,
  close,
  closeOnBackdropPress = true,
  contentContainerStyle,
  footerComponent,
  headerComponent,
  hideCloseButton = true,
  isVisible,
  scrollable = true,
  snapPoints,
  style,
  webPresentation = 'sheet',
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  const isDialog = webPresentation === 'dialog';
  const firstSnapPoint = Array.isArray(snapPoints) && snapPoints.length > 0 ? snapPoints[0] : undefined;
  const sheetSizeStyle = isDialog
    ? {
      maxHeight: 'calc(100vh - 48px)',
      maxWidth: 680,
      minHeight: 0,
      width: 'calc(100vw - 32px)',
    }
    : firstSnapPoint !== undefined
      ? {
        height: typeof firstSnapPoint === 'number' ? firstSnapPoint : firstSnapPoint,
        maxHeight: '92%',
      }
      : {
        maxHeight: '86%',
        minHeight: 220,
      };

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[
        Spaces.paddingHorizontal[24],
        Spaces.paddingTop[16],
        Spaces.paddingBottom[24],
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      style={[Alignments.fill, { maxHeight: isDialog ? 520 : 420 }]}
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

  const modalContent = (
    <View
      style={[
        isDialog ? Alignments.justifyCenter : Alignments.justifyEnd,
        isDialog ? Alignments.alignCenter : null,
        {
          bottom: 0,
          left: 0,
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 1100,
        },
      ]}
    >
      <Pressable
        onPress={closeOnBackdropPress ? close : undefined}
        style={[
          Alignments.absolute,
          Alignments.fullSize,
          {
            backgroundColor: withAlpha(Colors.primary900, 0.72),
          },
        ]}
      />
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius32,
          {
            borderBottomLeftRadius: isDialog ? 32 : 0,
            borderBottomRightRadius: isDialog ? 32 : 0,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            boxShadow: `0 28px 60px ${withAlpha(Colors.primary900, 0.45)}`,
            overflow: 'hidden',
            paddingTop: hideCloseButton ? (isDialog ? 24 : 20) : 28,
            width: isDialog ? undefined : '100%',
          },
          sheetSizeStyle,
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
              Spaces.paddingBottom[24],
              {
                backgroundColor: Colors.primary700,
                borderTopColor: withAlpha(Colors.neutral00, 0.1),
                borderTopWidth: 1,
              },
            ]}
          >
            {footerComponent}
          </View>
        ) : null}
        {!hideCloseButton ? (
          <TouchableOpacity
            accessibilityLabel={t('common.close')}
            accessibilityRole="button"
            hitSlop={ApplicationStyle.hitSlop.min44From28}
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
                  backgroundColor: withAlpha(Colors.neutral00, 0.08),
                  borderRadius: 14,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>x</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

export default BottomModal;
