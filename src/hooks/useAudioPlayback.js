import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { canLoadNitroSoundModule } from '@/utils/audio/nitroSoundRuntime';
import { createLogger } from '@/utils/logger/logger';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const playbackLogger = /** @type {any} */ (createLogger('audio-playback'));
const isPlaybackDiagnosticsEnabled = __DEV__;

/** @type {any | null | undefined} */
let cachedAudioModule;
/** @type {{ ownerId: string; stop: null | (() => Promise<void>) }} */
let activePlayback = { ownerId: '', stop: null };

const safeRead = (/** @type {() => any} */ resolver, /** @type {string} */ context, /** @type {any} */ fallback = null) => {
  try {
    return resolver();
  } catch (error) {
    if (context) {
      playbackLogger.warn(context, { message: /** @type {any} */ (error)?.message });
    }
    return fallback;
  }
};

const safeCall = (/** @type {any} */ fn, /** @type {any} */ thisArg, /** @type {any} */ args, /** @type {string} */ context, /** @type {any} */ fallback = null) => {
  if (typeof fn !== 'function') return fallback;
  try {
    return fn.apply(thisArg, Array.isArray(args) ? args : []);
  } catch (error) {
    if (context) {
      playbackLogger.warn(context, { message: /** @type {any} */ (error)?.message });
    }
    return fallback;
  }
};

const getAudioModule = () => {
  if (cachedAudioModule !== undefined) return cachedAudioModule;

  try {
    if (typeof require !== 'function') {
      cachedAudioModule = null;
      return cachedAudioModule;
    }
    if (!canLoadNitroSoundModule()) {
      cachedAudioModule = null;
      return cachedAudioModule;
    }
    // eslint-disable-next-line global-require
    cachedAudioModule = require('react-native-nitro-sound');
  } catch (error) {
    playbackLogger.warn('Audio player module unavailable', { message: /** @type {any} */ (error)?.message });
    cachedAudioModule = null;
  }
  return cachedAudioModule;
};

const hasPlayerMethods = (/** @type {any} */ candidate) => {
  if (!candidate) return false;
  const startPlayer = safeRead(
    () => candidate.startPlayer,
    'Audio player start API unavailable',
  );
  const stopPlayer = safeRead(
    () => candidate.stopPlayer,
    'Audio player stop API unavailable',
  );
  return typeof startPlayer === 'function' && typeof stopPlayer === 'function';
};

const resolvePlayerFactory = () => {
  const moduleValue = getAudioModule();
  if (!moduleValue) return /** @type {null | (() => any)} */ (null);

  const createSound = safeRead(
    () => moduleValue.createSound,
    'Nitro player createSound unavailable',
  );
  if (typeof createSound === 'function') {
    return () => safeCall(
      createSound,
      moduleValue,
      [],
      'Nitro player createSound factory failed',
    );
  }

  const defaultExport = safeRead(
    () => moduleValue.default,
    'Nitro player default export unavailable',
  );
  const createSoundFromDefault = safeRead(
    () => defaultExport?.createSound,
    'Nitro player default createSound unavailable',
  );
  if (typeof createSoundFromDefault === 'function') {
    return () => safeCall(
      createSoundFromDefault,
      defaultExport,
      [],
      'Nitro player default createSound factory failed',
    );
  }

  if (hasPlayerMethods(moduleValue)) return () => moduleValue;
  if (hasPlayerMethods(defaultExport)) return () => defaultExport;

  const soundExport = safeRead(
    () => moduleValue.Sound,
    'Nitro player Sound export unavailable',
  );
  if (hasPlayerMethods(soundExport)) return () => soundExport;

  return /** @type {null | (() => any)} */ (null);
};

const toMs = (/** @type {any} */ value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
};

const removePlaybackListeners = (/** @type {any} */ player) => {
  if (!player) return;
  safeCall(
    safeRead(() => player.removePlayBackListener, 'Audio player removePlayBackListener unavailable'),
    player,
    [],
    'Audio player removePlayBackListener failed',
  );
  safeCall(
    safeRead(() => player.removePlaybackEndListener, 'Audio player removePlaybackEndListener unavailable'),
    player,
    [],
    'Audio player removePlaybackEndListener failed',
  );
};

