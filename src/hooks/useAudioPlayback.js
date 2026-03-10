import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking } from 'react-native';

import { createLogger } from '@/utils/logger/logger';

const playbackLogger = createLogger('audio-playback');

/** @type {any | null | undefined} */
let cachedAudioModule;

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

const resolveAudioConstructor = () => {
  const moduleValue = getAudioModule();
  if (!moduleValue) return null;

  if (typeof moduleValue === 'function') return moduleValue;
  if (typeof moduleValue?.default === 'function') return moduleValue.default;
  if (typeof moduleValue?.AudioRecorderPlayer === 'function') return moduleValue.AudioRecorderPlayer;

  return null;
};

const toMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
};

/**
 * @param {{ sourceUrl?: string }} params
 * @returns {{
 *   isPlayerAvailable: boolean;
 *   isPlaying: boolean;
 *   speed: number;
 *   durationMs: number;
 *   positionMs: number;
 *   progress: number;
 *   togglePlayback: () => Promise<void>;
 *   stopPlayback: () => Promise<void>;
 *   cycleSpeed: () => void;
 * }}
 */
const useAudioPlayback = ({ sourceUrl }) => {
  const playerRef = useRef(/** @type {any | null} */ (null));
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);

  const PlayerConstructor = useMemo(() => resolveAudioConstructor(), []);
  const isPlayerAvailable = !!PlayerConstructor;

  const ensurePlayer = useCallback(() => {
    if (!PlayerConstructor) return null;
    if (playerRef.current) return playerRef.current;
    playerRef.current = new PlayerConstructor();
    return playerRef.current;
  }, [PlayerConstructor]);

  const stopPlayback = useCallback(async () => {
    const player = ensurePlayer();
    if (!player) return;
    try {
      await player.stopPlayer();
      player.removePlayBackListener?.();
    } catch (_error) {
      // No-op.
    }
    setIsPlaying(false);
    setPositionMs(0);
  }, [ensurePlayer]);

  const startPlayback = useCallback(async () => {
    if (!sourceUrl) return;
    const player = ensurePlayer();

    if (!player) {
      await Linking.openURL(sourceUrl);
      return;
    }

    await player.startPlayer(sourceUrl);
    player.setPlaybackSpeed?.(speed);
    player.removePlayBackListener?.();
    player.addPlayBackListener?.((event) => {
      const nextPosition = toMs(event?.currentPosition);
      const nextDuration = toMs(event?.duration);
      setPositionMs(nextPosition);
      if (nextDuration > 0) {
        setDurationMs(nextDuration);
      }

      if (nextDuration > 0 && nextPosition >= nextDuration) {
        player.stopPlayer?.();
        player.removePlayBackListener?.();
        setIsPlaying(false);
        setPositionMs(0);
      }
    });
    setIsPlaying(true);
  }, [ensurePlayer, sourceUrl, speed]);

  const togglePlayback = useCallback(async () => {
    if (!sourceUrl) return;
    const player = ensurePlayer();

    if (!player) {
      await Linking.openURL(sourceUrl);
      return;
    }

    try {
      if (isPlaying) {
        if (typeof player.pausePlayer === 'function') {
          await player.pausePlayer();
        } else {
          await player.stopPlayer();
          setPositionMs(0);
        }
        setIsPlaying(false);
        return;
      }

      if (positionMs > 0 && typeof player.resumePlayer === 'function') {
        await player.resumePlayer();
        player.setPlaybackSpeed?.(speed);
        setIsPlaying(true);
        return;
      }

      await startPlayback();
    } catch (error) {
      playbackLogger.warn('Failed to toggle audio playback', { message: error?.message });
      setIsPlaying(false);
    }
  }, [ensurePlayer, isPlaying, positionMs, sourceUrl, speed, startPlayback]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.findIndex((value) => value === speed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(nextSpeed);

    const player = ensurePlayer();
    if (player && typeof player.setPlaybackSpeed === 'function') {
      player.setPlaybackSpeed(nextSpeed);
    }
  }, [ensurePlayer, speed]);

  useEffect(() => {
    setDurationMs(0);
    setPositionMs(0);
    setIsPlaying(false);
  }, [sourceUrl]);

  useEffect(() => () => {
    stopPlayback();
  }, [stopPlayback]);

  return {
    cycleSpeed,
    durationMs,
    isPlayerAvailable,
    isPlaying,
    positionMs,
    progress: durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0,
    speed,
    stopPlayback,
    togglePlayback,
  };
};

export default useAudioPlayback;
