import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
// Hooks
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
// Utils
import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Error wrapper component.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {unknown} props.error
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @param {() => void} [props.onRetry] - Optional retry handler. When omitted,
 * the rendering is strictly identical to the previous behaviour.
 * @param {string} [props.retryLabel] - Label of the retry action.
 * @returns {import('react').ReactElement}
 */
function ErrorWrapper({
  children,
  error,
  onRetry = undefined,
  retryLabel = 'Réessayer',
  wrapperStyle = [],
}) {
  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  const [childrenDimensions, setChildrenDimensions] = useState({ height: 0, width: 0 });

  // PERF3 — anti-rebond : UN geste ici couvre les 30 écrans qui passent par
  // WithDataWrapper. Sans lui, chaque appui relançait TOUTES les requêtes en
  // échec — marteler le bouton multipliait la demande quand le serveur rame.
  // Le ref garde le verrou SYNCHRONE (deux appuis dans la même frame lisent le
  // même état React) ; le state, lui, désactive visuellement le bouton.
  const retryInFlightRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryPress = async () => {
    if (retryInFlightRef.current || typeof onRetry !== 'function') return;
    retryInFlightRef.current = true;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      retryInFlightRef.current = false;
      setIsRetrying(false);
    }
  };

  /**
   * Handle children layout event.
   * @param {import('react-native').LayoutChangeEvent} event
   * @returns {void}
   */
  const onChildrenLayout = (event) => {
    const { height, width } = event.nativeEvent.layout;
    setChildrenDimensions({ height, width });
  };

  return (
    <View
      onLayout={onChildrenLayout}
      style={wrapperStyle}
    >
      {children}
      {error && (
        <View style={[
          Alignments.absolute,
          Alignments.justifyCenter,
          Alignments.alignCenter,
          childrenDimensions,
          ApplicationStyle.backgroundColor.error100,
          ApplicationStyle.borderRadius8,
        ]}
        >
          {/*
            Encre sur fond error100 : error700 vaut 4,26:1 (sous le seuil AA de
            4,5:1). neutral900 vaut 15,99:1. Le fond reste inchange, seule
            l'encre bouge.
          */}
          <Text
            style={[Fonts.p1,
              Fonts.neutral900,
              { width: childrenDimensions.width - 48 },
            ]}
          >
            {getErrorMessage(error)}
          </Text>
          {onRetry ? (
            <View style={Spaces.marginTop[12]}>
              <Button
                isLoading={isRetrying}
                isOption
                onPress={handleRetryPress}
                size="sm"
                title={retryLabel}
              />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default ErrorWrapper;