const addPlaybackListener = (/** @type {any} */ player, /** @type {any} */ listener) => {
  if (!player || typeof listener !== 'function') return;
  safeCall(
    safeRead(() => player.addPlayBackListener, 'Audio player addPlayBackListener unavailable'),
    player,
    [listener],
    'Audio player addPlayBackListener failed',
  );
};

const addPlaybackEndListener = (/** @type {any} */ player, /** @type {any} */ listener) => {
  if (!player || typeof listener !== 'function') return;
  safeCall(
    safeRead(() => player.addPlaybackEndListener, 'Audio player addPlaybackEndListener unavailable'),
    player,
    [listener],
    'Audio player addPlaybackEndListener failed',
  );
};

const setPlayerSpeed = (/** @type {any} */ player, /** @type {number} */ speed) => {
  if (!player) return;
  if (typeof player.setPlaybackSpeed === 'function') {
    player.setPlaybackSpeed(speed);
    return;
  }
  if (typeof player.setPlayerSpeed === 'function') {
    player.setPlayerSpeed(speed);
  }
};

const isHttpUrl = (/** @type {any} */ value) => /^https?:\/\//i.test(String(value || '').trim());

const stripFileScheme = (/** @type {any} */ value) => String(value || '').replace(/^file:\/\//i, '');

const withFileScheme = (/** @type {any} */ value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.startsWith('file://') ? normalized : `file://${normalized}`;
};

const hashString = (/** @type {any} */ value) => {
  const source = String(value || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash * 31) + source.charCodeAt(i)) % 2147483647;
  }
  return String(Math.abs(hash));
};

