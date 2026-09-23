import i18next from 'i18next';
import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { canLoadNitroSoundModule } from '@/utils/audio/nitroSoundRuntime';
import { persistDiagnosticError } from '@/utils/bootDiagnostics';
import { createLogger } from '@/utils/logger/logger';

import {
  levelsToStoredWaveform,
  meteringToLevel,
  VOICE_ENCODING_BITRATE,
} from './voiceWaveform';

const voiceNoteLogger = createLogger('voice-note-service');

// VOCAL — LE VOCAL ENTIER, PAS SES 36 DERNIÈRES SECONDES.
// Le service gardait au plus 720 niveaux, coupés par la FIN (`slice(-720)`) :
// à un niveau toutes les 50 ms, un vocal d'une minute ne dessinait que sa
// dernière demi-minute, étirée sur toute la bulle. Mesuré par
// `__tests__/voiceNoteService.test.js` (témoin 4) : 4 barres hautes sur 12
// dans la première moitié d'une minute de voix suivie d'une minute de silence.
// Tous les niveaux sont désormais gardés ; au-delà du plafond (le double de la
// durée maximale d'une prise), on RÉDUIT par paires — le pic de chaque paire —
// au lieu de couper : la prise reste couverte d'un bout à l'autre.
const MAX_METERING_SAMPLES = 48000;
const WAVEFORM_POINTS = 24;
const WAVEFORM_BAR_MIN_HEIGHT = 4;
const WAVEFORM_BAR_MAX_HEIGHT = 20;

/** @type {any | null | undefined} */
let cachedAudioModule;
/** @type {any | null} */
let recorderInstance = null;
/**
 * @type {{
 *   durationMs: number; filePath: string; isBusy: boolean; isRecording: boolean;
 *   meteringSamples: number[]; recorderStart: string; recorderStartError: string;
 * }}
 */
let recordingSession = {
  durationMs: 0,
  filePath: '',
  isBusy: false,
  isRecording: false,
  meteringSamples: [],
  recorderStart: '',
  recorderStartError: '',
};

const safeRead = (resolver, context, fallback = null) => {
  try {
    return resolver();
  } catch (error) {
    if (context) {
      voiceNoteLogger.warn(context, { message: error?.message });
    }
    return fallback;
  }
};

const safeCall = (fn, thisArg, args, context, fallback = null) => {
  if (typeof fn !== 'function') return fallback;
  try {
    return fn.apply(thisArg, Array.isArray(args) ? args : []);
  } catch (error) {
    if (context) {
      voiceNoteLogger.warn(context, { message: error?.message });
    }
    return fallback;
  }
};

const reportVoiceNativeError = (error, phase) => {
  persistDiagnosticError(error, 'VOICE_NATIVE_ERROR', {
    isFatal: false,
  });
  voiceNoteLogger.warn('VOICE_NATIVE_ERROR', {
    message: error?.message || String(error || 'unknown'),
    phase,
  });
};

const hasRecorderApi = (candidate) => {
  if (!candidate) return false;
  const startRecorder = safeRead(
    () => candidate.startRecorder,
    'Recorder start API unavailable',
  );
  const stopRecorder = safeRead(
    () => candidate.stopRecorder,
    'Recorder stop API unavailable',
  );
  return typeof startRecorder === 'function' && typeof stopRecorder === 'function';
};

const getAudioModule = () => {
  if (cachedAudioModule !== undefined) return cachedAudioModule;
  if (!canLoadNitroSoundModule()) {
    cachedAudioModule = null;
    return cachedAudioModule;
  }
  try {
    // eslint-disable-next-line global-require
    cachedAudioModule = require('react-native-nitro-sound');
  } catch (error) {
    voiceNoteLogger.warn('Nitro Sound module unavailable', { message: error?.message });
    cachedAudioModule = null;
  }
  return cachedAudioModule;
};

