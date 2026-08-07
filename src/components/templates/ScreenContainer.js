import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, useMemo } from 'react';
import {
  ImageBackground, KeyboardAvoidingView, Platform, useWindowDimensions, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { getFloatingTabBarScenePaddingBottom } from '@/navigation/commonOptions';

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
 * @param {boolean} [props.keyboardAvoiding]
 * @param {boolean} [props.responsiveHorizontalPadding]
 * @param {string[] | null} [props.gradient]
 * @param {boolean} [props.withHeaderPadding]
 * @param {boolean} [props.responsivePadding] Alias prioritaire de `responsiveHorizontalPadding`.
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  bgImage = 'bg2', // Default to bg2 per user request
  bottomInsetExtra = 12,
  bottomInsetMode = 'none',
  children,
  contentContainerStyle = [],
  gradient = null, // Default to no gradient
  keyboardAvoiding = false,
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

    // Le bandeau du tour guide est en surimpression et ne reserve RIEN ici :
    // une hauteur globale republiee a chaque changement de forme decalait les
    // 149 ecrans (R03, audit 2026-07-31 §2.2). Il vit au-dessus du dock et se
    // replie en pastille pour ne pas masquer les CTA.
    nextSpaces.paddingBottom = paddingBottom;

    return nextSpaces;
  }, [
    bottomInsetExtra,
    bottomInsetMode,
    headerHeightNative,
    insets.bottom,
    insets.top,
    withHeaderPadding,
  ]);

  // C06 — quand le clavier s'ouvre, le champ actif doit rester visible : les
  // conteneurs de formulaire (FormScreenContainer) activent `keyboardAvoiding`
  // pour remonter le contenu au-dessus du clavier.
  //
  // D23 (defaut ① de la recette du 07/08) — CET EVITEMENT EST LE SEUL DE
  // L'ECRAN, et ses deux valeurs se CALCULENT, elles ne se reglent pas :
  // 1. `behavior` valait `undefined` sur Android : React Native rend alors un
  //    simple <View> qui ne fait STRICTEMENT rien, et le `windowSoftInputMode=
  //    "adjustResize"` du manifeste n'agit plus depuis qu'Android 15 impose le
  //    bord-a-bord (targetSdk 35). Le clavier recouvrait donc le bouton bas.
  //    Les 19 autres KeyboardAvoidingView du depot passent 'height' : on
  //    s'aligne sur le motif maison plutot que d'en inventer un.
  // 2. `keyboardVerticalOffset` compense un decalage GEOMETRIQUE : React Native
  //    compare la hauteur de cette vue, mesuree PAR RAPPORT A SON PARENT, a la
  //    position ECRAN du clavier. Le parent applique deja `paddingTop`
  //    ci-dessus (l'en-tete est transparent, cf. `commonOptions`) — c'est
  //    exactement ce decalage-la qu'il faut rendre. Toute valeur ecrite en dur
  //    (110, 100, 30...) est ce meme calcul, fige sur UN modele de telephone.
  const keyboardTopOffset = containerSpaces.paddingTop || 0;
  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardTopOffset}
      style={Alignments.fill}
    >
      <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
        {children}
      </View>
    </KeyboardAvoidingView>
  ) : (
    <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
      {children}
    </View>
  );

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
          {body}
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
      {body}
    </ImageBackground>
  );
}

export default ScreenContainer;
