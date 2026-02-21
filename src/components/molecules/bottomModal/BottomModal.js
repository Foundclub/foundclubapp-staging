import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetView,
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

/**
 * Bottom modal component using @gorhom/bottom-sheet.
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content to render inside the modal
 * @param {() => void} props.close - Function to close the modal
 * @param {import('@/theme/types').ColorNames} [props.closeIconTintColor]
 * @param {import('react-native').ViewStyle} [props.contentContainerStyle]
 * @param {React.ReactNode} [props.headerComponent] - Fixed header component
 * @param {React.ReactNode} [props.footerComponent] - Fixed footer component
 * @param {boolean} [props.hideCloseButton] - Whether to hide the close button
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {boolean} [props.scrollable] - Whether the content should be scrollable (default: true)
 * @param {'adjustResize' | 'adjustPan' | 'stateUnchanged'} [props.androidKeyboardInputMode]
 * @param {'interactive' | 'extend' | 'fillParent'} [props.keyboardBehavior]
 * @param {React.MutableRefObject<any>} [props.scrollViewRef] - Optional ref forwarded to BottomSheetScrollView
 * @param {object} [props.scrollViewProps] - Optional extra props forwarded to BottomSheetScrollView
 * @param {(string|number)[]} [props.snapPoints] - Array of snap points for the modal
 * @param {import('react-native').ViewStyle} [props.style] - Additional styles for modal
 * @returns {import('react').ReactElement} Modal component
 */
function BottomModal({
  androidKeyboardInputMode = 'adjustResize',
  children,
  close,
  closeIconTintColor = 'primary200',
  contentContainerStyle,
  headerComponent,
  footerComponent,
  hideCloseButton = false,
  isVisible,
  keyboardBehavior = 'interactive',
  scrollable = true,
  scrollViewProps,
  scrollViewRef,
  style,
  snapPoints,
}) {
  /**
   * @type {React.MutableRefObject<import('@gorhom/bottom-sheet').BottomSheetModal | null>}
   */
  const modalRef = useRef(null);
  const visibilityRef = useRef(false);
  const insets = useSafeAreaInsets();
  const {
    Alignments, ApplicationStyle, Colors, Images, Spaces,
  } = useTheme();

  useEffect(() => {
    if (!modalRef.current) return;
    if (visibilityRef.current === isVisible) return;
    visibilityRef.current = isVisible;

    if (isVisible) {
      modalRef.current.present();
      return;
    }

    modalRef.current.dismiss();
  }, [isVisible]);

  useEffect(() => () => {
    visibilityRef.current = false;
    modalRef.current?.dismiss();
  }, []);

  const handleDismiss = useCallback(() => {
    if (!visibilityRef.current) return;
    visibilityRef.current = false;
    close?.();
  }, [close]);

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
      android_keyboardInputMode={androidKeyboardInputMode}
      backgroundStyle={[
        ApplicationStyle.borderRadius32,
        ApplicationStyle.backgroundColor.primary700,
        style]}
      enableContentPanningGesture={Platform.OS === 'ios'}
      enableDynamicSizing={!snapPoints}
      snapPoints={snapPoints}
      enablePanDownToClose
      handleComponent={null}
      index={0}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
      ref={modalRef}
      topInset={insets.top + 20}
    >
      {!hideCloseButton && (
        <TouchableOpacity
          onPress={close}
          style={[
            Alignments.absolute,
            Platform.OS === 'ios'
              ? Spaces.marginHorizontal[24] : Spaces.marginHorizontal[4],
            { right: Platform.OS === 'ios' ? 0 : 24, top: 24, zIndex: 10 },
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
      )}
      <View style={[snapPoints ? Alignments.fill : undefined]}>
        {/* Fixed Header */}
        {headerComponent && (
          <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[24], Spaces.paddingBottom[16], { zIndex: 1 }]}>
            {headerComponent}
          </View>
        )}

        {/* Content */}
        {scrollable ? (
          <BottomSheetScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              Spaces.paddingHorizontal[24],
              // If there's no footer, add some bottom padding for scroll
              footerComponent ? Spaces.paddingBottom[16] : Spaces.paddingBottom[40],
              { minHeight: 100 },
              contentContainerStyle,
            ]}
            style={[
              snapPoints ? Alignments.fill : { maxHeight: Dimensions.get('screen').height * 0.7 },
            ]}
            keyboardShouldPersistTaps="handled"
            {...scrollViewProps}
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[Spaces.paddingHorizontal[24], contentContainerStyle]}>
            {children}
          </BottomSheetView>
        )}

        {/* Fixed Footer */}
        {footerComponent && (
          <View style={[
            Spaces.paddingHorizontal[24],
            Spaces.paddingTop[16],
            { paddingBottom: insets.bottom + 40 },
            { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' } // Optional separator
          ]}>
            {footerComponent}
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
}

export default BottomModal;
