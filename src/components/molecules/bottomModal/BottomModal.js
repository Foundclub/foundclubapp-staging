import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BlurView } from '@sbaiahmed1/react-native-blur';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Image,
  Keyboard,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { STARTUP_PHASES, useStartupPhase } from '@/context/StartupPhaseContext';

// Durée au-delà de laquelle une fermeture reçue n'est plus attribuable à
// l'animation de sortie qu'on vient d'interrompre. Calée sur la même échelle
// que la reprise de présentation ci-dessous (260 ms), avec de la marge.
const STALE_DISMISS_WINDOW_MS = 400;

/**
 * Bottom modal component using @gorhom/bottom-sheet.
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content to render inside the modal
 * @param {() => void} props.close - Function to close the modal
 * @param {import('@/theme/types').ColorNames} [props.closeIconTintColor]
 * @param {number} [props.contentBottomPaddingOverride] - Optional explicit bottom padding for scroll content
 * @param {import('react-native').ViewStyle} [props.contentContainerStyle]
 * @param {React.ReactNode} [props.headerComponent] - Fixed header component
 * @param {React.ReactNode} [props.footerComponent] - Fixed footer component
 * @param {boolean} [props.hideCloseButton] - Whether to hide the close button
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {() => void} [props.onDismissed] - Optional callback fired when modal is fully dismissed
 * @param {boolean} [props.preventStartupPresentation] - Prevent presenting until startup is stable
 * @param {boolean} [props.scrollable] - Whether the content should be scrollable (default: true)
 * @param {boolean} [props.closeOnBackdropPress] - Whether backdrop press closes modal
 * @param {boolean} [props.enableContentPanningGesture] - Enables content panning gesture
 * @param {boolean} [props.enablePanDownToClose] - Enables pan-down-to-close gesture
 * @param {'adjustResize' | 'adjustPan' | 'stateUnchanged'} [props.androidKeyboardInputMode]
 * @param {'interactive' | 'extend' | 'fillParent'} [props.keyboardBehavior]
 * @param {number} [props.maxContentHeightRatio] - Fraction de la hauteur d'ecran
 * que la zone defilante peut occuper. Sans effet avec `snapPoints`.
 * @param {React.MutableRefObject<any>} [props.scrollViewRef] - Optional ref forwarded to BottomSheetScrollView
 * @param {object} [props.scrollViewProps] - Optional extra props forwarded to BottomSheetScrollView
 * @param {(string|number)[]} [props.snapPoints] - Array of snap points for the modal
 * @param {import('react-native').ViewStyle} [props.style] - Additional styles for modal
 * @param {boolean} [props.useSafeAreaBottomInset] - Apply safe area bottom inset to the sheet container
 * @param {'sheet' | 'dialog'} [props.webPresentation] - Web-only presentation hint (ignored on native).
 * @returns {import('react').ReactElement} Modal component
 */
