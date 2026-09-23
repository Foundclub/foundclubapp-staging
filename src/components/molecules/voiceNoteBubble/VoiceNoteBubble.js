import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { useVoiceListened } from '@/domains/messaging/voiceListenedStore';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import useVoiceProgress from '@/components/molecules/voiceWave/useVoiceProgress';
import VoiceStaticWave from '@/components/molecules/voiceWave/VoiceStaticWave';
import { easeIn, easeOut, VOICE_EASE_OUT } from '@/components/organisms/voiceComposer/voiceMotion';

import {
  bucketPeaks,
  formatVoiceClock,
  formatVoiceSpeed,
  storedWaveformToLevels,
  VOICE_BUBBLE_BARS,
} from '@/services/chat/voiceWaveform';
import client from '@/services/client';

import { createLogger } from '@/utils/logger/logger';
import { resolveMediaUrl, shouldAttachAuthToMediaUrl } from '@/utils/mediaUrl';

import useAudioPlayback from '@/hooks/useAudioPlayback';

// VOCAL — LA BULLE D'UN MESSAGE VOCAL (maquette de Claude Design, états 4 et 5, M4).
//
// 280 de large, TOUJOURS (la largeur ne dit rien de la durée), rayon 20 et
// coin d'attache 6, 62 de haut : lecture Ø 44 · 31 barres (3 px, pas 5) ·
// temps 12/700 · point « non écouté » · vitesse 42 × 24. Moi : fond cyan,
// encre sombre (8,0:1). Un autre : fond primary700, barres lues en cyan, son
// nom au-dessus. L'heure est dessous, « Envoi… » tant que le serveur n'a pas
// répondu.
//
// L'onde vient de celle enregistrée avec le message (`composition.waveform`,
// 4 → 20, lisible par toutes les versions), relue en niveaux puis réduite à
// 31 pics normalisés : les anciens vocaux (24 valeurs) s'affichent aussi.

const voiceBubbleLogger = createLogger('voice-bubble');

const PAS = 5;
const LARGEUR_BARRE = 3;

/**
 * Les diagnostics du lecteur, en une ligne.
 * @param {unknown} meta - Ce qu'on veut journaliser.
 * @returns {string} La ligne.
 */
const formatDiagnosticMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return '';
  try {
    const serialized = JSON.stringify(meta);
    return serialized && serialized !== '{}' ? ` ${serialized}` : '';
  } catch (_error) {
    return '';
  }
};

/**
 * La pièce jointe audio d'un message.
 * @param {any[]} attachments - Les pièces jointes.
 * @returns {any | null} La pièce audio.
 */
const getPrimaryAudioAttachment = (attachments = []) => attachments.find((attachment) => {
  const mime = String(attachment?.mime || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  const name = String(attachment?.url || attachment?.name || attachment?.uri || '').toLowerCase();
  return /\.(mp4|m4a|aac|mp3|wav|ogg|oga|webm)$/.test(name);
}) || null;

/**
 * L'adresse du fichier audio d'un message.
 * @param {any[]} attachments - Les pièces jointes.
 * @returns {string} L'adresse (vide s'il n'y en a pas).
 */
const resolveAudioAttachmentUrl = (attachments = []) => {
  const audioAttachment = getPrimaryAudioAttachment(attachments);
  const rawUrl = String(
    audioAttachment?.url
    || audioAttachment?.uri
    || audioAttachment?.previewUrl
    || '',
  ).trim();
  if (!rawUrl) return '';
  return resolveMediaUrl(rawUrl);
};

/**
 * L'heure du message, à la façon de la langue (14:32).
 * @param {unknown} creeLe - La date du message.
 * @returns {string} L'heure, ou rien.
 */
const heureDuMessage = (creeLe) => {
  const date = new Date(/** @type {any} */ (creeLe));
  if (!creeLe || Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleTimeString(localeDesFormats(), { hour: '2-digit', minute: '2-digit' });
  } catch (_erreur) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
};

/**
 * Les couleurs d'une bulle : la mienne (cyan, encre sombre) ou celle d'un autre.
 * @param {any} Colors - Les couleurs du thème.
 * @param {boolean} aMoi - La bulle est-elle à moi.
 * @returns {Record<string, string>} La palette.
 */
const palette = (Colors, aMoi) => (aMoi ? {
  fond: Colors.primary500,
  lecture: Colors.primary900,
  lectureEncre: Colors.primary500,
  lu: Colors.primary900,
  nonLu: withAlpha(Colors.primary900, 0.3),
  point: Colors.primary900,
  temps: Colors.primary900,
  tempsEcoule: Colors.primary900,
  vitesse: withAlpha(Colors.primary900, 0.12),
  vitesseActive: Colors.primary900,
  vitesseEncre: Colors.primary900,
  vitesseEncreActive: Colors.primary500,
} : {
  fond: Colors.primary700,
  lecture: Colors.primary500,
  lectureEncre: Colors.primary900,
  lu: Colors.primary500,
  nonLu: withAlpha(Colors.neutral00, 0.38),
  point: Colors.primary500,
  temps: Colors.neutral300,
  tempsEcoule: Colors.neutral00,
  vitesse: withAlpha(Colors.neutral00, 0.1),
  vitesseActive: Colors.primary500,
  vitesseEncre: Colors.neutral00,
  vitesseEncreActive: Colors.primary900,
});

/**
 * L'entrée d'une bulle que je viens d'envoyer : elle monte de 16, grandit de
 * 0,96 à 1 (350 ms) et apparaît (200 ms), depuis son coin bas droit.
 * @returns {any} L'animation d'entrée, pour Reanimated.
 */
const entreeBulle = () => {
  'worklet';

  return {
    animations: {
      opacity: withTiming(1, { duration: 200, easing: VOICE_EASE_OUT }),
      transform: [
        { translateY: withTiming(0, { duration: 350, easing: VOICE_EASE_OUT }) },
        { scale: withTiming(1, { duration: 350, easing: VOICE_EASE_OUT }) },
      ],
    },
    initialValues: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.96 }] },
  };
};