const createRecorder = () => {
  const audioModule = getAudioModule();
  if (!audioModule) return null;

  const createdFromFactory = (() => {
    const createSound = safeRead(
      () => audioModule.createSound,
      'Nitro createSound unavailable',
    );
    if (typeof createSound === 'function') {
      return safeCall(
        createSound,
        audioModule,
        [],
        'Nitro createSound factory failed',
      );
    }

    const defaultExport = safeRead(
      () => audioModule.default,
      'Nitro default export unavailable',
    );
    const createSoundFromDefault = safeRead(
      () => defaultExport?.createSound,
      'Nitro default createSound unavailable',
    );
    if (typeof createSoundFromDefault === 'function') {
      return safeCall(
        createSoundFromDefault,
        defaultExport,
        [],
        'Nitro default createSound factory failed',
      );
    }
    return null;
  })();

  if (hasRecorderApi(createdFromFactory)) return createdFromFactory;
  if (hasRecorderApi(audioModule)) return audioModule;
  const defaultExport = safeRead(
    () => audioModule.default,
    'Nitro default recorder export unavailable',
  );
  if (hasRecorderApi(defaultExport)) return defaultExport;

  const soundExport = safeRead(
    () => audioModule.Sound,
    'Nitro Sound recorder export unavailable',
  );
  if (hasRecorderApi(soundExport)) return soundExport;
  return null;
};

// MSGLIVE — LE RYTHME DU MICRO, et pourquoi il vient de doubler.
//
// Le micro rendait compte toutes les 100 ms : dix mesures par seconde, donc une
// animation plafonnée à dix images par seconde, quoi qu'on fasse. C'était le
// bon réglage tant que chaque mesure redessinait l'écran de conversation TOUT
// ENTIER — 7 400 lignes, mesuré à 101 rendus pour cinq secondes de vocal.
//
// Depuis que les niveaux ne remontent plus jusqu'à l'écran et s'arrêtent dans
// l'onde (`voiceComposer/VoiceLiveWave`), une mesure ne coûte plus qu'une
// cinquantaine de petites vues, sur le fil d'animation. On peut donc en prendre deux fois plus : 50 ms, vingt images par
// seconde, une onde qui glisse au lieu de sauter. Le budget dépensé reste très
// en dessous de celui d'avant.
const RECORDER_TICK_SECONDS = 0.05;

const getRecorder = () => {
  if (recorderInstance) return recorderInstance;
  recorderInstance = safeRead(
    () => createRecorder(),
    'Failed to create Nitro recorder',
  );
  if (recorderInstance) {
    const setSubscriptionDuration = safeRead(
      () => recorderInstance.setSubscriptionDuration,
      'Recorder subscription setter unavailable',
    );
    safeCall(
      setSubscriptionDuration,
      recorderInstance,
      [RECORDER_TICK_SECONDS],
      'Recorder subscription setup failed',
    );
  }
  return recorderInstance;
};

const resetSession = () => {
  recordingSession = {
    durationMs: 0,
    filePath: '',
    isBusy: false,
    isRecording: false,
    meteringSamples: [],
    recorderStart: '',
    recorderStartError: '',
  };
};

const normalizePathForFs = (path) => {
  const value = String(path || '').trim();
  if (!value) return '';
  return value.startsWith('file://') ? value.slice(7) : value;
};

const asFileUri = (path) => {
  const raw = String(path || '').trim();
  if (!raw) return '';
  return raw.startsWith('file://') ? raw : `file://${raw}`;
};

const extractFileName = (path) => {
  const raw = String(path || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\/g, '/');
  const chunks = normalized.split('/');
  return chunks[chunks.length - 1] || '';
};

const getDefaultVoiceNoteExtension = (path) => {
  const fileName = extractFileName(path);
  const sanitized = String(fileName || '').split('?')[0].split('#')[0];
  const lastDotIndex = sanitized.lastIndexOf('.');
  if (lastDotIndex >= 0) {
    const extension = sanitized.slice(lastDotIndex + 1).trim().toLowerCase();
    if (extension) return extension;
  }
  return Platform.OS === 'android' ? 'mp4' : 'm4a';
};

