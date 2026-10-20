import { useEffect, useMemo } from 'react';
import {
  Image, Modal, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { doitFermer, opaciteDuFond } from './gesteDeFermeture';

/**
 * MSGIMG — L'IMAGE D'UNE CONVERSATION OUVERTE EN GRAND (constat d'Adel, 20/10/2026).
 *
 * 🐛 AVANT : un « X » blanc sans fond, pose directement sur la photo. Sur une photo
 * blanche, il disparaissait — et c'etait la seule facon de sortir sur iPhone.
 *
 * ✅ LA CROIX TOUJOURS VISIBLE : un ROND sombre translucide derriere une croix claire.
 * Le rond pese 65 % de `neutral900` : pose sur du BLANC il donne un gris moyen
 * (contraste de la croix ≈ 6:1), pose sur du NOIR il se fond — c'est alors son liseré
 * clair qui le dessine, et la croix blanche contraste d'elle-meme (≈ 19:1). Mesure dans
 * `ConversationMSGIMG.apercu.test.js` (MSGIMG-1c), sur les deux extremes.
 *
 * ✅ GLISSER VERS LE BAS POUR FERMER : l'image suit le doigt, le fond s'eclaircit (la
 * conversation reapparait dessous : la fenetre est transparente), et au lacher elle se
 * ferme au-dela du seuil ou revient a sa place (`gesteDeFermeture.js`). Le geste ne
 * s'arme que vers le BAS (`activeOffsetY(12)`) et cede a un geste horizontal.
 * ⚠️ `GestureHandlerRootView` DANS la fenetre : sur Android, un `Modal` est une autre
 * racine native, et le geste n'y serait jamais recu sans elle.
 */

/** Opacite du rond derriere les boutons de l'apercu. */
const OPACITE_DU_ROND = 0.65;

/**
 * L'apercu plein ecran d'une image de conversation.
 * @param {object} props
 * @param {() => void} props.onClose Referme l'apercu.
 * @param {(event: any) => void} [props.onImageError] L'image n'a pas pu se charger.
 * @param {() => void} [props.onImageLoad] L'image s'est chargee.
 * @param {string} props.uri L'adresse de l'image.
 * @param {boolean} props.visible L'apercu est ouvert.
 * @returns {JSX.Element} La fenetre.
 */
function ApercuDImage({
  onClose, onImageError, onImageLoad, uri, visible,
}) {
  const { Colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const { height: hauteur } = useWindowDimensions();
  const glissement = useSharedValue(0);

  // Chaque ouverture repart d'une image a sa place.
  useEffect(() => {
    if (visible) glissement.value = 0;
  }, [glissement, uri, visible]);

  const geste = useMemo(() => Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-30, 30])
    .onUpdate((evenement) => {
      glissement.value = Math.max(0, evenement.translationY);
    })
    .onEnd((evenement) => {
      if (doitFermer(evenement.translationY, evenement.velocityY, hauteur)) {
        glissement.value = withTiming(hauteur, { duration: 180 }, (fini) => {
          if (fini) runOnJS(onClose)();
        });
        return;
      }
      glissement.value = withSpring(0, { damping: 22, stiffness: 240 });
    }), [glissement, hauteur, onClose]);

  const styleDuFond = useAnimatedStyle(() => ({
    opacity: opaciteDuFond(glissement.value, hauteur),
  }));
  const styleDeLImage = useAnimatedStyle(() => ({
    transform: [{ translateY: glissement.value }],
  }));

  const habillageDuRond = {
    backgroundColor: withAlpha(Colors.neutral900, OPACITE_DU_ROND),
    borderColor: withAlpha(Colors.neutral00, 0.35),
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.ecran}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: Colors.neutral900 }, styleDuFond]}
          testID="MSGIMG-fond"
        />

        <GestureDetector gesture={geste}>
          <Animated.View style={[styles.ecran, styleDeLImage]} testID="MSGIMG-image-glissante">
            {uri ? (
              <Image
                onError={onImageError}
                onLoad={onImageLoad}
                resizeMode="contain"
                source={{ uri }}
                style={styles.image}
              />
            ) : null}
          </Animated.View>
        </GestureDetector>

        <Pressable
          accessibilityLabel={i18n.t('conversation.imagePreview.close', 'Fermer l’image')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={[styles.rond, habillageDuRond, { top: top + 8 }]}
          testID="MSGIMG-fermer"
        >
          <GlyphIcon color={Colors.neutral00} name="xmark" size={22} />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ecran: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    height: '90%',
    width: '100%',
  },
  rond: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    height: 44,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    width: 44,
  },
});

export default ApercuDImage;
