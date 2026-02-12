import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';

const DEFAULT_DEDUPE_TTL_MS = 15000;

const SmartNotificationContext = createContext({
  activeRecap: null,
  activeSnackbar: null,
  consumeNotification: () => {},
  dismissRecap: () => {},
  dismissSnackbar: () => {},
  openRecapSheet: () => {},
  recapSheetVisible: false,
});

const isRecapType = (type) => (
  type === NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED
);

const getDedupeKey = (payload = {}) => {
  if (payload.dedupeKey) return String(payload.dedupeKey);
  if (payload.notificationId) return String(payload.notificationId);
  return `${payload.type || 'unknown'}:${payload.matchId || ''}:${payload.phase || ''}`;
};

export const SmartNotificationProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const [activeSnackbar, setActiveSnackbar] = useState(null);
  const [activeRecap, setActiveRecap] = useState(null);
  const [recapSheetVisible, setRecapSheetVisible] = useState(false);
  const dedupeRef = useRef(new Map());

  const cleanupDedupeCache = useCallback(() => {
    const now = Date.now();
    for (const [key, timestamp] of dedupeRef.current.entries()) {
      if (now - timestamp > DEFAULT_DEDUPE_TTL_MS) {
        dedupeRef.current.delete(key);
      }
    }
  }, []);

  const consumeNotification = useCallback((payload = {}) => {
    if (!payload?.type) return;
    cleanupDedupeCache();
    const dedupeKey = getDedupeKey(payload);
    if (dedupeRef.current.has(dedupeKey)) return;
    dedupeRef.current.set(dedupeKey, Date.now());

    if (isRecapType(payload.type)) {
      setActiveRecap(payload);
      setRecapSheetVisible(false);
      return;
    }

    setQueue((prev) => [...prev, payload]);
  }, [cleanupDedupeCache]);

  useEffect(() => {
    if (activeSnackbar || queue.length === 0) return;
    setActiveSnackbar(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [activeSnackbar, queue]);

  const dismissSnackbar = useCallback(() => {
    setActiveSnackbar(null);
  }, []);

  const dismissRecap = useCallback(() => {
    setActiveRecap(null);
    setRecapSheetVisible(false);
  }, []);

  const openRecapSheet = useCallback(() => {
    if (!activeRecap) return;
    setRecapSheetVisible(true);
  }, [activeRecap]);

  const value = useMemo(() => ({
    activeRecap,
    activeSnackbar,
    consumeNotification,
    dismissRecap,
    dismissSnackbar,
    openRecapSheet,
    recapSheetVisible,
    setActiveSnackbar,
    setRecapSheetVisible,
  }), [
    activeRecap,
    activeSnackbar,
    consumeNotification,
    dismissRecap,
    dismissSnackbar,
    openRecapSheet,
    recapSheetVisible,
  ]);

  return (
    <SmartNotificationContext.Provider value={value}>
      {children}
    </SmartNotificationContext.Provider>
  );
};

export const useSmartNotifications = () => useContext(SmartNotificationContext);
