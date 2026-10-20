import {
  Image, Modal, Pressable, StyleSheet, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

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
  const habillageDuRond = {
    backgroundColor: withAlpha(Colors.neutral900, OPACITE_DU_ROND),
    borderColor: withAlpha(Colors.neutral00, 0.35),
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <View style={[styles.ecran, { backgroundColor: Colors.neutral900 }]}>
        {uri ? (
          <Image
            onError={onImageError}
            onLoad={onImageLoad}
            resizeMode="contain"
            source={{ uri }}
            style={styles.image}
          />
        ) : null}

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
      </View>
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
