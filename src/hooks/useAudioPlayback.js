import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { createLogger } from '@/utils/logger/logger';

const playbackLogger = createLogger('audio-playback');

/** @type {any | null | undefined} */
let cachedAudioModule;
/** @type {{ ownerId: string; stop: null | (() => Promise<void>) }} */
let activePlayback = { ownerId: '', stop: null };

const getAudioModule = () => {
  if (cachedAudioModule !== undefined) return cachedAudioModule;

  try {
    if (typeof require !== 'function') {
      cachedAudioModule = null;
      return cachedAudioModule;
    }
    // eslint-disable-next-line global-require
    cachedAudioModule = require('react-native-nitro-sound');
  } catch (error) {
    playbackLogger.warn('Audio player module unavailable', { message: error?.message });
    cachedAudioModule = null;
  }
  return cachedAudioModule;
};

const hasPlayerMethods = (candidate) => (
  !!candidate
  && typeof candidate.startPlayer === 'function'
  && typeof candidate.stopPlayer === 'function'
);

const resolvePlayerFactory = () => {
  const moduleValue = getAudioModule();
  if (!moduleValue) return /** @type {null | (() => any)} */ (null);

  if (typeof moduleValue?.createSound === 'function') {
    return () => moduleValue.createSound();
  }

  if (typeof moduleValue?.default?.createSound === 'function') {
    return () => moduleValue.default.createSound();
  }

  if (hasPlayerMethods(moduleValue)) return () => moduleValue;
  if (hasPlayerMethods(moduleValue?.default)) return () => moduleValue.default;
  if (hasPlayerMethods(moduleValue?.Sound)) return () => moduleValue.Sound;

  return /** @type {null | (() => any)} */ (null);
};

const toMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
};

const removePlaybackListeners = (player) => {
  if (!player) return;
  if (typeof player.removePlayBackListener === 'function') {
    player.removePlayBackListener();
  }
  if (typeof player.removePlaybackEndListener === 'function') {
    player.removePlaybackEndListener();
  }
};

const addPlaybackListener = (player, listener) => {
  if (!player || typeof listener !== 'function') return;
  if (typeof player.addPlayBackListener === 'function') {
    player.addPlayBackListener(listener);
  }
};

const addPlaybackEndListener = (player, listener) => {
  if (!player || typeof listener !== 'function') return;
  if (typeof player.addPlaybackEndListener === 'function') {
    player.addPlaybackEndListener(listener);
  }
};

const setPlayerSpeed = (player, speed) => {
  if (!player) return;
  if (typeof player.setPlaybackSpeed === 'function') {
    player.setPlaybackSpeed(speed);
    return;
  }
  if (typeof player.setPlayerSpeed === 'function') {
    player.setPlayerSpeed(speed);
  }
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const stripFileScheme = (value) => String(value || '').replace(/^file:\/\//i, '');

const withFileScheme = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.startsWith('file://') ? normalized : `file://${normalized}`;
};

const hashString = (value) => {
  const source = String(value || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash * 31) + source.charCodeAt(i)) % 2147483647;
  }
  return String(Math.abs(hash));
};

