import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { createLogger } from '@/utils/logger/logger';

const startupPhaseLogger = createLogger('startup-phase');

export const STARTUP_PHASES = {
  BOOT_CORE: 'boot_core',
  NAV_READY: 'nav_ready',
  ROUTE_STABLE: 'route_stable',
  SCREEN_LOCAL_PROMPTS: 'screen_local_prompts',
  STARTUP_PROMPT_WINDOW: 'startup_prompt_window',
  STEADY_STATE: 'steady_state',
};

const ROUTE_STABILITY_MS = 450;
const STARTUP_PROMPT_GRACE_MS = 2200;
export const STARTUP_LOCAL_PROMPT_COOLDOWN_MS = 900;
const STEADY_STATE_DELAY_MS = 5000;

const defaultStartupPhaseContext = {
  activeStartupPromptId: null,
  canShowGlobalStartupPrompt: false,
  canShowLocalScreenPrompt: false,
  currentRouteName: null,
  hasRecentStartupPrompt: false,
  isStartupStable: false,
  markInteractionsSettled: () => {},
  markNavigationReady: () => {},
  markStartupPromptDismissed: () => {},
  markStartupPromptShown: () => {},
  notifyRouteChanged: () => {},
  phase: STARTUP_PHASES.BOOT_CORE,
};