const ensureRecordPermission = async () => {
  if (Platform.OS !== 'android') return true;
  const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (hasPermission) return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    buttonNegative: i18next.t('voiceNoteService.permission.deny', 'Refuser'),
    buttonPositive: i18next.t('voiceNoteService.permission.allow', 'Autoriser'),
    message: i18next.t(
      'voiceNoteService.permission.message',
      'FoundClub a besoin du micro pour enregistrer une note vocale.',
    ),
    title: i18next.t('voiceNoteService.permission.title', 'Autoriser le microphone'),
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const buildAudioSet = () => {
  const audioModule = getAudioModule();
  return {
    AudioChannels: 1,
    AudioEncoderAndroid: safeRead(
      () => audioModule?.AudioEncoderAndroidType?.AAC,
      'Recorder Android encoder constant unavailable',
      3,
    ) ?? 3,
    AudioEncodingBitRate: VOICE_ENCODING_BITRATE,
    AudioQuality: 'high',
    AudioSamplingRate: 44100,
    AudioSourceAndroid: safeRead(
      () => audioModule?.AudioSourceAndroidType?.MIC,
      'Recorder Android source constant unavailable',
      1,
    ) ?? 1,
    AVEncoderAudioQualityKeyIOS: safeRead(
      () => audioModule?.AVEncoderAudioQualityIOSType?.high,
      'Recorder iOS quality constant unavailable',
      96,
    ) ?? 96,
    AVEncodingOptionIOS: 'aac',
    AVFormatIDKeyIOS: 'aac',
    AVModeIOS: 'measurement',
    AVNumberOfChannelsKeyIOS: 1,
    AVSampleRateKeyIOS: 44100,
    OutputFormatAndroid: safeRead(
      () => audioModule?.OutputFormatAndroidType?.MPEG_4,
      'Recorder Android output format constant unavailable',
      2,
    ) ?? 2,
  };
};

const buildRecordingPath = () => {
  const baseDir = ReactNativeBlobUtil?.fs?.dirs?.CacheDir
    || ReactNativeBlobUtil?.fs?.dirs?.DocumentDir
    || '';
  if (!baseDir) return '';
  const extension = Platform.OS === 'android' ? 'mp4' : 'm4a';
  return `${baseDir}/voice-note-${Date.now()}.${extension}`;
};

const pushMeteringSample = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return;
  const clamped = Math.max(-160, Math.min(0, numericValue));
  recordingSession.meteringSamples.push(clamped);
  if (recordingSession.meteringSamples.length > MAX_METERING_SAMPLES) {
    const echantillons = recordingSession.meteringSamples;
    const reduits = [];
    for (let rang = 0; rang < echantillons.length; rang += 2) {
      reduits.push(Math.max(echantillons[rang], echantillons[rang + 1] ?? -160));
    }
    recordingSession.meteringSamples = reduits;
  }
};

const downsampleWaveform = (samples, targetCount = WAVEFORM_POINTS) => {
  const source = Array.isArray(samples) ? samples.filter((sample) => Number.isFinite(Number(sample))) : [];
  if (source.length === 0) return [];
  if (source.length <= targetCount) return source;

  const bucketSize = source.length / targetCount;
  const bars = [];
  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    const bucket = source.slice(start, end);
    const loudest = bucket.reduce((maxValue, currentValue) => Math.max(maxValue, Number(currentValue)), -160);
    bars.push(loudest);
  }
  return bars;
};

