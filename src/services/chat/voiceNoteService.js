import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { createLogger } from '@/utils/logger/logger';

const voiceNoteLogger = createLogger('voice-note-service');

const MAX_METERING_SAMPLES = 720;
const WAVEFORM_POINTS = 24;
const WAVEFORM_BAR_MIN_HEIGHT = 4;
const WAVEFORM_BAR_MAX_HEIGHT = 20;

/** @type {any | null | undefined} */
let cachedAudioModule;
/** @type {any | null} */
let recorderInstance = null;
/** @type {{ durationMs: number; filePath: string; isBusy: boolean; isRecording: boolean; meteringSamples: number[] }} */
let recordingSession = {
  durationMs: 0,
  filePath: '',
  isBusy: false,
  isRecording: false,
  meteringSamples: [],
};

const hasRecorderApi = (candidate) => (
  !!candidate
  && typeof candidate.startRecorder === 'function'
  && typeof candidate.stopRecorder === 'function'
);

const getAudioModule = () => {
  if (cachedAudioModule !== undefined) return cachedAudioModule;
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
    if (typeof audioModule?.createSound === 'function') {
      try {
        return audioModule.createSound();
      } catch (_error) {
        return null;
      }
    }
    if (typeof audioModule?.default?.createSound === 'function') {
      try {
        return audioModule.default.createSound();
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  if (hasRecorderApi(createdFromFactory)) return createdFromFactory;
  if (hasRecorderApi(audioModule)) return audioModule;
  if (hasRecorderApi(audioModule?.default)) return audioModule.default;
  if (hasRecorderApi(audioModule?.Sound)) return audioModule.Sound;
  return null;
};

const getRecorder = () => {
  if (recorderInstance) return recorderInstance;
  recorderInstance = createRecorder();
  if (recorderInstance) {
    recorderInstance.setSubscriptionDuration?.(0.1);
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

const ensureRecordPermission = async () => {
  if (Platform.OS !== 'android') return true;
  const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (hasPermission) return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    buttonNegative: 'Refuser',
    buttonPositive: 'Autoriser',
    message: 'FoundClub a besoin du micro pour enregistrer une note vocale.',
    title: 'Autoriser le microphone',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const buildAudioSet = () => {
  const audioModule = getAudioModule();
  return {
    AudioChannels: 1,
    AudioEncoderAndroid: audioModule?.AudioEncoderAndroidType?.AAC ?? 3,
    AudioEncodingBitRate: 128000,
    AudioQuality: 'high',
    AudioSamplingRate: 44100,
    AudioSourceAndroid: audioModule?.AudioSourceAndroidType?.MIC ?? 1,
    AVEncoderAudioQualityKeyIOS: audioModule?.AVEncoderAudioQualityIOSType?.high ?? 96,
    AVEncodingOptionIOS: 'aac',
    AVFormatIDKeyIOS: 'aac',
    AVModeIOS: 'measurement',
    AVNumberOfChannelsKeyIOS: 1,
    AVSampleRateKeyIOS: 44100,
    OutputFormatAndroid: audioModule?.OutputFormatAndroidType?.MPEG_4 ?? 2,
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
    recordingSession.meteringSamples = recordingSession.meteringSamples.slice(-MAX_METERING_SAMPLES);
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

export const isVoiceNoteRecordingSupported = () => Boolean(getRecorder());

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

  const hasPermission = await ensureRecordPermission();
  if (!hasPermission) throw new Error('VOICE_PERMISSION_DENIED');

  const filePath = buildRecordingPath();
  if (!filePath) throw new Error('VOICE_CACHE_DIR_UNAVAILABLE');

  recordingSession = {
    durationMs: 0,
    filePath,
    isBusy: true,
    isRecording: false,
    meteringSamples: [],
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
    const audioSet = buildAudioSet();
    try {
      await recorder.startRecorder(filePath, audioSet, true);
    } catch (firstError) {
      voiceNoteLogger.warn('startRecorder with metering failed, retrying', {
        message: firstError?.message,
      });
      try {
        await recorder.startRecorder(filePath, audioSet);
      } catch (_secondError) {
        await recorder.startRecorder(filePath);
      }
    }

    recordingSession.isRecording = true;
    recordingSession.isBusy = false;
    return { filePath };
  } catch (error) {
    recorder.removeRecordBackListener?.();
    resetSession();
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
 *   waveform: number[];
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
  } catch (_error) {
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
  const compactWaveform = downsampleWaveform(recordingSession.meteringSamples, WAVEFORM_POINTS);
  const normalizedWaveform = normalizeWaveformToHeights(compactWaveform);
  const response = {
    durationMs,
    fileName: extractFileName(finalPath) || `voice-note-${Date.now()}.m4a`,
    mime: 'audio/mp4',
    size,
    uri: asFileUri(finalPath),
    waveform: normalizedWaveform.length > 0 ? normalizedWaveform : buildFallbackWaveform(durationMs),
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

export const getRecordingDuration = () => recordingSession.durationMs;
