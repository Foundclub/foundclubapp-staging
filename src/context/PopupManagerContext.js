import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { storage } from '@/store/appContext';

import { createLogger } from '@/utils/logger/logger';

import {
  getPopupDescriptor,
  POPUP_DISMISS_SCOPES,
} from '@/constants/popupRegistry';
import {
  buildPopupDismissKey,
  isPopupDismissalActive,
  parsePopupDismissalRecord,
  serializePopupDismissalRecord,
  shouldDeferStartupPopup,
} from '@/context/popupManagerUtils';

const popupManagerLogger = createLogger('popup-manager');
export const STARTUP_QUIET_WINDOW_MS = 10000;

const defaultPopupManagerContext = {
  clearDismissal: () => {},
  dismissPopup: () => {},
  isPopupDismissed: () => false,
  isStartupWindowActive: false,
  markPopupShown: () => {},
  popupStateVersion: 0,
  recordPopupEvent: () => {},
  shownStartupBlockingPopupId: null,
};

const PopupManagerContext = createContext(defaultPopupManagerContext);

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export function PopupManagerProvider({ children }) {
  const sessionDismissalsRef = useRef(new Set());
  const [popupStateVersion, bumpPopupStateVersion] = useReducer((value) => value + 1, 0);
  const [isStartupWindowActive, setIsStartupWindowActive] = useState(true);
  const [shownStartupBlockingPopupId, setShownStartupBlockingPopupId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsStartupWindowActive(false);
    }, STARTUP_QUIET_WINDOW_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line no-underscore-dangle
    window.__FC_POPUP_MANAGER__ = {
      isStartupWindowActive,
      shownStartupBlockingPopupId,
    };
  }, [isStartupWindowActive, shownStartupBlockingPopupId]);

  const recordPopupEvent = useCallback((popupId, eventName, meta = undefined) => {
    if (!popupId || !eventName) return;
    popupManagerLogger.info('popup_event', {
      ...meta,
      eventName,
      popupId,
    });
  }, []);

  const isPopupDismissed = useCallback((popupId, options = {}) => {
    const descriptor = getPopupDescriptor(popupId);
    const dismissScope = options.dismissScope || descriptor.dismissScope || POPUP_DISMISS_SCOPES.SESSION;
    const cooldownKey = options.cooldownKey || 'default';
    const normalizedPopupId = descriptor.id;

    if (!normalizedPopupId) return false;

    if (dismissScope === POPUP_DISMISS_SCOPES.SESSION) {
      return sessionDismissalsRef.current.has(buildPopupDismissKey(normalizedPopupId, cooldownKey));
    }

    const rawValue = storage.getString(buildPopupDismissKey(normalizedPopupId, cooldownKey));
    const record = parsePopupDismissalRecord(rawValue);
    return isPopupDismissalActive(record, { stateKey: options.stateKey });
  }, []);

  const dismissPopup = useCallback((popupId, options = {}) => {
    const descriptor = getPopupDescriptor(popupId);
    const dismissScope = options.dismissScope || descriptor.dismissScope || POPUP_DISMISS_SCOPES.SESSION;
    const cooldownKey = options.cooldownKey || 'default';
    const storageKey = buildPopupDismissKey(descriptor.id, cooldownKey);

    if (dismissScope === POPUP_DISMISS_SCOPES.SESSION) {
      sessionDismissalsRef.current.add(storageKey);
    } else {
      storage.set(storageKey, serializePopupDismissalRecord({
        dismissedAt: Date.now(),
        scope: dismissScope,
        stateKey: options.stateKey,
      }));
    }

    bumpPopupStateVersion();
    recordPopupEvent(descriptor.id, 'dismissed', {
      cooldownKey,
      dismissScope,
      stateKey: options.stateKey,
    });
  }, [recordPopupEvent]);

  const clearDismissal = useCallback((popupId, options = {}) => {
    const descriptor = getPopupDescriptor(popupId);
    const cooldownKey = options.cooldownKey || 'default';
    const storageKey = buildPopupDismissKey(descriptor.id, cooldownKey);

    sessionDismissalsRef.current.delete(storageKey);
    storage.delete(storageKey);
    bumpPopupStateVersion();
  }, []);

  const markPopupShown = useCallback((popupId, options = {}) => {
    const descriptor = getPopupDescriptor(popupId);
    if (
      descriptor.blocking
      && descriptor.kind === 'startup_blocking'
      && isStartupWindowActive
      && !shownStartupBlockingPopupId
    ) {
      setShownStartupBlockingPopupId(descriptor.id);
    }

    recordPopupEvent(descriptor.id, 'shown', options);
  }, [isStartupWindowActive, recordPopupEvent, shownStartupBlockingPopupId]);

  const value = useMemo(() => ({
    clearDismissal,
    dismissPopup,
    isPopupDismissed,
    isStartupWindowActive,
    markPopupShown,
    popupStateVersion,
    recordPopupEvent,
    shownStartupBlockingPopupId,
  }), [
    clearDismissal,
    dismissPopup,
    isPopupDismissed,
    isStartupWindowActive,
    markPopupShown,
    popupStateVersion,
    recordPopupEvent,
    shownStartupBlockingPopupId,
  ]);

  return React.createElement(
    PopupManagerContext.Provider,
    { value },
    children,
  );
}

