import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, useMemo } from 'react';
import {
  ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  useWindowDimensions, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { getFloatingTabBarScenePaddingBottom } from '@/navigation/commonOptions';

// U02 — UN STYLE ECRIT POUR UNE VIEW NE SE TRANSPOSE PAS TEL QUEL DANS UN
// SCROLLVIEW. `flex: 1` y BORNE le contenu a la hauteur visible : le contenu ne
// peut alors plus depasser, donc plus rien ne defile — en silence, et aucun
// pixel ne le dit. `flexGrow: 1` rend exactement la MEME image tant que le
// contenu tient dans l'ecran, et le laisse depasser quand il deborde.
// La conversion vit ICI, dans le conteneur partage, pour qu'aucun ecran n'ait
// a connaitre ce piege : 15 ecrans du tunnel passent `Alignments.fill`.
/**
 * @param {Array<any>} styles Le style de contenu passe par l'ecran.
 * @returns {Array<any>} Le meme style, utilisable comme contenu de ScrollView.
 */
const toScrollableContentStyle = (styles) => {
  const flattened = StyleSheet.flatten(styles) || {};

  if (flattened.flex === undefined) return [flattened];

  const { flex: valeurFlex, ...reste } = flattened;

  return [{ ...reste, flexGrow: valeurFlex }];
};

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
 * Defilement sous le clavier (U02). Sans lui, l'evitement COMPRIME le contenu
 * et ce qui depasse devient inatteignable — le defaut d'Adel du 2026-08-26.
 * ⛔ Il reste OPT-IN, et c'est une mesure : 12 des 20 ecrans a `keyboardAvoiding`
 * portent DEJA leur propre ScrollView / FlatList. L'imposer a tous imbriquerait
 * deux defilements verticaux et casserait leur physique de defilement.
 * @param {boolean} [props.keyboardScroll]
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
  keyboardScroll = false,
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
  // 2. `keyboardVerticalOffset` compense un decalage GEOMETRIQUE, et D31 a
  //    mesure qu'il vaut ZERO ICI. La regle, lue dans le code de React Native
  //    (`KeyboardAvoidingView.js`, `_relativeKeyboardHeight`) : il compare
  //    `frame.y + frame.height` — la position de CETTE vue DANS SON PARENT — a
  //    `keyboardFrame.screenY`, une position ECRAN. L'offset doit donc valoir
  //    la position ECRAN DU PARENT, pas la marge que le parent applique.
  //    Or le parent est ici l'`ImageBackground`/`LinearGradient` plein ecran,
  //    dont l'origine est a l'ecran 0 (l'en-tete est transparent, cf.
  //    `commonOptions`) : `frame.y` VAUT DEJA le `paddingTop` ci-dessus, parce
  //    que Yoga positionne l'enfant a l'interieur de la marge du parent.
  //    Rendre `paddingTop` une seconde fois retranchait donc cette hauteur au
  //    contenu : l'ecran de connexion se retractait de ~96 pt de trop, le logo
  //    disparaissait et le titre remontait (defaut ④ de la recette du 07/08).
  //    `WizardStepLayout` passe `0` pour la meme raison.
  //    Toute valeur ecrite en dur (110, 100, 30...) est ce meme calcul, fige
  //    sur UN modele de telephone.
  //
  // U02 (recette du 2026-08-26) — L'EVITEMENT SEUL NE SUFFIT PAS.
  // Il retire le recouvrement du clavier, donc il COMPRIME la zone de contenu.
  // Sans rien pour defiler dedans, ce qui depasse de la hauteur restante est
  // simplement INATTEIGNABLE : sur « Qui es-tu ? », la date de naissance etait
  // a moitie recouverte et « Continuer » ecrase sous le clavier.
  // Le motif ci-dessous est celui de `WizardStepLayout`, deja en service dans
  // ce depot : un ScrollView DANS l'evitement, jamais autour.
  // ⛔ `keyboardShouldPersistTaps="handled"` n'est pas decoratif : sans lui, le
  //    premier appui sur « Continuer » ne ferait que refermer le clavier.
  // ⛔ `automaticallyAdjustKeyboardInsets` est ce qui remonte le champ actif
  //    au-dessus du clavier, et c'est iOS qui le fait — pas une hauteur de
  //    clavier calculee a la main, pas une dependance de plus.
  const staticContent = (
    <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
      {children}
    </View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={Alignments.fill}
    >
      {keyboardScroll ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            Alignments.grow1,
            ...toScrollableContentStyle(safeContentContainerStyle),
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          // Clavier ferme, l'ecran doit rester celui d'hier : pas de barre de
          // defilement qui apparaitrait sur un contenu qui tient deja.
          showsVerticalScrollIndicator={false}
          style={Alignments.fill}
        >
          {children}
        </ScrollView>
      ) : staticContent}
    </KeyboardAvoidingView>
  ) : staticContent;

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