const normalizeWaveformToHeights = (samples) => {
  const numericSamples = Array.isArray(samples)
    ? samples.map((sample) => Number(sample)).filter((sample) => Number.isFinite(sample))
    : [];
  if (numericSamples.length < 8) return [];

  const min = Math.min(...numericSamples);
  const max = Math.max(...numericSamples);
  const range = max - min;
  if (!Number.isFinite(range) || range < 0.6) return [];

  return numericSamples.map((sample) => {
    const ratio = Math.max(0, Math.min(1, (sample - min) / range));
    return Math.round(WAVEFORM_BAR_MIN_HEIGHT + (ratio * (WAVEFORM_BAR_MAX_HEIGHT - WAVEFORM_BAR_MIN_HEIGHT)));
  });
};

const buildMeteringDiagnostics = (samples, waveformSource) => {
  const numericSamples = Array.isArray(samples)
    ? samples.map((sample) => Number(sample)).filter((sample) => Number.isFinite(sample))
    : [];
  // VOCAL-MICRO : quel démarrage a pris, et pourquoi le premier a raté.
  const demarrage = {
    recorderStart: recordingSession.recorderStart,
    recorderStartError: recordingSession.recorderStartError,
  };

  if (numericSamples.length === 0) {
    return {
      maxDb: null,
      minDb: null,
      rangeDb: 0,
      sampleCount: 0,
      waveformSource,
      ...demarrage,
    };
  }

  const minDb = Math.min(...numericSamples);
  const maxDb = Math.max(...numericSamples);
  return {
    maxDb,
    minDb,
    rangeDb: maxDb - minDb,
    sampleCount: numericSamples.length,
    waveformSource,
    ...demarrage,
  };
};

// VOCAL-MICRO — LA MESURE N'EST JAMAIS SACRIFIÉE (recette d'Adel, 23/09).
// Le 3e argument de `startRecorder` allume la mesure du micro : sur iPhone,
// `isMeteringEnabled` (nitro-sound 0.2.10, `ios/Sound.swift:139`) ; sans lui,
// `averagePower` rend −160 dB à chaque tick (l. 886-898). L'ancien repli
// retentait SANS ce 3e argument : un premier démarrage raté, et le vocal
// partait muet de bout en bout — onde vivante immobile, onde enregistrée de
// secours (le même sinus sur tous les vocaux d'Adel du 23/09).
// Chaque essai garde maintenant la mesure ; seuls les RÉGLAGES s'allègent :
// sans le mode de session iOS « measurement », puis sans aucun réglage. Le
// démarrage retenu et la première erreur voyagent dans `diagnostics`, jusqu'à
// la `composition` du message : le prochain vocal raté se lira en base.
// Témoin : `__tests__/voiceNoteService.contratNatif.test.js`.
/**
 * Les trois démarrages, du plus complet au plus nu : la mesure reste allumée à chacun.
 * @type {Array<[string, (audioSet: any) => any]>}
 */
const ESSAIS_DE_DEMARRAGE = [
  ['full', (audioSet) => audioSet],
  ['noIosMode', ({ AVModeIOS, ...reglages }) => reglages],
  ['defaults', () => undefined],
];
/** Au plus 160 caractères d'erreur voyagent avec le message. */
const LONGUEUR_ERREUR_DEMARRAGE = 160;

/**
 * Démarre le micro, mesure allumée, en allégeant les réglages à chaque échec.
 * @param {any} recorder - L'enregistreur natif.
 * @param {string} filePath - Le fichier à écrire.
 * @param {any} audioSet - Tous nos réglages.
 * @returns {Promise<{ essai: string, premiereErreur: any }>} Le démarrage retenu.
 */
const demarrerAvecMesure = async (recorder, filePath, audioSet) => {
  let premiereErreur = null;
  let derniereErreur = null;
  for (let rang = 0; rang < ESSAIS_DE_DEMARRAGE.length; rang += 1) {
    const [essai, reglages] = ESSAIS_DE_DEMARRAGE[rang];
    try {
      // Un essai après l'autre : jamais deux démarrages du micro en même temps.
      // eslint-disable-next-line no-await-in-loop
      await recorder.startRecorder(filePath, reglages(audioSet), true);
      return { essai, premiereErreur };
    } catch (erreur) {
      premiereErreur = premiereErreur || erreur;
      derniereErreur = erreur;
      voiceNoteLogger.warn('startRecorder failed, retrying with lighter settings (metering kept)', {
        essai,
        message: /** @type {any} */ (erreur)?.message,
      });
    }
  }
  throw derniereErreur;
};