const buildPlaybackSourceCandidates = (rawSourceUrl) => {
  const source = String(rawSourceUrl || '').trim();
  if (!source) return [];

  const candidates = [];
  const pushCandidate = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  pushCandidate(source);

  if (source.startsWith('file://')) {
    pushCandidate(source.replace(/^file:\/\//i, ''));
  } else if (source.startsWith('/')) {
    pushCandidate(`file://${source}`);
  }

  return candidates;
};

const claimPlaybackSlot = async (ownerId, stopCurrentOwner) => {
  if (
    activePlayback.ownerId
    && activePlayback.ownerId !== ownerId
    && typeof activePlayback.stop === 'function'
  ) {
    try {
      await activePlayback.stop();
    } catch (_error) {
      // Best effort.
    }
  }

  activePlayback = {
    ownerId,
    stop: stopCurrentOwner,
  };
};

const releasePlaybackSlot = (ownerId) => {
  if (activePlayback.ownerId !== ownerId) return;
  activePlayback = { ownerId: '', stop: null };
};

/**
 * Playback hook with local-cache strategy for remote audio sources.
 *
 * @param {{ sourceUrl?: string; headers?: Record<string, string> }} params
 * @returns {{
 *   isPlayerAvailable: boolean;
 *   isLoading: boolean;
 *   isPlaying: boolean;
 *   speed: number;
 *   durationMs: number;
 *   positionMs: number;
 *   progress: number;
 *   lastError: string;
 *   togglePlayback: () => Promise<void>;
 *   stopPlayback: () => Promise<void>;
 *   cycleSpeed: () => void;
 * }}
 */
const useAudioPlayback = ({ headers, sourceUrl }) => {
  const ownerIdRef = useRef(`voice-playback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const mountedRef = useRef(true);
  const playerRef = useRef(/** @type {any | null} */ (null));
  const stopPlaybackRef = useRef(/** @type {() => Promise<void>} */ (async () => {}));
  const downloadedSourceRef = useRef('');
  const downloadedPathRef = useRef('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [lastError, setLastError] = useState('');

  const playerFactory = useMemo(() => resolvePlayerFactory(), []);
  const isPlayerAvailable = Boolean(playerFactory);

  const safeSetState = useCallback((setter, value) => {
    if (!mountedRef.current) return;
    setter(value);
  }, []);

  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return playerRef.current;
    if (!playerFactory) return null;

    const player = playerFactory();
    if (!hasPlayerMethods(player)) return null;
    player.setSubscriptionDuration?.(0.1);
    playerRef.current = player;
    return playerRef.current;
  }, [playerFactory]);

  const cleanupDownloadedSource = useCallback(async () => {
    const currentPath = String(downloadedPathRef.current || '').trim();
    downloadedPathRef.current = '';
    downloadedSourceRef.current = '';

    if (!currentPath) return;

    try {
      const normalizedPath = stripFileScheme(currentPath);
      if (!normalizedPath) return;
      const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
      if (exists) {
        await ReactNativeBlobUtil.fs.unlink(normalizedPath);
      }
    } catch (_error) {
      // Best effort cleanup.
    }
  }, []);

  const resolvePlayableSource = useCallback(async () => {
    const rawSource = String(sourceUrl || '').trim();
    if (!rawSource) return '';

    if (!isHttpUrl(rawSource)) {
      return rawSource;
    }

    if (
      downloadedSourceRef.current === rawSource
      && downloadedPathRef.current
    ) {
      const cachedPath = stripFileScheme(downloadedPathRef.current);
      if (cachedPath) {
        try {
          const exists = await ReactNativeBlobUtil.fs.exists(cachedPath);
          if (exists) return withFileScheme(cachedPath);
        } catch (_error) {
          // Ignore and re-download.
        }
      }
    }

    await cleanupDownloadedSource();

    const cacheDir = ReactNativeBlobUtil?.fs?.dirs?.CacheDir
      || ReactNativeBlobUtil?.fs?.dirs?.DocumentDir;
    if (!cacheDir) return rawSource;

    const targetPath = `${cacheDir}/voice-playback-${Date.now()}-${hashString(rawSource)}.m4a`;
    const safeHeaders = headers && typeof headers === 'object' ? headers : {};

    const response = await ReactNativeBlobUtil
      .config({
        fileCache: true,
        overwrite: true,
        path: targetPath,
      })
      .fetch('GET', rawSource, safeHeaders);

    const info = response?.info?.() || {};
    const status = Number(info?.status || 0);
    if (status >= 400) {
      throw new Error(`AUDIO_HTTP_${status}`);
    }
    const responseHeaders = info?.headers && typeof info.headers === 'object'
      ? info.headers
      : {};
    const responseContentType = String(
      responseHeaders['content-type']
      || responseHeaders['Content-Type']
      || '',
    ).toLowerCase();
    if (
      responseContentType.includes('text/html')
      || responseContentType.includes('application/json')
    ) {
      throw new Error('AUDIO_DOWNLOAD_INVALID_CONTENT');
    }

    const downloadedPath = stripFileScheme(response?.path?.() || targetPath);
    if (!downloadedPath) {
      throw new Error('AUDIO_DOWNLOAD_EMPTY_PATH');
    }

    const stat = await ReactNativeBlobUtil.fs.stat(downloadedPath);
    const fileSize = Number(stat?.size || 0);
    if (!Number.isFinite(fileSize) || fileSize < 512) {
      throw new Error('AUDIO_DOWNLOAD_EMPTY_FILE');
    }

    downloadedSourceRef.current = rawSource;
    downloadedPathRef.current = downloadedPath;
    return withFileScheme(downloadedPath);
  }, [cleanupDownloadedSource, headers, sourceUrl]);

  const stopPlayback = useCallback(async (options = {}) => {
    const {
      releaseSlot = true,
      resetPosition = true,
    } = options;

    const player = playerRef.current;
    try {
      if (player && typeof player.stopPlayer === 'function') {
        await player.stopPlayer();
      }
    } catch (_error) {
      // Best effort stop.
    }

    removePlaybackListeners(player);
    if (releaseSlot) {
      releasePlaybackSlot(ownerIdRef.current);
    }

    safeSetState(setIsPlaying, false);
    if (resetPosition) {
      safeSetState(setPositionMs, 0);
    }
  }, [safeSetState]);

  const openExternalFallback = useCallback(async () => {
    const rawSource = String(sourceUrl || '').trim();
    if (!rawSource || !isHttpUrl(rawSource)) {
      safeSetState(setLastError, 'Lecture audio indisponible');
      return;
    }

    try {
      await Linking.openURL(rawSource);
      safeSetState(setLastError, '');
    } catch (error) {
      playbackLogger.warn('Failed to open external audio URL', {
        message: error?.message,
        sourceUrl: rawSource,
      });
      safeSetState(setLastError, 'Lecture audio indisponible');
    }
  }, [safeSetState, sourceUrl]);

  const startPlayback = useCallback(async () => {
    const rawSource = String(sourceUrl || '').trim();
    if (!rawSource) return;

    const player = ensurePlayer();
    if (!player) {
      await openExternalFallback();
      return;
    }

    safeSetState(setIsLoading, true);
    try {
      await claimPlaybackSlot(ownerIdRef.current, async () => {
        await stopPlaybackRef.current();
      });

      await stopPlayback({ releaseSlot: false });

      const playableSource = await resolvePlayableSource();
      const sourceCandidates = buildPlaybackSourceCandidates(playableSource);
      if (sourceCandidates.length === 0) {
        throw new Error('PLAYER_SOURCE_EMPTY');
      }

      let started = false;
      /** @type {any} */
      let startError = null;

      for (let index = 0; index < sourceCandidates.length; index += 1) {
        const candidate = sourceCandidates[index];
        const requestHeaders = isHttpUrl(candidate) ? (headers || undefined) : undefined;

        try {
          // eslint-disable-next-line no-await-in-loop
          await player.startPlayer(candidate, requestHeaders);
          started = true;
          break;
        } catch (error) {
          startError = error;
        }
      }

      if (!started) {
        throw startError || new Error('PLAYER_START_FAILED');
      }

      await player.setVolume?.(1);
      setPlayerSpeed(player, speed);

      removePlaybackListeners(player);
      addPlaybackListener(player, (event) => {
        const nextPosition = toMs(event?.currentPosition ?? event?.position ?? event?.current_position);
        const nextDuration = toMs(event?.duration ?? event?.durationMs ?? event?.duration_ms);

        if (nextDuration > 0) {
          safeSetState(setDurationMs, nextDuration);
        }
        safeSetState(setPositionMs, nextPosition);
      });
      addPlaybackEndListener(player, () => {
        removePlaybackListeners(player);
        safeSetState(setIsPlaying, false);
        safeSetState(setPositionMs, 0);
        releasePlaybackSlot(ownerIdRef.current);
      });

      safeSetState(setLastError, '');
      safeSetState(setIsPlaying, true);
    } catch (error) {
      playbackLogger.warn('Failed to start playback', { message: error?.message });
      safeSetState(setLastError, 'Lecture audio indisponible');
      await stopPlayback();
      if (isHttpUrl(rawSource)) {
        await openExternalFallback();
      }
    } finally {
      safeSetState(setIsLoading, false);
    }
  }, [
    ensurePlayer,
    headers,
    openExternalFallback,
    resolvePlayableSource,
    safeSetState,
    sourceUrl,
    speed,
    stopPlayback,
  ]);

  const togglePlayback = useCallback(async () => {
    if (!sourceUrl) return;

    const player = ensurePlayer();
    if (!player) {
      await openExternalFallback();
      return;
    }

    safeSetState(setIsLoading, true);
    try {
      if (isPlaying) {
        if (typeof player.pausePlayer === 'function') {
          await player.pausePlayer();
          safeSetState(setIsPlaying, false);
          return;
        }

        await stopPlayback();
        return;
      }

      if (positionMs > 0 && durationMs > 0 && typeof player.resumePlayer === 'function') {
        await claimPlaybackSlot(ownerIdRef.current, async () => {
          await stopPlaybackRef.current();
        });
        await player.resumePlayer();
        setPlayerSpeed(player, speed);
        safeSetState(setLastError, '');
        safeSetState(setIsPlaying, true);
        return;
      }

      await startPlayback();
    } catch (error) {
      playbackLogger.warn('Failed to toggle playback', { message: error?.message });
      safeSetState(setLastError, 'Lecture audio indisponible');
      await stopPlayback();
    } finally {
      safeSetState(setIsLoading, false);
    }
  }, [
    durationMs,
    ensurePlayer,
    isPlaying,
    openExternalFallback,
    positionMs,
    safeSetState,
    sourceUrl,
    speed,
    startPlayback,
    stopPlayback,
  ]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.findIndex((value) => value === speed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];

    safeSetState(setSpeed, nextSpeed);
    const player = playerRef.current;
    setPlayerSpeed(player, nextSpeed);
  }, [safeSetState, speed]);

  useEffect(() => {
    stopPlaybackRef.current = async () => {
      await stopPlayback();
    };
  }, [stopPlayback]);

  useEffect(() => {
    stopPlayback().catch(() => {});
    cleanupDownloadedSource().catch(() => {});
    safeSetState(setDurationMs, 0);
    safeSetState(setPositionMs, 0);
    safeSetState(setIsPlaying, false);
    safeSetState(setLastError, '');
  }, [cleanupDownloadedSource, safeSetState, sourceUrl, stopPlayback]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPlayback().catch(() => {});
      cleanupDownloadedSource().catch(() => {});

      const player = playerRef.current;
      if (player && typeof player.dispose === 'function') {
        try {
          player.dispose();
        } catch (_error) {
          // Best effort dispose.
        }
      }
      playerRef.current = null;
    };
  }, [cleanupDownloadedSource, stopPlayback]);

  return {
    cycleSpeed,
    durationMs,
    isLoading,
    isPlayerAvailable,
    isPlaying,
    lastError,
    positionMs,
    progress: durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0,
    speed,
    stopPlayback: async () => {
      await stopPlayback();
    },
    togglePlayback,
  };
};

export default useAudioPlayback;
