import { useTranslation } from 'react-i18next';
import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, LIGNE_DE_MENU } from '@/components/molecules/bulleDuFil/typographieDuFil';

/**
 * MSG1BA (§3.15, §3.16) — LA FEUILLE « PHOTO DU GROUPE » (pack, `PhotoSheet`) : « Prendre une
 * photo », « Choisir dans la galerie », et « Supprimer la photo » quand il y en a une.
 *
 * `enFenetre` : dans un ecran ordinaire (« Nouveau groupe »), la feuille ouvre sa propre
 * fenetre. Dans « Infos du groupe », deja une fenetre, elle se pose PAR-DESSUS la page, dans
 * la meme fenetre : une seconde fenetre sur une page deja ouverte ne s'affiche pas toujours
 * sur iPhone (constat de MSG1A, confirmation de retrait).
 * @param {object} props
 * @param {boolean} props.aPhoto - Le groupe a deja une photo : « Supprimer la photo ».
 * @param {boolean} [props.enFenetre]
 * @param {() => void} props.onClose
 * @param {(source: 'camera' | 'galerie') => void} props.onChoisir
 * @param {() => void} props.onSupprimer
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement | null}
 */
function FeuillePhotoDuGroupe({
  aPhoto, enFenetre = false, onChoisir, onClose, onSupprimer, visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  if (!visible) return null;

  const filet = withAlpha(Colors.neutral00, 0.07);
  const ligne = (
    /** @type {any} */ icone,
    /** @type {string} */ libelle,
    /** @type {() => void} */ geste,
    /** @type {string} */ testID,
    danger = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onClose();
        geste();
      }}
      style={[styles.ligne, { borderTopColor: filet }]}
      testID={testID}
    >
      <GlyphIcon color={danger ? Colors.chatDanger : Colors.neutral00} name={icone} size={20} />
      <Text style={[LIGNE_DE_MENU, { color: danger ? Colors.chatDanger : Colors.neutral00 }]}>
        {libelle}
      </Text>
    </Pressable>
  );

  const feuille = (
    <Pressable
      onPress={onClose}
      style={[styles.voile, { backgroundColor: withAlpha(Colors.neutral900, 0.45) }]}
      testID="photo-du-groupe-voile"
    >
      <Pressable
        onPress={() => {}}
        style={[styles.feuille, { backgroundColor: Colors.chatSheet, paddingBottom: 34 + bottom }]}
        testID="photo-du-groupe-feuille"
      >
        <View style={[styles.poignee, { backgroundColor: withAlpha(Colors.neutral00, 0.25) }]} />
        <Text style={[styles.titre, { color: Colors.neutral00 }]}>
          {t('conversation.groupPhoto.title', 'Photo du groupe')}
        </Text>
        {ligne(
          'camera',
          t('conversation.groupPhoto.camera', 'Prendre une photo'),
          () => onChoisir('camera'),
          'photo-du-groupe-camera',
        )}
        {ligne(
          'image',
          t('conversation.groupPhoto.library', 'Choisir dans la galerie'),
          () => onChoisir('galerie'),
          'photo-du-groupe-galerie',
        )}
        {aPhoto
          ? ligne(
            'trashAlt',
            t('conversation.groupPhoto.remove', 'Supprimer la photo'),
            onSupprimer,
            'photo-du-groupe-supprimer',
            true,
          )
          : null}
      </Pressable>
    </Pressable>
  );

  if (!enFenetre) return feuille;
  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible>
      {feuille}
    </Modal>
  );
}

const styles = StyleSheet.create({
  feuille: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  ligne: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    height: 54,
  },
  poignee: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 17,
    lineHeight: 22,
    paddingBottom: 12,
  },
  voile: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
});

export default FeuillePhotoDuGroupe;