export const usePopupManager = () => useContext(PopupManagerContext);

/**
 * @param {string | import('@/constants/popupRegistry').PopupDescriptor} descriptorOrId
 * @param {boolean} enabled
 * @param {{
 *  cooldownKey?: string;
 *  dismissScope?: string;
 *  routeName?: string | null;
 *  stateKey?: string;
 * }} [options]
 */
export const usePopupEligibility = (descriptorOrId, enabled, options = {}) => {
  const descriptor = getPopupDescriptor(
    typeof descriptorOrId === 'string' ? descriptorOrId : descriptorOrId?.id,
  );
  const {
    clearDismissal,
    dismissPopup,
    isPopupDismissed,
    isStartupWindowActive,
    markPopupShown,
    popupStateVersion,
    recordPopupEvent,
    shownStartupBlockingPopupId,
  } = usePopupManager();
  const dismissalStateRef = useRef('');
  const normalizedCooldownKey = String(options.cooldownKey || 'default');
  const dismissScope = options.dismissScope || descriptor.dismissScope || POPUP_DISMISS_SCOPES.SESSION;
  const routeName = typeof options.routeName === 'string' ? options.routeName : null;
  const isRouteAllowed = !Array.isArray(descriptor.allowedRoutes)
    || descriptor.allowedRoutes.length === 0
    || !routeName
    || descriptor.allowedRoutes.includes(routeName);
  const isDismissed = isPopupDismissed(descriptor.id, {
    cooldownKey: normalizedCooldownKey,
    dismissScope,
    stateKey: options.stateKey,
  });
  const isDeferred = shouldDeferStartupPopup({
    descriptor,
    isStartupWindowActive,
    shownStartupBlockingPopupId,
  });
  const canShow = Boolean(enabled && isRouteAllowed && !isDismissed && !isDeferred);

  useEffect(() => {
    if (!enabled) {
      dismissalStateRef.current = '';
      return;
    }

    let nextState = 'hidden';
    if (canShow) {
      nextState = 'eligible';
    } else if (isDeferred) {
      nextState = 'skipped_due_to_priority';
    } else if (isDismissed) {
      nextState = 'dismissed';
    }

    if (dismissalStateRef.current === nextState) {
      return;
    }

    dismissalStateRef.current = nextState;
    if (nextState === 'hidden') {
      return;
    }

    recordPopupEvent(descriptor.id, nextState, {
      cooldownKey: normalizedCooldownKey,
      dismissScope,
      popupStateVersion,
      routeName,
      stateKey: options.stateKey,
    });
  }, [
    canShow,
    descriptor.id,
    dismissScope,
    enabled,
    isDeferred,
    isDismissed,
    normalizedCooldownKey,
    options.stateKey,
    popupStateVersion,
    recordPopupEvent,
    routeName,
  ]);

  return useMemo(() => ({
    canShow,
    clearDismissal: () => clearDismissal(descriptor.id, { cooldownKey: normalizedCooldownKey }),
    descriptor,
    dismiss: (overrideScope = dismissScope) => dismissPopup(descriptor.id, {
      cooldownKey: normalizedCooldownKey,
      dismissScope: overrideScope,
      stateKey: options.stateKey,
    }),
    isDeferred,
    isDismissed,
    isStartupWindowActive,
    markShown: (meta = undefined) => markPopupShown(descriptor.id, meta),
    trackEvent: (eventName, meta = undefined) => recordPopupEvent(descriptor.id, eventName, meta),
  }), [
    canShow,
    clearDismissal,
    descriptor,
    dismissPopup,
    dismissScope,
    isDeferred,
    isDismissed,
    isStartupWindowActive,
    markPopupShown,
    normalizedCooldownKey,
    options.stateKey,
    recordPopupEvent,
  ]);
};
