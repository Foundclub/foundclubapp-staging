import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, useMemo } from 'react';
import { ImageBackground, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { getFloatingTabBarScenePaddingBottom } from '@/navigation/commonOptions';

import { useTour } from '@/context/TourContext';

/**
 * The ScreenContainer component is a template for all screens in the application.
 *
 * Marge basse : le conteneur garantit TOUJOURS le retrait systeme bas
 * (`insets.bottom`), quel que soit le mode. C'est ce plancher qui empeche le
 * dernier element d'un ecran (lien destructif, CTA, etat vide) de passer sous la
 * barre de navigation systeme. Seul le mode `edge-to-edge` renonce a ce plancher,
 * pour les ecrans qui gerent eux-memes leur retrait bas.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'bg1' | 'bg2' | 'bg3'} [props.bgImage]
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @param {Array<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * Valeurs de `bottomInsetMode` :
 * - `none` (defaut) : plancher `insets.bottom` seul. ATTENTION, ce nom est
 *   historique : depuis l'ajout du plancher, `none` ne signifie plus zero.
 * - `screen` : `insets.bottom + bottomInsetExtra` (ecrans de pile avec CTA bas).
 * - `tab-scene` : degagement du dock flottant.
 * - `edge-to-edge` : aucun plancher, pour les ecrans qui appliquent deja
 *   eux-memes `insets.bottom` a leur contenu (sinon il serait compte deux fois).
 * @param {'none' | 'screen' | 'tab-scene' | 'edge-to-edge'} [props.bottomInsetMode]
 * @param {number} [props.bottomInsetExtra]
 * @param {boolean} [props.responsiveHorizontalPadding]
 * @param {string[] | null} [props.gradient]
 * @param {boolean} [props.withHeaderPadding]
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  bgImage = 'bg2', // Default to bg2 per user request
  bottomInsetExtra = 12,
  bottomInsetMode = 'none',
  children,
  contentContainerStyle = [],
  gradient = null, // Default to no gradient
  responsiveHorizontalPadding = false,
  responsivePadding,
  style = [],
  withHeaderPadding = true,
}) {
  // hooks
  const {
    Alignments, Images,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { tourBannerReservedSpace } = useTour();
  const tourReservedBottom = Number(tourBannerReservedSpace) || 0;
  const headerHeightNative = useContext(HeaderHeightContext) || 0;
  const { width } = useWindowDimensions();
  const isResponsivePaddingEnabled = responsivePadding ?? responsiveHorizontalPadding;
  const horizontalPadding = isResponsivePaddingEnabled && width <= 375 ? 16 : 24;
  const safeStyle = Array.isArray(style) ? style : [style];
  const safeContentContainerStyle = Array.isArray(contentContainerStyle)
    ? contentContainerStyle
    : [contentContainerStyle];

  // constants
  const containerSpaces = useMemo(() => {
    /** @type {{ paddingTop?: number, paddingBottom?: number }} */
    const nextSpaces = {};

    if (withHeaderPadding) {
      nextSpaces.paddingTop = headerHeightNative || insets.top;
    }

    // Plancher systeme : jamais moins que le retrait bas de l'OS (barre de
    // navigation / barre gestuelle). Sans lui, le dernier element de l'ecran est
    // rendu sous la barre systeme et devient illisible ou intouchable.
    let paddingBottom = insets.bottom;

    if (bottomInsetMode === 'tab-scene') {
      paddingBottom = getFloatingTabBarScenePaddingBottom(insets.bottom, bottomInsetExtra);
    } else if (bottomInsetMode === 'screen') {
      paddingBottom = insets.bottom + bottomInsetExtra;
    } else if (bottomInsetMode === 'edge-to-edge') {
      paddingBottom = 0;
    }

    // Le bandeau du tour guide est en surimpression : le conteneur reserve sa
    // hauteur pour qu'il ne recouvre jamais le contenu reel de l'ecran.
    nextSpaces.paddingBottom = Math.max(paddingBottom, tourReservedBottom);

    return nextSpaces;
  }, [
    bottomInsetExtra,
    bottomInsetMode,
    headerHeightNative,
    insets.bottom,
    insets.top,
    tourReservedBottom,
    withHeaderPadding,
  ]);

  if (gradient) {
    return (
      <View style={[Alignments.fill, ...safeStyle]}>

        <LinearGradient
          colors={gradient}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[
            Alignments.fill,
            { paddingHorizontal: horizontalPadding },
            containerSpaces,
          ]}
        >
          <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images[bgImage]}
      style={[
        Alignments.fill,
        { paddingHorizontal: horizontalPadding },
        containerSpaces,
        ...safeStyle,
      ]}
    >
      <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
        {children}
      </View>
    </ImageBackground>
  );
}

export default ScreenContainer;