const extractAudioFileExtension = (/** @type {any} */ value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return 'm4a';

  let pathname = rawValue;
  if (/^https?:\/\//i.test(rawValue)) {
    try {
      pathname = new URL(rawValue).pathname || '';
    } catch (_error) {
      pathname = rawValue;
    }
  } else if (rawValue.startsWith('file://')) {
    pathname = rawValue.replace(/^file:\/\//i, '');
  }

  const sanitizedPath = String(pathname || '').split(/[?#]/)[0];
  const match = sanitizedPath.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() || 'm4a';
};

const buildPlaybackSourceCandidates = (/** @type {any} */ rawSourceUrl) => {
  const source = String(rawSourceUrl || '').trim();
  if (!source) return [];

  const candidates = /** @type {string[]} */ ([]);
  const pushCandidate = (/** @type {any} */ value) => {
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

const waitFor = (/** @type {any} */ delayMs) => new Promise((resolve) => {
  setTimeout(() => resolve(undefined), Math.max(0, Number(delayMs) || 0));
});

const formatDiagnosticMeta = (/** @type {any} */ meta) => {
  if (!meta || typeof meta !== 'object') return '';
  try {
    const serialized = JSON.stringify(meta);
    return serialized && serialized !== '{}' ? ` ${serialized}` : '';
  } catch (_error) {
    return '';
  }
};

const logPlaybackDiagnostic = (/** @type {string} */ stage, /** @type {any} */ meta = undefined) => {
  if (!isPlaybackDiagnosticsEnabled) return;
  playbackLogger.warn(`[voice-diag] ${stage}${formatDiagnosticMeta(meta)}`);
};

const getPlaybackErrorCode = (/** @type {any} */ error) => String(error?.message || error || '').trim().toUpperCase();

const shouldRetryRemoteAudioWithoutHeaders = (/** @type {any} */ error, /** @type {any} */ requestHeaders) => {
  const hasHeaders = requestHeaders && Object.keys(requestHeaders).length > 0;
  if (!hasHeaders) return false;

  const errorCode = getPlaybackErrorCode(error);
  return (
    errorCode === 'AUDIO_DOWNLOAD_INVALID_CONTENT'
    || errorCode === 'AUDIO_DOWNLOAD_EMPTY_FILE'
    || errorCode === 'AUDIO_HTTP_400'
    || errorCode === 'AUDIO_HTTP_401'
    || errorCode === 'AUDIO_HTTP_403'
  );
};

const toPlaybackErrorMessage = (/** @type {any} */ error) => {
  const errorCode = getPlaybackErrorCode(error);

  if (errorCode === 'AUDIO_HTTP_401') return 'Audio refuse (401)';
  if (errorCode === 'AUDIO_HTTP_403') return 'Audio refuse (403)';
  if (errorCode === 'AUDIO_HTTP_404') return 'Audio introuvable (404)';
  if (errorCode.startsWith('AUDIO_HTTP_')) return `Erreur HTTP audio (${errorCode.replace('AUDIO_HTTP_', '')})`;
  if (errorCode === 'AUDIO_DOWNLOAD_INVALID_CONTENT') return 'Réponse audio invalide';
  if (errorCode === 'AUDIO_DOWNLOAD_EMPTY_FILE') return 'Fichier audio vide';
  if (errorCode === 'AUDIO_DOWNLOAD_EMPTY_PATH') return 'Cache audio introuvable';
  if (errorCode === 'PLAYER_SOURCE_EMPTY') return 'Source audio vide';
  if (errorCode === 'PLAYER_START_FAILED') return 'Lecture native impossible';

  const rawMessage = String(error?.message || '').trim();
  if (rawMessage) return `Lecture audio indisponible (${rawMessage})`;
  return 'Lecture audio indisponible';
};

const claimPlaybackSlot = async (/** @type {string} */ ownerId, /** @type {() => Promise<void>} */ stopCurrentOwner) => {
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

const releasePlaybackSlot = (/** @type {string} */ ownerId) => {
  if (activePlayback.ownerId !== ownerId) return;
  activePlayback = { ownerId: '', stop: null };
};

/**
 * Playback hook with local-cache strategy for remote audio sources.
 *
 * @param {{ sourceUrl?: string; headers?: Record<string, string>; allowExternalFallback?: boolean }} params
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
const useAudioPlayback = ({ allowExternalFallback = false, headers, sourceUrl }) => {
  const ownerIdRef = useRef(`voice-playback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const mountedRef = useRef(true);
  const playerRef = useRef(/** @type {any | null} */ (null));
  const stopPlaybackRef = useRef(/** @type {() => Promise<void>} */ (async () => {}));
  const downloadedSourceRef = useRef('');
  const downloadedPathRef = useRef('');
  const teardownChainRef = useRef(Promise.resolve());
  const playbackSessionRef = useRef({
    durationMs: 0,
    lastPositionMs: 0,
    startedAtMs: 0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [lastError, setLastError] = useState('');

  const playerFactory = useMemo(() => resolvePlayerFactory(), []);
  const normalizedSourceUrl = useMemo(() => resolveMediaUrl(sourceUrl), [sourceUrl]);
  const isPlayerAvailable = Boolean(playerFactory);

  const safeSetState = useCallback((/** @type {(value: any) => void} */ setter, /** @type {any} */ value) => {
    if (!mountedRef.current) return;
    setter(value);
  }, []);

  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return playerRef.current;
    if (!playerFactory) return null;

    const player = safeRead(
      () => playerFactory(),
      'Failed to create Nitro player',
    );
    if (!hasPlayerMethods(player)) return null;

    const setSubscriptionDuration = safeRead(
      () => player.setSubscriptionDuration,
      'Player subscription setter unavailable',
    );
    safeCall(
      setSubscriptionDuration,
      player,
      [0.1],
      'Player subscription setup failed',
    );
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
    const rawSource = String(normalizedSourceUrl || '').trim();
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

    const targetExtension = extractAudioFileExtension(rawSource);
    const safeHeaders = headers && typeof headers === 'object' ? headers : {};

    const downloadRemoteSource = async (/** @type {Record<string, string>} */ requestHeaders = {}) => {
      const targetPath = `${cacheDir}/voice-playback-${Date.now()}-${hashString(`${rawSource}-${JSON.stringify(requestHeaders)}`)}.${targetExtension}`;

      logPlaybackDiagnostic('playback-download-start', {
        hasHeaders: Object.keys(requestHeaders).length > 0,
        sourceUrl: rawSource,
        targetExtension,
        targetPath,
      });

      const response = await ReactNativeBlobUtil
        .config({
          fileCache: true,
          overwrite: true,
          path: targetPath,
        })
        .fetch('GET', rawSource, requestHeaders);

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

      logPlaybackDiagnostic('playback-download-success', {
        contentType: responseContentType,
        fileSize,
        sourceUrl: rawSource,
        targetPath: downloadedPath,
        usedHeaders: Object.keys(requestHeaders).length > 0,
      });

      return downloadedPath;
    };

    let downloadedPath = '';
    try {
      downloadedPath = await downloadRemoteSource(safeHeaders);
    } catch (error) {
      if (!shouldRetryRemoteAudioWithoutHeaders(error, safeHeaders)) {
        throw error;
      }

      logPlaybackDiagnostic('playback-download-retry-without-headers', {
        errorCode: getPlaybackErrorCode(error),
        sourceUrl: rawSource,
      });
      downloadedPath = await downloadRemoteSource({});
    }

    downloadedSourceRef.current = rawSource;
    downloadedPathRef.current = downloadedPath;
    return withFileScheme(downloadedPath);
  }, [cleanupDownloadedSource, headers, normalizedSourceUrl]);

  const runPlayerTeardown = useCallback(async (/** @type {any} */ options = {}) => {
    const {
      cleanupSource = false,
      disposePlayer = false,
      releaseSlot = true,
      resetPosition = true,
    } = options;

    const player = playerRef.current;
    removePlaybackListeners(player);

    try {
      if (player && typeof player.stopPlayer === 'function') {
        await player.stopPlayer();
      }
    } catch (_error) {
      // Best effort stop.
    }

    if (disposePlayer && player && typeof player.dispose === 'function') {
      try {
        player.dispose();
      } catch (_error) {
        // Best effort dispose.
      }
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    }

    if (cleanupSource) {
      await cleanupDownloadedSource();
    }

    if (releaseSlot) {
      releasePlaybackSlot(ownerIdRef.current);
    }

    safeSetState(setIsPlaying, false);
    if (resetPosition) {
      safeSetState(setPositionMs, 0);
    }
  }, [cleanupDownloadedSource, safeSetState]);

  const enqueuePlayerTeardown = useCallback(async (/** @type {any} */ options = {}) => {
    const scheduledTeardown = teardownChainRef.current
      .catch(() => {})
      .then(() => runPlayerTeardown(options));

    teardownChainRef.current = scheduledTeardown.catch(() => {});
    await scheduledTeardown;
  }, [runPlayerTeardown]);

  const stopPlayback = useCallback(async (/** @type {any} */ options = {}) => {
    await enqueuePlayerTeardown(options);
  }, [enqueuePlayerTeardown]);

  const openExternalFallback = useCallback(async () => {
    if (!allowExternalFallback) {
      safeSetState(setLastError, 'Lecture audio indisponible');
      return;
    }

    const rawSource = String(normalizedSourceUrl || '').trim();
    if (!rawSource || !isHttpUrl(rawSource)) {
      safeSetState(setLastError, 'Lecture audio indisponible');
      return;
    }

    try {
      await Linking.openURL(rawSource);
      safeSetState(setLastError, '');
    } catch (error) {
      playbackLogger.warn('Failed to open external audio URL', {
        message: /** @type {any} */ (error)?.message,
        sourceUrl: rawSource,
      });
      safeSetState(setLastError, 'Lecture audio indisponible');
    }
  }, [allowExternalFallback, normalizedSourceUrl, safeSetState]);

  const startPlayback = useCallback(async () => {
    const rawSource = String(normalizedSourceUrl || '').trim();
    if (!rawSource) return;

    const player = ensurePlayer();
    if (!player) {
      logPlaybackDiagnostic('playback-player-unavailable', {
        sourceUrl: rawSource,
      });
      if (!allowExternalFallback) {
        safeSetState(setLastError, 'Module audio indisponible');
        return;
      }
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

      const startPlayerWithCandidates = async () => {
        /** @type {any} */
        let lastStartError = null;

        for (let index = 0; index < sourceCandidates.length; index += 1) {
          const candidate = sourceCandidates[index];
          const requestHeaders = isHttpUrl(candidate) ? (headers || undefined) : undefined;

          logPlaybackDiagnostic('playback-native-start-attempt', {
            candidate,
            isRemote: isHttpUrl(candidate),
          });

          try {
            // eslint-disable-next-line no-await-in-loop
            await player.startPlayer(candidate, requestHeaders);
            return candidate;
          } catch (error) {
            lastStartError = error;
          }
        }

        throw lastStartError || new Error('PLAYER_START_FAILED');
      };

      /** @type {string} */
      let selectedCandidate = '';

      try {
        selectedCandidate = await startPlayerWithCandidates();
      } catch (firstStartError) {
        const shouldRetryStart = sourceCandidates.some((candidate) => !isHttpUrl(candidate));
        if (!shouldRetryStart) {
          throw firstStartError;
        }

        await waitFor(180);
        selectedCandidate = await startPlayerWithCandidates();
      }

      await player.setVolume?.(1);
      setPlayerSpeed(player, speed);
      playbackSessionRef.current = {
        durationMs: 0,
        lastPositionMs: 0,
        startedAtMs: Date.now(),
      };

      removePlaybackListeners(player);
      let hasLoggedProgress = false;
      addPlaybackListener(player, (/** @type {any} */ event) => {
        const nextPosition = toMs(event?.currentPosition ?? event?.position ?? event?.current_position);
        const nextDuration = toMs(event?.duration ?? event?.durationMs ?? event?.duration_ms);
        playbackSessionRef.current = {
          ...playbackSessionRef.current,
          durationMs: nextDuration > 0 ? nextDuration : playbackSessionRef.current.durationMs,
          lastPositionMs: nextPosition,
        };

        if (isPlaybackDiagnosticsEnabled && !hasLoggedProgress && nextPosition > 0) {
          hasLoggedProgress = true;
          logPlaybackDiagnostic('playback-progress-first', {
            durationMs: nextDuration,
            positionMs: nextPosition,
            sourceUrl: rawSource,
          });
        }

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
        logPlaybackDiagnostic('playback-ended', {
          durationMs: playbackSessionRef.current.durationMs,
          elapsedWallMs: playbackSessionRef.current.startedAtMs > 0
            ? Math.max(0, Date.now() - playbackSessionRef.current.startedAtMs)
            : 0,
          lastPositionMs: playbackSessionRef.current.lastPositionMs,
          sourceUrl: rawSource,
        });
        playbackSessionRef.current = {
          durationMs: 0,
          lastPositionMs: 0,
          startedAtMs: 0,
        };
      });

      safeSetState(setLastError, '');
      safeSetState(setIsPlaying, true);
      logPlaybackDiagnostic('playback-start-succeeded', {
        candidate: selectedCandidate,
        sourceUrl: rawSource,
      });
    } catch (error) {
      playbackLogger.warn('Failed to start playback', {
        message: /** @type {any} */ (error)?.message,
        normalizedSourceUrl: rawSource,
      });
      logPlaybackDiagnostic('playback-start-failed', {
        errorCode: getPlaybackErrorCode(error),
        message: /** @type {any} */ (error)?.message,
        normalizedSourceUrl: rawSource,
      });
      safeSetState(setLastError, toPlaybackErrorMessage(error));
      await stopPlayback();
      if (allowExternalFallback && isHttpUrl(rawSource)) {
        await openExternalFallback();
      }
    } finally {
      safeSetState(setIsLoading, false);
    }
  }, [
    allowExternalFallback,
    ensurePlayer,
    headers,
    openExternalFallback,
    resolvePlayableSource,
    safeSetState,
    normalizedSourceUrl,
    speed,
    stopPlayback,
  ]);

  const togglePlayback = useCallback(async () => {
    if (!normalizedSourceUrl) return;

    const player = ensurePlayer();
    if (!player) {
      if (!allowExternalFallback) {
        safeSetState(setLastError, 'Module audio indisponible');
        return;
      }
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
      playbackLogger.warn('Failed to toggle playback', { message: /** @type {any} */ (error)?.message });
      safeSetState(setLastError, 'Lecture audio indisponible');
      await stopPlayback();
    } finally {
      safeSetState(setIsLoading, false);
    }
  }, [
    allowExternalFallback,
    durationMs,
    ensurePlayer,
    isPlaying,
    openExternalFallback,
    positionMs,
    safeSetState,
    normalizedSourceUrl,
    speed,
    startPlayback,
    stopPlayback,
  ]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.findIndex((/** @type {number} */ value) => value === speed);
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
    enqueuePlayerTeardown({
      cleanupSource: true,
      disposePlayer: false,
      releaseSlot: true,
      resetPosition: true,
    }).catch(() => {});
    safeSetState(setDurationMs, 0);
    safeSetState(setPositionMs, 0);
    safeSetState(setIsPlaying, false);
    safeSetState(setLastError, '');
  }, [enqueuePlayerTeardown, normalizedSourceUrl, safeSetState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      enqueuePlayerTeardown({
        cleanupSource: true,
        disposePlayer: true,
        releaseSlot: true,
        resetPosition: true,
      }).catch(() => {});
    };
  }, [enqueuePlayerTeardown]);

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
