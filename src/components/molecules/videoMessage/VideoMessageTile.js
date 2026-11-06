import { Pressable, Text, View } from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { formatVideoDuration } from '@/platform/media/videoLimits';

/**
 * MSG-MEDIA (29/10) — LA VIDÉO DANS LA BULLE : une carte, un bouton lecture et
 * « Vidéo · 0:42 ». Pas de vraie miniature : il faudrait une bibliothèque (geste R4), et Strapi
 * ne fabrique aucun aperçu pour une vidéo.
 * Partagée par le téléphone et le site (react-native-web).
 * @param {object} props
 * @param {number} [props.durationSeconds] - Absente sur un vieux message : « Vidéo » seul.
 * @param {() => void} [props.onLongPress]
 * @param {() => void} props.onPress - Ouvre le lecteur.
 * @param {string} [props.testID]
 * @returns {import('react').ReactElement}
 */
function VideoMessageTile({
  durationSeconds, onLongPress, onPress, testID = 'video-message-tile',
}) {
  const { Colors, Fonts } = useTheme();
  const libelle = i18n.t('conversation.video.label', 'Vidéo');
  const duree = formatVideoDuration(durationSeconds);
  const texte = duree ? `${libelle} · ${duree}` : libelle;

  // RETOURS-TESTEUR-2 (06/11/2026, M0029, décision du chef « C ») — « on ne voit pas l'image, il
  // y a un écran noir » : la tuile sombre de 230 × 150 devient une carte claire, comme la bulle
  // d'un document (DocumentMessageBubble) : le bouton lecture, « Vidéo · 0:42 », « Lire la vidéo ».
  // ponytail: toujours sans vignette ; une image de la vidéo demande une bibliothèque (R4).
  const lire = i18n.t('conversation.video.play', 'Lire la vidéo');
  return (
    <Pressable
      accessibilityLabel={lire}
      accessibilityRole="button"
      delayLongPress={250}
      onLongPress={onLongPress}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(10, 28, 38, 0.96)',
        borderColor: 'rgba(1,179,244,0.35)',
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        width: 230,
      }}
      testID={testID}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: 24,
          height: 48,
          justifyContent: 'center',
          width: 48,
        }}
      >
        <GlyphIcon color={Colors.primary900} name="play" size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]} testID={`${testID}-label`}>
          {texte}
        </Text>
        <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {lire}
        </Text>
      </View>
    </Pressable>
  );
}

export default VideoMessageTile;