const StartupPhaseContext = createContext(defaultStartupPhaseContext);

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function StartupPhaseProvider({ children }) {
  const [phase, setPhase] = useState(STARTUP_PHASES.BOOT_CORE);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [isInteractionsSettled, setIsInteractionsSettled] = useState(false);
  const [isRouteStable, setIsRouteStable] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const [activeStartupPromptId, setActiveStartupPromptId] = useState(null);
  const [hasShownStartupPrompt, setHasShownStartupPrompt] = useState(false);
  const [lastStartupPromptDismissedAt, setLastStartupPromptDismissedAt] = useState(0);
  const [hasRecentStartupPrompt, setHasRecentStartupPrompt] = useState(false);
  const startupPromptWindowOpenedAtRef = useRef(0);
  const lastLoggedPhaseRef = useRef('');
  const routeStabilityTimeoutRef = useRef(0);

  useEffect(() => () => {
    if (routeStabilityTimeoutRef.current) {
      clearTimeout(routeStabilityTimeoutRef.current);
      routeStabilityTimeoutRef.current = 0;
    }
  }, []);

  useEffect(() => {
    let timeoutId;
    if (activeStartupPromptId) {
      setHasRecentStartupPrompt(true);
      return undefined;
    }

    const elapsedSinceDismiss = lastStartupPromptDismissedAt
      ? Date.now() - lastStartupPromptDismissedAt
      : Number.POSITIVE_INFINITY;

    if (elapsedSinceDismiss < STARTUP_LOCAL_PROMPT_COOLDOWN_MS) {
      setHasRecentStartupPrompt(true);
      timeoutId = setTimeout(() => {
        setHasRecentStartupPrompt(false);
      }, STARTUP_LOCAL_PROMPT_COOLDOWN_MS - elapsedSinceDismiss);
      return () => clearTimeout(timeoutId);
    }

    setHasRecentStartupPrompt(false);
    return undefined;
  }, [activeStartupPromptId, lastStartupPromptDismissedAt]);

  useEffect(() => {
    if (
      phase === STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
      || phase === STARTUP_PHASES.STEADY_STATE
    ) {
      return undefined;
    }

    if (!isNavigationReady) {
      setPhase(STARTUP_PHASES.BOOT_CORE);
      return undefined;
    }

    if (!isRouteStable) {
      setPhase(STARTUP_PHASES.NAV_READY);
      return undefined;
    }

    if (!isInteractionsSettled) {
      setPhase(STARTUP_PHASES.ROUTE_STABLE);
      return undefined;
    }

    setPhase((previousPhase) => {
      if (
        previousPhase === STARTUP_PHASES.BOOT_CORE
        || previousPhase === STARTUP_PHASES.NAV_READY
        || previousPhase === STARTUP_PHASES.ROUTE_STABLE
      ) {
        startupPromptWindowOpenedAtRef.current = Date.now();
        return STARTUP_PHASES.STARTUP_PROMPT_WINDOW;
      }
      return previousPhase;
    });

    return undefined;
  }, [isInteractionsSettled, isNavigationReady, isRouteStable, phase]);

  useEffect(() => {
    if (phase !== STARTUP_PHASES.STARTUP_PROMPT_WINDOW) {
      return undefined;
    }

    if (activeStartupPromptId) {
      return undefined;
    }

    const now = Date.now();
    const delayMs = hasShownStartupPrompt
      ? Math.max(
        STARTUP_LOCAL_PROMPT_COOLDOWN_MS - (now - lastStartupPromptDismissedAt),
        0,
      )
      : Math.max(
        STARTUP_PROMPT_GRACE_MS - (now - startupPromptWindowOpenedAtRef.current),
        0,
      );

    const timeoutId = setTimeout(() => {
      setPhase((previousPhase) => (
        previousPhase === STARTUP_PHASES.STARTUP_PROMPT_WINDOW
          ? STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
          : previousPhase
      ));
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [
    activeStartupPromptId,
    hasShownStartupPrompt,
    lastStartupPromptDismissedAt,
    phase,
  ]);

  useEffect(() => {
    if (phase !== STARTUP_PHASES.SCREEN_LOCAL_PROMPTS) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setPhase((previousPhase) => (
        previousPhase === STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
          ? STARTUP_PHASES.STEADY_STATE
          : previousPhase
      ));
    }, STEADY_STATE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [phase]);

  useEffect(() => {
    if (lastLoggedPhaseRef.current === phase) return;
    lastLoggedPhaseRef.current = phase;
    startupPhaseLogger.info('phase_changed', {
      currentRouteName,
      hasRecentStartupPrompt,
      hasShownStartupPrompt,
      phase,
    });
  }, [currentRouteName, hasRecentStartupPrompt, hasShownStartupPrompt, phase]);

  const markNavigationReady = useCallback((routeName = null) => {
    setIsNavigationReady(true);
    setCurrentRouteName(routeName || null);
  }, []);

  const notifyRouteChanged = useCallback((routeName = null) => {
    setCurrentRouteName(routeName || null);
    if (
      phase === STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
      || phase === STARTUP_PHASES.STEADY_STATE
    ) {
      return;
    }
    setIsRouteStable(false);

    if (routeStabilityTimeoutRef.current) {
      clearTimeout(routeStabilityTimeoutRef.current);
    }

    routeStabilityTimeoutRef.current = setTimeout(() => {
      setIsRouteStable(true);
      routeStabilityTimeoutRef.current = 0;
    }, ROUTE_STABILITY_MS);
  }, [phase]);

  const markInteractionsSettled = useCallback(() => {
    setIsInteractionsSettled(true);
  }, []);

  const markStartupPromptShown = useCallback((popupId) => {
    if (!popupId) return;
    setHasShownStartupPrompt(true);
    setActiveStartupPromptId(String(popupId));
  }, []);

  const markStartupPromptDismissed = useCallback((popupId) => {
    setLastStartupPromptDismissedAt(Date.now());
    setActiveStartupPromptId((previousPromptId) => (
      !popupId || previousPromptId === String(popupId) ? null : previousPromptId
    ));
  }, []);

  const canShowGlobalStartupPrompt = phase === STARTUP_PHASES.STARTUP_PROMPT_WINDOW;
  const canShowLocalScreenPrompt = (
    phase === STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
    || phase === STARTUP_PHASES.STEADY_STATE
  ) && !hasRecentStartupPrompt;
  const isStartupStable = phase === STARTUP_PHASES.SCREEN_LOCAL_PROMPTS
    || phase === STARTUP_PHASES.STEADY_STATE;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    /* eslint-disable no-underscore-dangle */
    window.__FC_STARTUP_PHASE__ = {
      activeStartupPromptId,
      canShowGlobalStartupPrompt,
      canShowLocalScreenPrompt,
      currentRouteName,
      hasRecentStartupPrompt,
      isStartupStable,
      phase,
    };
    /* eslint-enable no-underscore-dangle */
  }, [
    activeStartupPromptId,
    canShowGlobalStartupPrompt,
    canShowLocalScreenPrompt,
    currentRouteName,
    hasRecentStartupPrompt,
    isStartupStable,
    phase,
  ]);

  const value = useMemo(() => ({
    activeStartupPromptId,
    canShowGlobalStartupPrompt,
    canShowLocalScreenPrompt,
    currentRouteName,
    hasRecentStartupPrompt,
    isStartupStable,
    markInteractionsSettled,
    markNavigationReady,
    markStartupPromptDismissed,
    markStartupPromptShown,
    notifyRouteChanged,
    phase,
  }), [
    activeStartupPromptId,
    canShowGlobalStartupPrompt,
    canShowLocalScreenPrompt,
    currentRouteName,
    hasRecentStartupPrompt,
    isStartupStable,
    markInteractionsSettled,
    markNavigationReady,
    markStartupPromptDismissed,
    markStartupPromptShown,
    notifyRouteChanged,
    phase,
  ]);

  return React.createElement(
    StartupPhaseContext.Provider,
    { value },
    children,
  );
}

export const useStartupPhase = () => useContext(StartupPhaseContext);