/**
 * La bulle d'un message vocal.
 * @param {object} props
 * @param {any} props.composition - La composition du message (durée, onde).
 * @param {Array<{ id?: number, url?: string; uri?: string; mime?: string; name?: string, previewUrl?: string }>} [props.attachments]
 * @param {unknown} [props.createdAt] - La date du message.
 * @param {boolean} [props.isMe] - Le message est-il à moi.
 * @param {boolean} [props.isPending] - Le serveur ne l'a pas encore confirmé.
 * @param {string} [props.message] - Le texte joint (vocaux envoyés par d'anciennes versions).
 * @param {string} [props.messageId] - L'identifiant du message (point « non écouté »).
 * @param {string} [props.senderName] - Le nom de l'auteur, à afficher au-dessus.
 * @returns {import('react').ReactElement | null}
 */
function VoiceNoteBubble({
  attachments = [],
  composition,
  createdAt,
  isMe = false,
  isPending = false,
  message = '',
  messageId = '',
  senderName = '',
}) {
  const { Colors, Fonts } = useTheme();
  const { i18n, t } = useTranslation();
  const couleurs = palette(Colors, isMe);

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
            error: /** @type {any} */ (error)?.message || error,
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
    const token = /** @type {any} */ (getAuthTokens())?.token;
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  }, [audioUrl]);

  const {
    cycleSpeed,
    durationMs,
    endedAt,
    isLoading,
    isPlayerAvailable,
    isPlaying,
    lastError,
    positionMs,
    speed,
    togglePlayback,
  } = useAudioPlayback({
    headers: playbackHeaders,
    sourceUrl: audioUrl,
  });

  useEffect(() => {
    if (!__DEV__ || !lastError) return;
    voiceBubbleLogger.warn(`[voice-diag] bubble-playback-error${formatDiagnosticMeta({
      audioUrl,
      error: lastError,
    })}`);
  }, [audioUrl, lastError]);

  const totalMs = Math.max(0, Number(durationMs) || Number(composition?.durationMs) || 0);
  const positionAffichee = Math.min(Number(positionMs) || 0, totalMs || Number(positionMs) || 0);
  const vitesse = Number(speed) || 1;
  const { opaciteLue, progression } = useVoiceProgress({
    dureeMs: totalMs,
    enLecture: Boolean(isPlaying),
    finiLe: Number(endedAt) || 0,
    positionMs: Number(positionMs) || 0,
    vitesse,
  });

  // 31 pics normalisés, calculés une fois par message.
  const niveaux = useMemo(
    () => bucketPeaks(storedWaveformToLevels(composition?.waveform), VOICE_BUBBLE_BARS),
    [composition?.waveform],
  );

  // Le point « non écouté » : seulement sur les vocaux des autres (question 1).
  const [nonEcoute, marquerEcoute] = useVoiceListened(isMe ? '' : String(messageId || ''), createdAt);
  const pointVisible = useSharedValue(nonEcoute ? 1 : 0);
  useEffect(() => {
    if (!isPlaying || !nonEcoute) return;
    // Opacity → 0, scale 1 → 0,4 (200 ms easeIn), au démarrage de la lecture.
    pointVisible.value = easeIn(0, 200);
    marquerEcoute();
  }, [isPlaying, marquerEcoute, nonEcoute, pointVisible]);
  const point = useAnimatedStyle(() => ({
    opacity: pointVisible.value,
    transform: [{ scale: 0.4 + (0.6 * pointVisible.value) }],
  }));

  // ▶ ↔ ❚❚ : fondu croisé + scale 0,8 → 1 (120 ms easeOut).
  const lecture = useSharedValue(0);
  useEffect(() => {
    lecture.value = easeOut(isPlaying ? 1 : 0, 120);
  }, [isPlaying, lecture]);
  const triangle = useAnimatedStyle(() => ({
    opacity: 1 - lecture.value,
    transform: [{ scale: 1 - (0.2 * lecture.value) }],
  }));
  const barresPause = useAnimatedStyle(() => ({
    opacity: lecture.value,
    transform: [{ scale: 0.8 + (0.2 * lecture.value) }],
  }));

  // Une bulle que je viens d'envoyer entre en scène ; les autres sont déjà là.
  const nouvelle = useRef(Boolean(isMe && isPending)).current;

  if (!audioUrl) {
    return (
      <View style={[styles.bulle, isMe ? styles.coinMoi : styles.coinAutre, { backgroundColor: couleurs.fond }]}>
        <Text style={[Fonts.p3Bold, { color: isMe ? Colors.primary900 : Colors.error300 }]}>
          {t('voiceNoteBubble.unavailable', 'Note vocale indisponible')}
        </Text>
        {messageText ? (
          <Text style={[Fonts.p3, styles.texteJoint, { color: couleurs.temps }]}>
            {messageText}
          </Text>
        ) : null}
      </View>
    );
  }

  const secondes = Math.round(totalMs / 1000);
  const duree = t('voiceNoteBubble.seconds', {
    count: secondes,
    defaultValue_one: '{{count}} seconde',
    defaultValue_other: '{{count}} secondes',
  });
  let libelleLecture = isMe
    ? t('voiceNoteBubble.mine', { defaultValue: 'Mon message vocal, {{duration}}', duration: duree })
    : t('voiceNoteBubble.from', {
      defaultValue: 'Message vocal de {{name}}, {{duration}}',
      duration: duree,
      name: senderName || t('voiceNoteBubble.someone', 'quelqu\'un'),
    });
  if (nonEcoute) libelleLecture = `${libelleLecture}, ${t('voiceNoteBubble.unlistened', 'non écouté')}`;
  if (isPlaying) libelleLecture = t('voiceNoteBubble.pause', 'Mettre en pause');

  const separateur = String(i18n?.language || 'fr').startsWith('en') ? '.' : ',';
  const vitesseActive = vitesse !== 1;
  const prochaine = [1, 1.5, 2][([1, 1.5, 2].indexOf(vitesse) + 1) % 3];
  const aCommence = Boolean(isPlaying) || positionAffichee > 0;
  const heure = heureDuMessage(createdAt);

  return (
    <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      {!isMe && senderName ? (
        <Text numberOfLines={1} style={[Fonts.p3Bold, styles.nom, { color: Colors.neutral300 }]}>
          {senderName}
        </Text>
      ) : null}
      <Animated.View
        entering={nouvelle ? entreeBulle : undefined}
        style={[styles.bulle, isMe ? styles.coinMoi : styles.coinAutre, { backgroundColor: couleurs.fond }]}
        testID="voice-note-bubble"
      >
        <View style={styles.rangee}>
          <Pressable
            accessibilityLabel={libelleLecture}
            accessibilityRole="button"
            disabled={!isPlayerAvailable || isLoading}
            onPress={togglePlayback}
            style={[styles.lecture, { backgroundColor: couleurs.lecture }]}
            testID="voice-note-play"
          >
            {isLoading ? (
              <ActivityIndicator color={couleurs.lectureEncre} size="small" />
            ) : (
              <>
                <Animated.View style={[StyleSheet.absoluteFill, styles.centre, triangle]}>
                  <GlyphIcon color={couleurs.lectureEncre} name="play" size={24} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, styles.centre, barresPause]}>
                  <GlyphIcon color={couleurs.lectureEncre} name="pause" size={24} />
                </Animated.View>
              </>
            )}
          </Pressable>

          <View style={styles.colonne}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.onde}
            >
              <VoiceStaticWave
                couleurLue={couleurs.lu}
                couleurNonLue={couleurs.nonLu}
                largeurBarre={LARGEUR_BARRE}
                montee={nouvelle ? { duree: 180, pas: 6 } : null}
                niveaux={niveaux}
                opaciteLue={opaciteLue}
                pas={PAS}
                progression={progression}
              />
            </View>
            <View style={styles.ligneTemps}>
              <Text style={[Fonts.p3Bold, styles.temps, { color: couleurs.temps }]} testID="voice-note-time">
                {aCommence ? (
                  <>
                    <Text style={{ color: couleurs.tempsEcoule }}>{formatVoiceClock(positionAffichee)}</Text>
                    {` / ${formatVoiceClock(totalMs)}`}
                  </>
                ) : formatVoiceClock(totalMs)}
              </Text>
              {nonEcoute ? (
                <Animated.View
                  style={[styles.point, { backgroundColor: couleurs.point }, point]}
                  testID="voice-note-unlistened"
                />
              ) : null}
            </View>
          </View>

          <Pressable
            accessibilityHint={t('voiceNoteBubble.speedHint', {
              defaultValue: 'Touche deux fois pour passer à {{next}} fois.',
              next: String(prochaine).replace('.', separateur),
            })}
            accessibilityLabel={t('voiceNoteBubble.speed', {
              defaultValue: 'Vitesse de lecture : {{speed}} fois',
              speed: String(vitesse).replace('.', separateur),
            })}
            accessibilityRole="button"
            hitSlop={{ bottom: 10, top: 10 }}
            onPress={cycleSpeed}
            style={[styles.vitesse, {
              backgroundColor: vitesseActive ? couleurs.vitesseActive : couleurs.vitesse,
            }]}
            testID="voice-note-speed"
          >
            <Text style={[Fonts.p3Bold, {
              color: vitesseActive ? couleurs.vitesseEncreActive : couleurs.vitesseEncre,
              lineHeight: 16,
            }]}
            >
              {formatVoiceSpeed(vitesse, separateur)}
            </Text>
          </Pressable>
        </View>

        {!isPlayerAvailable ? (
          <Text style={[Fonts.p4, styles.texteJoint, { color: couleurs.temps }]}>
            {t('voiceNoteBubble.playbackUnavailable', 'Lecture audio indisponible sur cette build.')}
          </Text>
        ) : null}
        {lastError ? (
          <Text style={[Fonts.p4, styles.texteJoint, { color: couleurs.temps }]}>
            {lastError}
          </Text>
        ) : null}
        {messageText ? (
          <Text style={[Fonts.p3, styles.texteJoint, { color: couleurs.tempsEcoule }]}>
            {messageText}
          </Text>
        ) : null}
      </Animated.View>
      <View style={[styles.pied, isMe ? styles.piedMoi : styles.piedAutre]}>
        <Text style={[Fonts.small, { color: Colors.neutral400 }]} testID="voice-note-hour">
          {isPending ? t('voiceNoteBubble.sending', 'Envoi…') : heure}
        </Text>
        {isMe && !isPending ? <GlyphIcon color={Colors.neutral400} name="checkDouble" size={14} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bulle: {
    borderRadius: 20,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 10,
    paddingTop: 8,
    // ⚠️ Pas de `transformOrigin` pour l'entrée depuis le coin bas droit : le
    // léger 0,96 → 1 se voit à peine, et l'origine n'est pas animable partout.
    width: 280,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinAutre: {
    borderBottomLeftRadius: 6,
  },
  coinMoi: {
    borderBottomRightRadius: 6,
  },
  colonne: {
    flex: 1,
    gap: 2,
  },
  lecture: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  ligneTemps: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 16,
  },
  nom: {
    marginBottom: 4,
    marginLeft: 12,
  },
  onde: {
    height: 28,
    justifyContent: 'center',
  },
  pied: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  piedAutre: {
    marginLeft: 12,
  },
  piedMoi: {
    marginRight: 12,
  },
  point: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  rangee: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  temps: {
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
  texteJoint: {
    marginTop: 6,
  },
  vitesse: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 42,
  },
});

export default VoiceNoteBubble;
