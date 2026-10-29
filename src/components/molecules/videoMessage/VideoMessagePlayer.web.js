import { Modal, Pressable, View } from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

/**
 * MSG-MEDIA (29/10) — LE LECTEUR D'UNE VIDÉO DE MESSAGERIE, sur le site : la balise <video>
 * du navigateur. La CSP du site autorise déjà l'hôte des fichiers en `media-src`
 * (admin config/middlewares.ts).
 * ponytail : un navigateur qui ne lit pas le codec (HEVC d'iPhone sous Firefox) affiche son
 * propre cadre vide ; le lien « Ouvrir dans le navigateur » du téléphone n'a pas de sens ici,
 * le menu du lecteur propose déjà de télécharger.
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {string} props.url - Adresse du fichier ; vide : fenêtre fermée.
 * @returns {import('react').ReactElement}
 */
function VideoMessagePlayer({ onClose, url }) {
  const { Colors } = useTheme();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(url)}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: Colors.neutral900,
          flex: 1,
          justifyContent: 'center',
          padding: 24,
        }}
        testID="video-message-player"
      >
        <Pressable
          accessibilityLabel={i18n.t('conversation.video.close', 'Fermer la vidéo')}
          accessibilityRole="button"
          onPress={onClose}
          style={{
            left: 16, padding: 8, position: 'absolute', top: 16,
          }}
          testID="video-message-player-close"
        >
          <GlyphIcon color={Colors.neutral00} name="xmark" size={22} />
        </Pressable>
        {url ? (
          // Vidéo d'un membre, sans piste de sous-titres à proposer.
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            autoPlay
            controls
            data-testid="video-message-player-video"
            playsInline
            src={url}
            style={{ maxHeight: '100%', maxWidth: '100%' }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

export default VideoMessagePlayer;
