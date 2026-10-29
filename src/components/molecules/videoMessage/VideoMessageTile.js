import { Pressable, Text, View } from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { formatVideoDuration } from '@/platform/media/videoLimits';

/**
 * MSG-MEDIA (29/10) — LA VIDÉO DANS LA BULLE : une tuile sombre, un bouton lecture et
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

  return (
    <Pressable
      accessibilityLabel={i18n.t('conversation.video.play', 'Lire la vidéo')}
      accessibilityRole="button"
      delayLongPress={250}
      onLongPress={onLongPress}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: Colors.neutral900,
        borderRadius: 14,
        height: 150,
        justifyContent: 'center',
        overflow: 'hidden',
        width: 230,
      }}
      testID={testID}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: 28,
          height: 56,
          justifyContent: 'center',
          width: 56,
        }}
      >
        <GlyphIcon color={Colors.primary900} name="play" size={22} />
      </View>
      <Text
        style={[Fonts.p3Bold, Fonts.neutral00, { bottom: 10, left: 12, position: 'absolute' }]}
        testID={`${testID}-label`}
      >
        {texte}
      </Text>
    </Pressable>
  );
}

export default VideoMessageTile;
