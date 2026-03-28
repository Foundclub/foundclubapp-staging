import { useEffect, useMemo, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import useTheme from '@/theme/themeContext';

import client from '@/services/client';

import { createLogger } from '@/utils/logger/logger';
import { resolveMediaUrl, shouldAttachAuthToMediaUrl } from '@/utils/mediaUrl';

import useAudioPlayback from '@/hooks/useAudioPlayback';

const voiceBubbleLogger = createLogger('voice-bubble');

const formatDiagnosticMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return '';
  try {
    const serialized = JSON.stringify(meta);
    return serialized && serialized !== '{}' ? ` ${serialized}` : '';
  } catch (_error) {
    return '';
  }
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const formatDuration = (valueMs) => {
  const totalSeconds = Math.max(0, Math.floor((Number(valueMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  return resolveMediaUrl(rawUrl);
};

const getPrimaryAudioAttachment = (attachments = []) => attachments.find((attachment) => {
  const mime = String(attachment?.mime || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  const name = String(attachment?.url || attachment?.name || attachment?.uri || '').toLowerCase();
  return /\.(mp4|m4a|aac|mp3|wav|ogg|oga|webm)$/.test(name);
}) || null;

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
 * @param {string} [props.message]
 * @returns {import('react').ReactElement | null}
 */
function VoiceNoteBubble({
  attachments = [],
  composition,
  isMe = false,
  message = '',
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const audioAttachment = useMemo(() => getPrimaryAudioAttachment(attachments), [attachments]);
  const initialAudioUrl = useMemo(() => resolveAudioAttachmentUrl(attachments), [attachments]);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const messageText = String(message || '').trim();

  useEffect(() => {
    setAudioUrl(initialAudioUrl);
  }, [initialAudioUrl]);

  useEffect(() => {
    const attachmentId = Number(audioAttachment?.id);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) return undefined;

    let isCancelled = false;

    const refreshAudioUrl = async () => {
      try {
        const response = await client.get(`/upload/files/${attachmentId}`);
        const file = response?.data || {};
        const candidates = [
          file?.url,
          file?.formats?.large?.url,
          file?.formats?.medium?.url,
          file?.formats?.small?.url,
          file?.formats?.thumbnail?.url,
          file?.previewUrl,
          audioAttachment?.url,
          audioAttachment?.previewUrl,
          audioAttachment?.uri,
        ];

        for (let i = 0; i < candidates.length; i += 1) {
          const resolvedUrl = resolveMediaUrl(candidates[i]);
          if (resolvedUrl) {
            if (!isCancelled) {
              setAudioUrl(resolvedUrl);
            }
            return;
          }
        }
      } catch (error) {
        if (__DEV__) {
          voiceBubbleLogger.warn(`[voice-diag] bubble-audio-url-refresh-failed${formatDiagnosticMeta({
            attachmentId,
            error: error?.message || error,
          })}`);
        }
      }
    };

    refreshAudioUrl();

    return () => {
      isCancelled = true;
    };
  }, [audioAttachment?.id, audioAttachment?.previewUrl, audioAttachment?.uri, audioAttachment?.url]);

  const playbackHeaders = useMemo(() => {
    if (!shouldAttachAuthToMediaUrl(audioUrl)) return undefined;
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

  useEffect(() => {
    if (!__DEV__) return;
    if (audioUrl || attachments.length === 0) return;

    voiceBubbleLogger.warn(`[voice-diag] bubble-no-audio-url${formatDiagnosticMeta({
      attachmentCount: attachments.length,
      attachmentMimes: attachments.map((attachment) => String(attachment?.mime || '')),
      compositionType: composition?.type || '',
    })}`);
  }, [attachments, audioUrl, composition?.type]);

  useEffect(() => {
    if (!__DEV__ || !lastError) return;

    voiceBubbleLogger.warn(`[voice-diag] bubble-playback-error${formatDiagnosticMeta({
      audioUrl,
      error: lastError,
    })}`);
  }, [audioUrl, lastError]);

  const displayedDuration = durationMs || fallbackDuration;
  const waveformBars = useMemo(
    () => normalizeWaveformBars(composition?.waveform, displayedDuration),
    [composition?.waveform, displayedDuration],
  );

  const containerStyle = [
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
  ];

  if (!audioUrl) {
    return (
      <View style={containerStyle}>
        <View style={[Spaces.padding[12], { gap: 8 }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
            Note vocale indisponible
          </Text>
          {messageText ? (
            <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
              {messageText}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

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
      style={containerStyle}
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

        {messageText ? (
          <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
            {messageText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default VoiceNoteBubble;
