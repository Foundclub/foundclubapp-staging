import { useState } from 'react';
import {
  Modal, Pressable, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { buildVideoPage } from '@/components/molecules/videoMessage/videoPage';

import LinksPlatform from '@/platform/links';

/**
 * MSG-MEDIA (29/10) — LE LECTEUR D'UNE VIDÉO DE MESSAGERIE, sur le téléphone.
 * Plein écran, une WebView qui contient une balise <video> : `react-native-webview` est déjà
 * dans l'app (VIDEOCV), aucune dépendance neuve. Si la page ne lit pas le fichier (codec
 * absent de la puce, réseau), « Ouvrir dans le navigateur » reste sous le lecteur.
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {string} props.url - Adresse du fichier ; vide : fenêtre fermée.
 * @returns {import('react').ReactElement}
 */
function VideoMessagePlayer({ onClose, url }) {
  const { Colors, Fonts } = useTheme();
  const { bottom, top } = useSafeAreaInsets();
  const [enEchec, setEnEchec] = useState(false);
  const visible = Boolean(url);

  let lecteur = null;
  if (visible) {
    // Chargé à l'ouverture seulement, comme VIDEOCV : la WebView n'entre pas en mémoire
    // tant que personne ne lance une vidéo.
    // eslint-disable-next-line global-require
    const { WebView } = require('react-native-webview');
    lecteur = (
      <WebView
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        onError={() => setEnEchec(true)}
        onMessage={() => setEnEchec(true)}
        originWhitelist={['*']}
        source={{ baseUrl: 'https://foundclub.app', html: buildVideoPage(url) }}
        style={{ backgroundColor: Colors.neutral900, flex: 1 }}
        testID="video-message-player-webview"
      />
    );
  }

  const fermer = () => {
    setEnEchec(false);
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={fermer}
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <View
        style={{
          backgroundColor: Colors.neutral900, flex: 1, paddingBottom: bottom + 12, paddingTop: top,
        }}
        testID="video-message-player"
      >
        <Pressable
          accessibilityLabel={i18n.t('conversation.video.close', 'Fermer la vidéo')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={fermer}
          style={{ alignSelf: 'flex-start', padding: 16 }}
          testID="video-message-player-close"
        >
          <GlyphIcon color={Colors.neutral00} name="xmark" size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>{lecteur}</View>
        {enEchec ? (
          <Text
            style={[Fonts.p2, Fonts.neutral200, { paddingHorizontal: 16, textAlign: 'center' }]}
          >
            {i18n.t('conversation.video.unreadable', 'Cette vidéo ne se lit pas ici.')}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="link"
          onPress={() => LinksPlatform.openUrl(url)}
          style={{ alignSelf: 'center', padding: 12 }}
          testID="video-message-player-browser"
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {i18n.t('conversation.video.openInBrowser', 'Ouvrir dans le navigateur')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default VideoMessagePlayer;
