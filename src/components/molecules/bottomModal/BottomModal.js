import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BlurView } from '@react-native-community/blur';
import {
  useCallback, useEffect, useRef,
} from 'react';
import {
  Dimensions,
  Image,
  Platform,
  TouchableOpacity,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Bottom modal component using @gorhom/bottom-sheet.
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content to render inside the modal
 * @param {() => void} props.close - Function to close the modal
 * @param {import('@/theme/types').ColorNames} [props.closeIconTintColor]
 * @param {import('react-native').ViewStyle} [props.contentContainerStyle]
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {import('react-native').ViewStyle} [props.style] - Additional styles for modal
 * @returns {import('react').ReactElement} Modal component
 */
function BottomModal({
  children,
  close,
  closeIconTintColor = 'primary200',
  contentContainerStyle,
  isVisible,
  style,
}) {
  /**
   * @type {React.MutableRefObject<import('@gorhom/bottom-sheet').BottomSheetModal | null>}
   */
  const modalRef = useRef(null);
  const {
    Alignments, ApplicationStyle, Colors, Images, Spaces,
  } = useTheme();

  useEffect(() => {
    if (isVisible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [isVisible, modalRef.current?.present]);

  // renders
  const renderBackdrop = useCallback(
    /**
     * Render backdrop component.
     * @param {import('@gorhom/bottom-sheet').BottomSheetBackdropProps} backDropProps
     * @returns {React.ReactElement} The rendered backdrop component.
     */
    (
      backDropProps,
    ) => (
      <BottomSheetBackdrop
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...backDropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        onPress={close}
        opacity={0.5}
        pressBehavior="close"
        style={[backDropProps.style, {
          backgroundColor: Colors.neutral800,
        }]}
      >
        {Platform.OS === 'ios' && (
          <BlurView
            blurAmount={15}
            blurType="dark"
            reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.5)"
            style={Alignments.fill}
          />
        )}
      </BottomSheetBackdrop>
    ),
    [close, Colors, Alignments.fill],
  );

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        ApplicationStyle.borderRadius32,
        ApplicationStyle.backgroundColor.primary700,
        style]}
      enableContentPanningGesture={Platform.OS === 'ios'}
      enableDynamicSizing
      enablePanDownToClose
      handleComponent={null}
      index={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={close}
      ref={modalRef}
    >
      <TouchableOpacity
        onPress={close}
        style={[
          Alignments.absolute,
          Platform.OS === 'ios'
            ? Spaces.marginHorizontal[24] : Spaces.marginHorizontal[4],
          { right: Platform.OS === 'ios' ? 0 : 24, top: 24, zIndex: 1 },
        ]}
      >
        <Image
          source={Images.close}
          style={[
            ApplicationStyle.icon28,
            { tintColor: Colors[closeIconTintColor] },
          ]}
        />
      </TouchableOpacity>
      <BottomSheetView
        style={[
          Spaces.paddingHorizontal[24],
          Spaces.paddingVertical[40],
          { maxHeight: Dimensions.get('screen').height * 0.7 },
          contentContainerStyle,
        ]}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

export default BottomModal;
