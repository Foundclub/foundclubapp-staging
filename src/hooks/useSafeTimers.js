import { useCallback, useEffect, useRef } from 'react';

const useSafeTimers = () => {
  const isMountedRef = useRef(true);
  const timersRef = useRef(new Set());

  const clearSafeTimer = useCallback((timerId) => {
    if (!timerId) return;
    clearTimeout(timerId);
    clearInterval(timerId);
    timersRef.current.delete(timerId);
  }, []);

  const setSafeTimeout = useCallback((callback, delayMs) => {
    const timerId = setTimeout(() => {
      timersRef.current.delete(timerId);
      if (!isMountedRef.current) return;
      callback();
    }, delayMs);

    timersRef.current.add(timerId);
    return timerId;
  }, []);

  const setSafeInterval = useCallback((callback, delayMs) => {
    const timerId = setInterval(() => {
      if (!isMountedRef.current) return;
      callback();
    }, delayMs);

    timersRef.current.add(timerId);
    return timerId;
  }, []);

  const clearAllSafeTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    timersRef.current.clear();
  }, []);

  // SITE-MSG-FENETRES (T20) — le mode strict du site de dev demonte puis REMONTE : sans ce
  // retour a `true`, chaque minuterie posee apres le remontage ne sonnait plus jamais.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllSafeTimers();
    };
  }, [clearAllSafeTimers]);

  return {
    clearAllSafeTimers,
    clearSafeTimer,
    isMountedRef,
    setSafeInterval,
    setSafeTimeout,
  };
};

export default useSafeTimers;