const buildFallbackWaveform = (durationMs) => {
  const safeDuration = Math.max(1, Number(durationMs) || 0);
  return Array.from({ length: WAVEFORM_POINTS }, (_, index) => {
    const ratio = index / Math.max(1, WAVEFORM_POINTS - 1);
    const wave = (Math.sin((ratio * Math.PI * 1.9) + 0.7) + 1) / 2;
    const durationShift = (((safeDuration / 1000) % 6) / 6) * 0.15;
    const normalized = Math.max(0, Math.min(1, wave + durationShift));
    return Math.round(
      WAVEFORM_BAR_MIN_HEIGHT + (normalized * (WAVEFORM_BAR_MAX_HEIGHT - WAVEFORM_BAR_MIN_HEIGHT)),
    );
  });
};

export const isVoiceNoteRecordingSupported = () => safeRead(
  () => Boolean(getRecorder()),
  'Voice note capability check failed',
  false,
);

/**
 * @param {{
 *   onProgress?: (durationMs: number) => void;
 *   onMetering?: (metering: number | null, durationMs: number) => void;
 * }} [params]
 * @returns {Promise<{ filePath: string }>}
 */
export const startRecording = async (params = {}) => {
  const recorder = getRecorder();
  if (!recorder) throw new Error('VOICE_MODULE_UNAVAILABLE');
  if (recordingSession.isBusy || recordingSession.isRecording) throw new Error('VOICE_ALREADY_RECORDING');

  recordingSession = {
    durationMs: 0,
    filePath: '',
    isBusy: true,
    isRecording: false,
    meteringSamples: [],
    recorderStart: '',
    recorderStartError: '',
  };

  const hasPermission = await ensureRecordPermission();
  if (!hasPermission) {
    resetSession();
    throw new Error('VOICE_PERMISSION_DENIED');
  }

  const filePath = buildRecordingPath();
  if (!filePath) {
    resetSession();
    throw new Error('VOICE_CACHE_DIR_UNAVAILABLE');
  }

  recordingSession = {
    ...recordingSession,
    filePath,
  };

  recorder.removeRecordBackListener?.();
  recorder.addRecordBackListener?.((recordEvent) => {
    const durationMs = Math.max(0, Number(recordEvent?.currentPosition) || 0);
    recordingSession.durationMs = durationMs;
    params?.onProgress?.(durationMs);

    const rawMetering = Number(recordEvent?.currentMetering);
    const metering = Number.isFinite(rawMetering) ? rawMetering : null;
    if (metering !== null) {
      pushMeteringSample(metering);
    }
    params?.onMetering?.(metering, durationMs);
  });

  try {
    const { essai, premiereErreur } = await demarrerAvecMesure(recorder, filePath, buildAudioSet());
    recordingSession.recorderStart = essai;
    recordingSession.recorderStartError = String(premiereErreur?.message || '')
      .slice(0, LONGUEUR_ERREUR_DEMARRAGE);

    recordingSession.isRecording = true;
    recordingSession.isBusy = false;
    return { filePath };
  } catch (error) {
    recorder.removeRecordBackListener?.();
    resetSession();
    reportVoiceNativeError(error, 'start');
    throw error;
  }
};

/**
 * @returns {Promise<{
 *   uri: string;
 *   fileName: string;
 *   mime: string;
 *   size: number;
 *   durationMs: number;
 *   levels: number[];
 *   waveform: number[];
 *   diagnostics?: {
 *     maxDb: number | null;
 *     minDb: number | null;
 *     rangeDb: number;
 *     sampleCount: number;
 *     waveformSource: 'metering' | 'fallback';
 *     recorderStart: string;
 *     recorderStartError: string;
 *   };
 * }>}
 */
