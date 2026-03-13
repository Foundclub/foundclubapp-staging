import { useMemo } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import useTheme from '@/theme/themeContext';

import useAudioPlayback from '@/hooks/useAudioPlayback';

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const formatDuration = (valueMs) => {
  const totalSeconds = Math.max(0, Math.floor((Number(valueMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const toPublicApiOrigin = (rawApiUrl) => {
  const raw = String(rawApiUrl || '').trim();
  if (!raw) return '';
  return raw.replace(/\/api\/?$/i, '');
};

const isLoopbackHost = (host) => ['10.0.2.2', '127.0.0.1', 'localhost']
  .includes(String(host || '').trim().toLowerCase());

const normalizeOrigin = (rawOrigin) => {
  const origin = toPublicApiOrigin(rawOrigin);
  if (!origin) return '';
  try {
    return new URL(origin).origin;
  } catch (_error) {
    return origin.replace(/\/+$/g, '');
  }
};

const rewriteLoopbackUrl = (rawUrl, targetOrigin) => {
  if (!rawUrl || !targetOrigin || !/^https?:\/\//i.test(rawUrl)) return rawUrl;

  try {
    const currentUrl = new URL(rawUrl);
    const targetUrl = new URL(targetOrigin);
    if (
      isLoopbackHost(currentUrl.hostname)
      && currentUrl.hostname !== targetUrl.hostname
    ) {
      return `${targetUrl.origin}${currentUrl.pathname}${currentUrl.search || ''}`;
    }
  } catch (_error) {
    // Keep original URL if parsing fails.
  }
  return rawUrl;
};

const resolveAudioAttachmentUrl = (attachments = []) => {
  const audioAttachment = attachments.find((attachment) => {
    const mime = String(attachment?.mime || '').toLowerCase();
    if (mime.startsWith('audio/')) return true;
    const name = String(attachment?.url || attachment?.name || attachment?.uri || '').toLowerCase();
    return /\.(mp4|m4a|aac|mp3|wav|ogg|oga|webm)$/.test(name);
  });

  const rawUrl = String(
    audioAttachment?.url
    || audioAttachment?.uri
    || audioAttachment?.previewUrl
    || '',
  ).trim();
  if (!rawUrl) return '';
  const origins = [
    process.env.API_URL,
    process.env.API_PUBLIC_URL,
    __DEV__ ? 'http://10.0.2.2:1337' : '',
  ]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (
    rawUrl.startsWith('http://')
    || rawUrl.startsWith('https://')
    || rawUrl.startsWith('file://')
    || rawUrl.startsWith('content://')
    || rawUrl.startsWith('data:')
  ) {
    const preferredOrigin = origins[0] || '';
    return rewriteLoopbackUrl(rawUrl, preferredOrigin);
  }

  const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;

  if (origins.length === 0) return normalizedPath;
  return `${origins[0]}${normalizedPath}`;
};

const buildFallbackWaveform = (durationMs, size = 28) => (
  Array.from({ length: size }, (_, index) => {
    const phase = ((Number(durationMs) || 0) / 220) + (index * 0.7);
    const normalized = (Math.sin(phase) + 1) / 2;
    return Math.round(4 + (normalized * 14));
  })
);

const normalizeWaveformBars = (rawWaveform, durationMs) => {
  const sourceBars = Array.isArray(rawWaveform) ? rawWaveform : [];
  if (sourceBars.length === 0) return buildFallbackWaveform(durationMs);

  const numericBars = sourceBars
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numericBars.length === 0) return buildFallbackWaveform(durationMs);

  const looksLikeHeights = numericBars.every((value) => value >= 0 && value <= 40);
  if (looksLikeHeights) {
    return numericBars
      .map((value) => clampNumber(Math.round(value), 4, 20))
      .slice(-32);
  }

  const min = Math.min(...numericBars);
  const max = Math.max(...numericBars);
  const range = max - min;
  if (!Number.isFinite(range) || range < 0.6) {
    return buildFallbackWaveform(durationMs, Math.min(Math.max(numericBars.length, 12), 32));
  }

  return numericBars
    .map((value) => {
      const ratio = clampNumber((value - min) / range, 0, 1);
      return Math.round(4 + (ratio * 16));
    })
    .slice(-32);
};

/**
 * Voice note message bubble.
 * @param {object} props
 * @param {any} props.composition
 * @param {Array<{ url?: string; uri?: string; mime?: string; name?: string }>} [props.attachments]
 * @param {boolean} [props.isMe]
 * @returns {import('react').ReactElement | null}
 */
function VoiceNoteBubble({
  attachments = [],
  composition,
  isMe = false,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const audioUrl = useMemo(() => resolveAudioAttachmentUrl(attachments), [attachments]);
  const playbackHeaders = useMemo(() => {
    if (!/^https?:\/\//i.test(String(audioUrl || ''))) return undefined;
    const token = getAuthTokens()?.token;
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  }, [audioUrl]);
  const fallbackDuration = Math.max(0, Number(composition?.durationMs) || 0);

  const {
    cycleSpeed,
    durationMs,
    isLoading,
    isPlayerAvailable,
    isPlaying,
    lastError,
    positionMs,
    progress,
    speed,
    togglePlayback,
  } = useAudioPlayback({
    headers: playbackHeaders,
    sourceUrl: audioUrl,
  });

  const displayedDuration = durationMs || fallbackDuration;
  const waveformBars = useMemo(
    () => normalizeWaveformBars(composition?.waveform, displayedDuration),
    [composition?.waveform, displayedDuration],
  );

  if (!audioUrl) return null;
  const canTogglePlayback = isPlayerAvailable && !isLoading;
  let playbackButtonLabel = '>';
  if (isLoading) playbackButtonLabel = '...';
  else if (isPlaying) playbackButtonLabel = '||';

  const activeBarsCount = Math.max(
    0,
    Math.min(
      waveformBars.length,
      Math.round((Number(progress) || 0) * waveformBars.length),
    ),
  );
  const currentPositionLabel = formatDuration(Math.min(positionMs || 0, displayedDuration || positionMs || 0));
  const totalDurationLabel = formatDuration(displayedDuration);

  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.marginVertical[6],
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: isMe ? 'rgba(11, 41, 56, 0.96)' : 'rgba(7, 24, 34, 0.95)',
          borderColor: isMe ? Colors.primary500 : Colors.primary700,
          borderWidth: 1,
          maxWidth: '88%',
          minWidth: 220,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[Spaces.padding[12], { gap: 10 }]}>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 10 }]}>
          <TouchableOpacity
            disabled={!canTogglePlayback}
            onPress={togglePlayback}
            style={{
              alignItems: 'center',
              backgroundColor: isPlaying ? Colors.primary500 : 'rgba(0, 173, 239, 0.12)',
              borderColor: Colors.primary500,
              borderRadius: 19,
              borderWidth: 1,
              height: 38,
              justifyContent: 'center',
              opacity: canTogglePlayback ? 1 : 0.55,
              width: 38,
            }}
          >
            <Text style={[
              Fonts.p2Bold,
              {
                color: isPlaying ? Colors.neutral00 : Colors.primary500,
                marginLeft: isPlaying ? 0 : 2,
              },
            ]}
            >
              {playbackButtonLabel}
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1, gap: 7 }}>
            <View
              style={{
                alignItems: 'flex-end',
                flexDirection: 'row',
                gap: 2,
                height: 22,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              {waveformBars.map((barHeight, index) => {
                const isPastProgress = index < activeBarsCount;
                return (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={`voice-bar-${index}`}
                    style={{
                      backgroundColor: isPastProgress ? Colors.primary500 : 'rgba(255,255,255,0.20)',
                      borderRadius: 2,
                      height: barHeight,
                      opacity: isPastProgress ? 0.95 : 0.75,
                      width: 3,
                    }}
                  />
                );
              })}
            </View>

            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.p4Bold, { color: Colors.neutral200 }]}>
                {currentPositionLabel}
                {' / '}
                {totalDurationLabel}
              </Text>

              <TouchableOpacity
                onPress={cycleSpeed}
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 173, 239, 0.14)',
                  borderColor: Colors.primary700,
                  borderRadius: 12,
                  borderWidth: 1,
                  height: 24,
                  justifyContent: 'center',
                  minWidth: 46,
                  paddingHorizontal: 8,
                }}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                  x
                  {speed}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!isPlayerAvailable ? (
          <Text style={[Fonts.p4, { color: Colors.error500 }]}>
            Lecture audio indisponible sur cette build.
          </Text>
        ) : null}

        {lastError ? (
          <Text style={[Fonts.p4, { color: Colors.error500 }]}>
            {lastError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default VoiceNoteBubble;
