import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { createLogger } from '@/utils/logger/logger';

const voiceNoteLogger = createLogger('voice-note-service');

/** @type {any | null | undefined} */
let cachedAudioRecorderModule;
/** @type {any | null} */
let recorderInstance = null;
/** @type {string} */
let activeRecordingPath = '';
/** @type {number} */
let currentDurationMs = 0;

const getAudioRecorderModule = () => {
  if (cachedAudioRecorderModule !== undefined) return cachedAudioRecorderModule;

  try {
    if (typeof require !== 'function') {
      cachedAudioRecorderModule = null;
      return cachedAudioRecorderModule;
    }
    // eslint-disable-next-line global-require
    cachedAudioRecorderModule = require('react-native-nitro-sound');
  } catch (error) {
    voiceNoteLogger.warn('Audio recorder module unavailable', { message: error?.message });
    cachedAudioRecorderModule = null;
  }

  return cachedAudioRecorderModule;
};

const resolveRecorderConstructor = () => {
  const moduleValue = getAudioRecorderModule();
  if (!moduleValue) return null;

  if (typeof moduleValue === 'function') return moduleValue;
  if (typeof moduleValue?.default === 'function') return moduleValue.default;
  if (typeof moduleValue?.AudioRecorderPlayer === 'function') return moduleValue.AudioRecorderPlayer;

  return null;
};

const ensureRecorder = () => {
  if (recorderInstance) return recorderInstance;
  const RecorderConstructor = resolveRecorderConstructor();
  if (!RecorderConstructor) return null;

  recorderInstance = new RecorderConstructor();
  return recorderInstance;
};

const normalizePathForFs = (path) => {
  const value = String(path || '').trim();
  if (!value) return '';
  return value.startsWith('file://') ? value.replace('file://', '') : value;
};

const ensureRecordPermission = async () => {
  if (Platform.OS !== 'android') return true;

  const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (alreadyGranted) return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    buttonNegative: 'Refuser',
    buttonPositive: 'Autoriser',
    message: 'FoundClub a besoin du micro pour enregistrer les notes vocales.',
    title: 'Autoriser le micro',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const buildWaveformFromDuration = (durationMs) => {
  const peaksCount = 24;
  const safeDuration = Math.max(1, Number(durationMs) || 0);
  return Array.from({ length: peaksCount }, (_, index) => {
    const ratio = index / Math.max(1, peaksCount - 1);
    const peak = Math.round((Math.sin((ratio * Math.PI * 1.6) + 0.8) + 1.15) * 18);
    return Math.max(4, Math.min(36, peak + Math.round((safeDuration / 1000) % 5)));
  });
};

export const isVoiceNoteRecordingSupported = () => Boolean(resolveRecorderConstructor());

/**
 * @param {{ onProgress?: (durationMs: number) => void }} [params]
 * @returns {Promise<{ filePath: string }>}
 */
export const startRecording = async (params = {}) => {
  const recorder = ensureRecorder();
  if (!recorder) {
    throw new Error('VOICE_MODULE_UNAVAILABLE');
  }

  const hasPermission = await ensureRecordPermission();
  if (!hasPermission) {
    throw new Error('VOICE_PERMISSION_DENIED');
  }

  const cacheDir = ReactNativeBlobUtil?.fs?.dirs?.CacheDir || ReactNativeBlobUtil?.fs?.dirs?.DocumentDir;
  if (!cacheDir) {
    throw new Error('VOICE_CACHE_DIR_UNAVAILABLE');
  }

  currentDurationMs = 0;
  const filePath = `${cacheDir}/voice-note-${Date.now()}.m4a`;
  activeRecordingPath = filePath;

  await recorder.startRecorder(filePath);
  recorder.removeRecordBackListener?.();
  recorder.addRecordBackListener?.((recordEvent) => {
    currentDurationMs = Number(recordEvent?.currentPosition) || 0;
    params?.onProgress?.(currentDurationMs);
  });

  return { filePath };
};

/**
 * @returns {Promise<{
 *   uri: string;
 *   mime: string;
 *   size: number;
 *   durationMs: number;
 *   waveform: number[];
 * }>}
 */
export const stopRecording = async () => {
  const recorder = ensureRecorder();
  if (!recorder) {
    throw new Error('VOICE_MODULE_UNAVAILABLE');
  }

  const stoppedPath = await recorder.stopRecorder();
  recorder.removeRecordBackListener?.();

  const finalPath = String(stoppedPath || activeRecordingPath || '').trim();
  if (!finalPath) {
    throw new Error('VOICE_FILE_NOT_FOUND');
  }

  const normalizedPath = normalizePathForFs(finalPath);
  let size = 0;

  try {
    const stat = await ReactNativeBlobUtil.fs.stat(normalizedPath);
    size = Number(stat?.size) || 0;
  } catch (_error) {
    size = 0;
  }

  const durationMs = Math.max(0, currentDurationMs);
  const response = {
    durationMs,
    mime: 'audio/mp4',
    size,
    uri: finalPath.startsWith('file://') ? finalPath : `file://${finalPath}`,
    waveform: buildWaveformFromDuration(durationMs),
  };

  activeRecordingPath = '';
  currentDurationMs = 0;
  return response;
};

/**
 * @returns {Promise<void>}
 */
export const cancelRecording = async () => {
  const recorder = ensureRecorder();
  if (!recorder) return;

  let canceledPath = activeRecordingPath;
  try {
    const stoppedPath = await recorder.stopRecorder();
    canceledPath = String(stoppedPath || canceledPath || '').trim();
  } catch (_error) {
    // No-op: we still attempt cleanup.
  }

  recorder.removeRecordBackListener?.();

  const normalizedPath = normalizePathForFs(canceledPath);
  if (normalizedPath) {
    try {
      const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
      if (exists) {
        await ReactNativeBlobUtil.fs.unlink(normalizedPath);
      }
    } catch (_error) {
      // No-op cleanup.
    }
  }

  activeRecordingPath = '';
  currentDurationMs = 0;
};

export const getRecordingDuration = () => currentDurationMs;
