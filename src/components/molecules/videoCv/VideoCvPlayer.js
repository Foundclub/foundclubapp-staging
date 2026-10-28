import { useState } from 'react';
import { ImageBackground, Pressable } from 'react-native';

import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import texteVideoCv from '@/components/molecules/videoCv/videoCvCopy';
import VideoCvFrame from '@/components/molecules/videoCv/VideoCvFrame';
import {
  buildYoutubeEmbedPage,
  buildYoutubeThumbnailUrl,
  parseYoutubeUrl,
  YOUTUBE_PLAYER_ORIGIN,
  youtubeErrorKind,
} from '@/components/molecules/videoCv/youtubeUrl';

import LinksPlatform from '@/platform/links';

/**
 * VIDEOCV (28/10, planche validée par Adel) — la vidéo YouTube du profil, sur le téléphone.
 * Avant l'appui : la miniature (i.ytimg.com, décision 1- A) et un bouton ; AUCUNE WebView.
 * Au premier appui : une WebView charge le lecteur youtube-nocookie, avec l'origine
 * `https://foundclub.app` (sans elle, YouTube répond « erreur 153 »). Ses erreurs remontent par
 * `postMessage` et deviennent les trois cas de la planche M9.
 * @param {object} props
 * @param {boolean} [props.isOwner] - L'auteur voit en plus « C'est ta vidéo ? ».
 * @param {string} [props.testID]
 * @param {string} props.url - Le lien stocké (forme canonique).
 * @returns {import('react').ReactElement | null}
 */
function VideoCvPlayer({ isOwner = false, testID = 'video-cv-player', url }) {
  const { Colors } = useTheme();
  /** @type {['idle' | 'playing' | 'unavailable' | 'embed' | 'network', Function]} */
  const [state, setState] = useState(/** @type {any} */ ('idle'));
  const parsed = parseYoutubeUrl(url);
  if (!('videoId' in parsed)) return null;
  const { canonicalUrl, videoId } = parsed;

  const handleMessage = (/** @type {any} */ event) => {
    let message = null;
    try {
      message = JSON.parse(event?.nativeEvent?.data || 'null');
    } catch {
      return;
    }
    if (message?.type === 'error') setState(youtubeErrorKind(message.code));
    if (message?.type === 'network') setState('network');
  };

  let media = null;
  if (state === 'playing') {
    // Chargé à l'appui seulement, comme la carte (`maps.native.js`) : le module WebView
    // n'entre pas en mémoire tant que personne ne lance la vidéo.
    // eslint-disable-next-line global-require
    const { WebView } = require('react-native-webview');
    media = (
      <WebView
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        onError={() => setState('network')}
        onMessage={handleMessage}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        source={{ baseUrl: YOUTUBE_PLAYER_ORIGIN, html: buildYoutubeEmbedPage(videoId) }}
        style={{ backgroundColor: Colors.neutral900, flex: 1 }}
        testID={`${testID}-webview`}
      />
    );
  } else if (state === 'idle') {
    media = (
      <ImageBackground
        resizeMode="cover"
        source={{ uri: buildYoutubeThumbnailUrl(videoId) }}
        style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}
        testID={`${testID}-thumbnail`}
      >
        <Pressable
          accessibilityLabel={texteVideoCv('play')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setState('playing')}
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
  }

  return (
    <VideoCvFrame
      canonicalUrl={canonicalUrl}
      isOwner={isOwner}
      media={media}
      onOpenYoutube={() => LinksPlatform.openUrl(canonicalUrl)}
      onRetry={() => setState('playing')}
      state={state}
      testID={testID}
    />
  );
}

export default VideoCvPlayer;
