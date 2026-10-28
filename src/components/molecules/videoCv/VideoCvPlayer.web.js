import { useState } from 'react';
import { ImageBackground, Pressable } from 'react-native';

import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import texteVideoCv from '@/components/molecules/videoCv/videoCvCopy';
import VideoCvFrame from '@/components/molecules/videoCv/VideoCvFrame';
import {
  buildYoutubeEmbedUrl,
  buildYoutubeThumbnailUrl,
  parseYoutubeUrl,
} from '@/components/molecules/videoCv/youtubeUrl';

import { openUrl } from '@/platform/links';

/**
 * VIDEOCV (28/10, planche validée par Adel) — la vidéo YouTube du profil, sur le site.
 * Avant l'appui : la miniature (i.ytimg.com, décision 1- A) ; AUCUNE iframe. Au premier appui :
 * une `<iframe>` youtube-nocookie. Le site est servi depuis https://foundclub.app : l'origine
 * part d'elle-même, le piège 153 du téléphone ne se pose pas ici.
 * ponytail : on n'interprète pas les erreurs du lecteur sur le site (vidéo privée, intégration
 * refusée) : YouTube affiche son propre message dans le cadre, et « Ouvrir dans YouTube »,
 * toujours dessous, sert de secours. Si la recette le juge gênant : l'API du lecteur,
 * comme sur le téléphone.
 * @param {object} props
 * @param {boolean} [props.isOwner]
 * @param {string} [props.testID]
 * @param {string} props.url
 * @returns {import('react').ReactElement | null}
 */
function VideoCvPlayer({ isOwner = false, testID = 'video-cv-player', url }) {
  const { Colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const parsed = parseYoutubeUrl(url);
  if (!('videoId' in parsed)) return null;
  const { canonicalUrl, videoId } = parsed;

  const media = playing ? (
    <iframe
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      data-testid={`${testID}-iframe`}
      referrerPolicy="strict-origin-when-cross-origin"
      src={buildYoutubeEmbedUrl(videoId)}
      style={{
        border: 0, display: 'block', height: '100%', width: '100%',
      }}
      title={texteVideoCv('cardTitle')}
    />
  ) : (
    <ImageBackground
      resizeMode="cover"
      source={{ uri: buildYoutubeThumbnailUrl(videoId) }}
      style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}
      testID={`${testID}-thumbnail`}
    >
      <Pressable
        accessibilityLabel={texteVideoCv('play')}
        accessibilityRole="button"
        onPress={() => setPlaying(true)}
        style={{
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: 32,
          height: 64,
          justifyContent: 'center',
          width: 64,
        }}
        testID={`${testID}-play`}
      >
        <GlyphIcon color={Colors.primary900} name="play" size={26} />
      </Pressable>
    </ImageBackground>
  );

  return (
    <VideoCvFrame
      canonicalUrl={canonicalUrl}
      isOwner={isOwner}
      media={media}
      onOpenYoutube={() => openUrl(canonicalUrl)}
      onRetry={() => setPlaying(true)}
      state={playing ? 'playing' : 'idle'}
      testID={testID}
    />
  );
}

export default VideoCvPlayer;