export const stopRecording = async () => {
  const recorder = getRecorder();
  if (!recorder) throw new Error('VOICE_MODULE_UNAVAILABLE');
  if (!recordingSession.isRecording && !recordingSession.filePath) throw new Error('VOICE_NOT_RECORDING');
  if (recordingSession.isBusy) throw new Error('VOICE_BUSY');

  recordingSession.isBusy = true;
  let stoppedPath = '';
  try {
    stoppedPath = await recorder.stopRecorder();
  } catch (error) {
    reportVoiceNativeError(error, 'stop');
    throw new Error('VOICE_STOP_FAILED');
  } finally {
    recorder.removeRecordBackListener?.();
    recordingSession.isRecording = false;
    recordingSession.isBusy = false;
  }

  const finalPath = String(stoppedPath || recordingSession.filePath || '').trim();
  if (!finalPath) {
    resetSession();
    throw new Error('VOICE_FILE_NOT_FOUND');
  }

  const normalizedPath = normalizePathForFs(finalPath);
  let size = 0;
  if (normalizedPath) {
    try {
      const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
      if (exists) {
        const stat = await ReactNativeBlobUtil.fs.stat(normalizedPath);
        size = Math.max(0, Number(stat?.size) || 0);
      }
    } catch (_error) {
      size = 0;
    }
  }

  const durationMs = Math.max(0, recordingSession.durationMs || 0);
  // Le micro a-t-il vraiment mesuré quelque chose ? Même critère qu'avant
  // (au moins 8 niveaux, un écart d'au moins 0,6 dB) : sinon, l'onde de repli.
  const compactWaveform = downsampleWaveform(recordingSession.meteringSamples, WAVEFORM_POINTS);
  const hasMetering = normalizeWaveformToHeights(compactWaveform).length > 0;
  const waveformSource = hasMetering ? 'metering' : 'fallback';
  const levels = hasMetering ? recordingSession.meteringSamples.map(meteringToLevel) : [];
  const response = {
    diagnostics: buildMeteringDiagnostics(recordingSession.meteringSamples, waveformSource),
    durationMs,
    fileName: extractFileName(finalPath) || `voice-note-${Date.now()}.${getDefaultVoiceNoteExtension(finalPath)}`,
    levels,
    mime: 'audio/mp4',
    size,
    uri: asFileUri(finalPath),
    waveform: hasMetering ? levelsToStoredWaveform(levels) : buildFallbackWaveform(durationMs),
  };

  if (!Number.isFinite(size) || size <= 0) {
    resetSession();
    throw new Error('VOICE_FILE_EMPTY');
  }

  resetSession();
  return response;
};

/**
 * @returns {Promise<void>}
 */
export const cancelRecording = async () => {
  const recorder = getRecorder();
  if (!recorder) return;
  if (!recordingSession.isRecording && !recordingSession.filePath) return;

  const pendingPath = String(recordingSession.filePath || '').trim();
  recordingSession.isBusy = true;

  if (recordingSession.isRecording) {
    try {
      await recorder.stopRecorder();
    } catch (_error) {
      // Best effort cleanup.
    }
  }

  recorder.removeRecordBackListener?.();
  const normalizedPath = normalizePathForFs(pendingPath);
  if (normalizedPath) {
    try {
      const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
      if (exists) {
        await ReactNativeBlobUtil.fs.unlink(normalizedPath);
      }
    } catch (_error) {
      // Best effort cleanup.
    }
  }

  resetSession();
};

export const deleteVoiceNoteFile = async (uriOrPath) => {
  const normalizedPath = normalizePathForFs(uriOrPath);
  if (!normalizedPath) return;

  try {
    const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
    if (exists) {
      await ReactNativeBlobUtil.fs.unlink(normalizedPath);
    }
  } catch (_error) {
    // Best effort cleanup.
  }
};

export const getRecordingDuration = () => recordingSession.durationMs;
