import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BlurView } from '@react-native-community/blur';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
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
  footerComponent,
  headerComponent,
  hideCloseButton = false,
  isVisible,
  keyboardBehavior = 'interactive',
  scrollable = true,
  scrollViewProps,
  scrollViewRef,
  snapPoints,
  style,
}) {
  /**
   * @type {React.MutableRefObject<import('@gorhom/bottom-sheet').BottomSheetModal | null>}
   */
  const modalRef = useRef(null);
  const visibilityRef = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      const nextHeight = event?.endCoordinates?.height || 0;
      setKeyboardHeight(Math.max(0, nextHeight - insets.bottom));
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    if (!isVisible) {
      setKeyboardHeight(0);
      return;
    }

    if (Platform.OS !== 'android') return;
    const keyboardMetrics = Keyboard.metrics?.();
    const visibleKeyboardHeight = keyboardMetrics?.height || 0;
    if (visibleKeyboardHeight > 0) {
      setKeyboardHeight(Math.max(0, visibleKeyboardHeight - insets.bottom));
    }
  }, [insets.bottom, isVisible]);

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

  const contentBottomPadding = useMemo(
    () => (footerComponent ? 16 : 40) + keyboardHeight,
    [footerComponent, keyboardHeight],
  );

  return (
    <BottomSheetModal
      android_keyboardInputMode={androidKeyboardInputMode}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        ApplicationStyle.borderRadius32,
        ApplicationStyle.backgroundColor.primary700,
        style]}
      bottomInset={insets.bottom + keyboardHeight}
      enableContentPanningGesture={Platform.OS === 'ios'}
      enableDynamicSizing={!snapPoints}
      enablePanDownToClose
      handleComponent={null}
      index={0}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
      ref={modalRef}
      snapPoints={snapPoints}
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
            contentContainerStyle={[
              Spaces.paddingHorizontal[24],
              !headerComponent ? Spaces.paddingTop[12] : null,
              // Keep actions and last fields visible above keyboard.
              { paddingBottom: contentBottomPadding },
              { minHeight: 100 },
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            ref={scrollViewRef}
            style={[
              snapPoints ? Alignments.fill : { maxHeight: Dimensions.get('screen').height * 0.7 },
            ]}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...scrollViewProps}
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[
            Spaces.paddingHorizontal[24],
            !headerComponent ? Spaces.paddingTop[12] : null,
            contentContainerStyle,
          ]}
          >
            {children}
          </BottomSheetView>
        )}

        {/* Fixed Footer */}
        {footerComponent && (
          <View style={[
            Spaces.paddingHorizontal[24],
            Spaces.paddingTop[16],
            { paddingBottom: insets.bottom + 40 + keyboardHeight },
            { borderTopColor: 'rgba(255,255,255,0.1)', borderTopWidth: 1 }, // Optional separator
          ]}
          >
            {footerComponent}
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
}

export default BottomModal;
