import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import useAudioPlayback from '@/hooks/useAudioPlayback';

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
    const name = String(attachment?.url || attachment?.name || '').toLowerCase();
    return /\.(m4a|aac|mp3|wav|ogg|oga|webm)$/.test(name);
  });

  const rawUrl = audioAttachment?.url || '';
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http')) return rawUrl;
  return `${process.env.API_URL || 'http://10.0.2.2:1337'}${rawUrl}`;
};

/**
 * Voice note message bubble.
 *
 * @param {object} props
 * @param {any} props.composition
 * @param {Array<{ url?: string; mime?: string; name?: string }>} [props.attachments]
 * @param {boolean} [props.isMe]
 * @returns {import('react').ReactElement | null}
 */
function VoiceNoteBubble({
  attachments = [],
  composition,
  isMe = false,
}) {
  const { Colors, Fonts } = useTheme();
  const audioUrl = resolveAudioAttachmentUrl(attachments);
  const fallbackDuration = Number(composition?.durationMs) || 0;

  const {
    cycleSpeed,
    durationMs,
    isPlayerAvailable,
    isPlaying,
    progress,
    speed,
    togglePlayback,
  } = useAudioPlayback({ sourceUrl: audioUrl });

  const displayedDuration = durationMs || fallbackDuration;

  if (!audioUrl) return null;

  return (
    <View
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        backgroundColor: 'rgba(20, 39, 52, 0.92)',
        borderColor: 'rgba(1,179,244,0.35)',
        borderRadius: 14,
        borderWidth: 1,
        marginVertical: 6,
        maxWidth: '90%',
        minWidth: 260,
        overflow: 'hidden',
      }}
    >
      <View style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          Note vocale
        </Text>

        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          <TouchableOpacity
            onPress={togglePlayback}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(1,179,244,0.18)',
              borderColor: 'rgba(1,179,244,0.45)',
              borderRadius: 20,
              borderWidth: 1,
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              {isPlaying ? '||' : '>'}
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 999,
                height: 8,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <View
                style={{
                  backgroundColor: Colors.primary500,
                  borderRadius: 999,
                  height: 8,
                  width: `${Math.round((progress || 0) * 100)}%`,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {formatDuration(displayedDuration)}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {isPlayerAvailable ? 'Lecteur integre' : 'Lecteur systeme'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        style={{
          alignItems: 'center',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 9,
        }}
      >
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          v1
        </Text>
        <TouchableOpacity onPress={cycleSpeed}>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            x
            {speed}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default VoiceNoteBubble;
