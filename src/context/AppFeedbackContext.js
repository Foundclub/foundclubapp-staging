import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const DEFAULT_BANNER_DURATION_MS = 3200;

/**
 * @typedef {{
 *   id: string;
 *   tone?: 'success' | 'error' | 'info' | 'league';
 *   title: string;
 *   body?: string;
 *   durationMs?: number;
 *   actionLabel?: string;
 *   onAction?: (() => void) | null;
 * }} AppBannerPayload
 */

/**
 * @typedef {{
 *   activeBanner: AppBannerPayload | null;
 *   dismissBanner: () => void;
 *   showBanner: (payload: Omit<AppBannerPayload, 'id'>) => string;
 * }} AppFeedbackContextValue
 */

const AppFeedbackContext = createContext(
  /** @type {AppFeedbackContextValue} */ ({
    activeBanner: null,
    dismissBanner: () => {},
    showBanner: () => '',
  }),
);

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function AppFeedbackProvider({ children }) {
  const [activeBanner, setActiveBanner] = useState(/** @type {AppBannerPayload | null} */ (null));
  const [queue, setQueue] = useState(/** @type {AppBannerPayload[]} */ ([]));
  const bannerCounterRef = useRef(0);

  const dismissBanner = useCallback(() => {
    setActiveBanner(null);
  }, []);

  const showBanner = useCallback((payload) => {
    bannerCounterRef.current += 1;
    const bannerId = `banner-${Date.now()}-${bannerCounterRef.current}`;
    const nextBanner = {
      actionLabel: payload?.actionLabel,
      body: payload?.body,
      durationMs: Number(payload?.durationMs) > 0 ? Number(payload.durationMs) : DEFAULT_BANNER_DURATION_MS,
      id: bannerId,
      onAction: typeof payload?.onAction === 'function' ? payload.onAction : null,
      title: String(payload?.title || '').trim() || 'Information',
      tone: payload?.tone || 'info',
    };
    setQueue((previousQueue) => [...previousQueue, nextBanner]);
    return bannerId;
  }, []);

  useEffect(() => {
    if (activeBanner || queue.length === 0) return;
    setActiveBanner(queue[0]);
    setQueue((previousQueue) => previousQueue.slice(1));
  }, [activeBanner, queue]);

  const value = useMemo(() => ({
    activeBanner,
    dismissBanner,
    showBanner,
  }), [activeBanner, dismissBanner, showBanner]);

  return React.createElement(
    AppFeedbackContext.Provider,
    { value },
    children,
  );
}

export const useAppFeedback = () => useContext(AppFeedbackContext);