function BottomModal({
  androidKeyboardInputMode = 'adjustResize',
  children,
  close,
  closeIconTintColor = 'primary200',
  closeOnBackdropPress = true,
  contentBottomPaddingOverride,
  contentContainerStyle,
  enableContentPanningGesture = Platform.OS === 'ios',
  enablePanDownToClose = true,
  footerComponent,
  headerComponent,
  hideCloseButton = true,
  isVisible,
  keyboardBehavior = 'interactive',
  // R5 (D1) — LE PLAFOND DE LA ZONE DEFILANTE DEVIENT REGLABLE, PAR EXCEPTION.
  // Ce composant sert 70 appelants : remonter le plafond POUR TOUT LE MONDE
  // changerait 70 ecrans sans qu aucun temoin ne le voie. La prop est donc
  // OPT-IN, et son defaut est EXACTEMENT la valeur d avant.
  // Seule la feuille « Gerer l evenement » la passe (EventDetails.js) : elle
  // porte 5 a 7 rangees dont deux a note de 2-3 lignes, et ses dernieres
  // actions tombaient sous le pli (constat de recette de la 2.6.26).
  maxContentHeightRatio = 0.7,
  onDismissed,
  preventStartupPresentation = false,
  scrollable = true,
  scrollViewProps,
  scrollViewRef,
  snapPoints,
  style,
  useSafeAreaBottomInset = true,
}) {
  /**
   * @type {React.MutableRefObject<import('@gorhom/bottom-sheet').BottomSheetModal | null>}
   */
  const modalRef = useRef(null);
  const visibilityRef = useRef(false);
  const sheetStateRef = useRef('hidden');
  const presentRecoveryTimerRef = useRef(0);
  // Fenêtre pendant laquelle un `onDismiss` reçu est PÉRIMÉ : il appartient à
  // l'animation de sortie qu'on vient d'interrompre en représentant la feuille.
  // Au-delà, une fermeture vient de l'utilisateur (glissement vers le bas) et
  // doit être propagée — d'où une borne de temps plutôt qu'un drapeau, qui
  // resterait armé si la bibliothèque n'émettait jamais la fermeture périmée.
  const staleDismissUntilRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [shouldRender, setShouldRender] = useState(Boolean(isVisible));
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { phase: startupPhase } = useStartupPhase();
  const {
    Alignments, ApplicationStyle, Colors, Images, Spaces,
  } = useTheme();
  const canPresentDuringStartup = !preventStartupPresentation
    || startupPhase === STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
    || startupPhase === STARTUP_PHASES.STEADY_STATE;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!shouldRender) return;
    if (!modalRef.current) return;
    if (isVisible && !canPresentDuringStartup) return;

    // `dismissing` compte comme rouvrable : la fermeture précédente est encore
    // en vol et son `onDismiss` peut mettre plusieurs centaines de millisecondes
    // à revenir. Exiger `hidden` faisait perdre en silence tout appui donné
    // pendant ce délai — la feuille ne se rouvrait jamais.
    const dejaPresentee = sheetStateRef.current === 'presenting'
      || sheetStateRef.current === 'visible';

    if (isVisible && !dejaPresentee) {
      if (sheetStateRef.current === 'dismissing') {
        staleDismissUntilRef.current = Date.now() + STALE_DISMISS_WINDOW_MS;
      }
      visibilityRef.current = true;
      sheetStateRef.current = 'presenting';
      modalRef.current.present();
      if (presentRecoveryTimerRef.current) {
        clearTimeout(presentRecoveryTimerRef.current);
      }
      presentRecoveryTimerRef.current = setTimeout(() => {
        if (sheetStateRef.current === 'presenting') {
          sheetStateRef.current = 'visible';
        }
        presentRecoveryTimerRef.current = 0;
      }, 260);
      return;
    }

    if (
      !isVisible
      && sheetStateRef.current !== 'hidden'
      && sheetStateRef.current !== 'dismissing'
    ) {
      sheetStateRef.current = 'dismissing';
      if (presentRecoveryTimerRef.current) {
        clearTimeout(presentRecoveryTimerRef.current);
        presentRecoveryTimerRef.current = 0;
      }
      // Keep visibilityRef=true until onDismiss is actually fired.
      // This allows handleDismiss to trigger callbacks such as onDismissed.
      modalRef.current.dismiss();
    }
  }, [canPresentDuringStartup, isVisible, shouldRender]);

  useEffect(() => () => {
    visibilityRef.current = false;
    sheetStateRef.current = 'hidden';
    if (presentRecoveryTimerRef.current) {
      clearTimeout(presentRecoveryTimerRef.current);
      presentRecoveryTimerRef.current = 0;
    }
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
    // Fermeture périmée : la feuille a déjà été représentée, la propager
    // rappellerait `close` et annulerait l'ouverture demandée.
    if (Date.now() < staleDismissUntilRef.current) {
      staleDismissUntilRef.current = 0;
      // Cette fermeture a pu retirer la feuille pour de bon : on redemande la
      // présentation. L'appel est idempotent, et il interdit le seul état dont
      // l'utilisateur ne pourrait pas sortir — ouvert côté code, fermé à l'écran.
      modalRef.current?.present();
      return;
    }
    staleDismissUntilRef.current = 0;
    visibilityRef.current = false;
    sheetStateRef.current = 'hidden';
    setShouldRender(false);
    if (presentRecoveryTimerRef.current) {
      clearTimeout(presentRecoveryTimerRef.current);
      presentRecoveryTimerRef.current = 0;
    }
    close?.();
    onDismissed?.();
  }, [close, onDismissed]);

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
        onPress={closeOnBackdropPress ? close : undefined}
        opacity={0.5}
        pressBehavior={closeOnBackdropPress ? 'close' : 'none'}
        style={[backDropProps.style, {
          backgroundColor: Colors.neutral800,
        }]}
      >
        {Platform.OS === 'ios' && (
          <BlurView
            blurAmount={15}
            blurType="dark"
            reducedTransparencyFallbackColor={withAlpha(Colors.neutral900, 0.5)}
            style={Alignments.fill}
          />
        )}
      </BottomSheetBackdrop>
    ),
    [close, closeOnBackdropPress, Colors, Alignments.fill],
  );

  const footerBottomInset = useMemo(() => (
    (useSafeAreaBottomInset ? insets.bottom : 0)
    + (keyboardBehavior === 'interactive' ? 0 : keyboardHeight)
  ), [insets.bottom, keyboardBehavior, keyboardHeight, useSafeAreaBottomInset]);
  const sheetBottomInset = keyboardBehavior === 'interactive' ? 0 : keyboardHeight;
  const contentBottomPadding = useMemo(
    () => {
      if (Number.isFinite(contentBottomPaddingOverride)) {
        return Math.max(0, Number(contentBottomPaddingOverride));
      }
      const keyboardOffset = keyboardBehavior === 'interactive' ? 0 : keyboardHeight;
      const safeAreaOffset = useSafeAreaBottomInset ? insets.bottom : 0;
      return (footerComponent ? 16 : 40) + keyboardOffset + safeAreaOffset;
    },
    [
      contentBottomPaddingOverride,
      footerComponent,
      insets.bottom,
      keyboardBehavior,
      keyboardHeight,
      useSafeAreaBottomInset,
    ],
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <BottomSheetModal
      android_keyboardInputMode={androidKeyboardInputMode}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        ApplicationStyle.borderRadius32,
        ApplicationStyle.backgroundColor.primary700,
        style]}
      bottomInset={sheetBottomInset}
      enableContentPanningGesture={enableContentPanningGesture}
      enableDynamicSizing={!snapPoints}
      enablePanDownToClose={enablePanDownToClose}
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
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
          hitSlop={ApplicationStyle.hitSlop.min44From28}
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
          <View
            style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[24], Spaces.paddingBottom[16], { zIndex: 1 }]}
          >
            {headerComponent}
          </View>
        )}

        {/* Content */}
        {scrollable ? (
          <BottomSheetScrollView
            contentContainerStyle={[
              Spaces.paddingHorizontal[24],
              !headerComponent ? Spaces.paddingTop[12] : null,
              contentContainerStyle,
              // Keep actions and last fields visible above keyboard.
              { paddingBottom: contentBottomPadding },
              { minHeight: 100 },
            ]}
            keyboardShouldPersistTaps="handled"
            ref={scrollViewRef}
            style={[
              snapPoints
                ? Alignments.fill
                : { maxHeight: Dimensions.get('screen').height * maxContentHeightRatio },
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
            footerComponent ? { paddingBottom: contentBottomPadding } : null,
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
            {
              backgroundColor: Colors.primary700,
              borderTopColor: withAlpha(Colors.neutral00, 0.1),
              borderTopWidth: 1,
              paddingBottom: 12 + footerBottomInset,
            },
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
