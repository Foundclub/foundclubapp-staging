// @ts-nocheck
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { subscribeToCelebrations } from '@/services/celebrations/celebrationRuntime';

const DEFAULT_BANNER_DURATION_MS = 3200;
const DEFAULT_BANNER_PRIORITY = 1;
const DEFAULT_BANNER_VARIANT = 'banner';
const BANNER_DEDUPE_FALLBACK_WINDOW_MS = 4000;

/**
 * @typedef {{
 *   id: string;
 *   tone?: 'success' | 'error' | 'info' | 'league';
 *   variant?: 'banner' | 'celebration';
 *   eyebrow?: string;
 *   title: string;
 *   body?: string;
 *   durationMs?: number;
 *   actionLabel?: string;
 *   onAction?: (() => void) | null;
 *   dedupeKey?: string;
 *   priority?: number;
 *   progressBar?: boolean;
 *   category?: string;
 *   metadata?: Record<string, any> | null;
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
  const recentBannerMapRef = useRef(new Map());

  const dismissBanner = useCallback(() => {
    setActiveBanner(null);
  }, []);

  const buildFallbackDedupeKey = useCallback((payload) => [
    payload?.variant || DEFAULT_BANNER_VARIANT,
    payload?.tone || 'info',
    String(payload?.title || '').trim().toLowerCase(),
    String(payload?.body || '').trim().toLowerCase(),
  ].filter(Boolean).join('|'), []);

  const showBanner = useCallback((payload) => {
    const now = Date.now();
    const dedupeKey = String(payload?.dedupeKey || buildFallbackDedupeKey(payload)).trim();
    const dedupeWindowMs = Number(payload?.cooldownMs) > 0
      ? Number(payload.cooldownMs)
      : BANNER_DEDUPE_FALLBACK_WINDOW_MS;
    if (dedupeKey) {
      const previousAt = recentBannerMapRef.current.get(dedupeKey);
      if (previousAt && now - previousAt < dedupeWindowMs) {
        if (__DEV__) {
          console.info('[celebrations] deduped', {
            dedupeKey,
            title: payload?.title,
          });
        }
        return dedupeKey;
      }
      recentBannerMapRef.current.set(dedupeKey, now);
      if (recentBannerMapRef.current.size > 120) {
        const oldestKey = recentBannerMapRef.current.keys().next().value;
        if (oldestKey) {
          recentBannerMapRef.current.delete(oldestKey);
        }
      }
    }

    bannerCounterRef.current += 1;
    const bannerId = `banner-${Date.now()}-${bannerCounterRef.current}`;
    const nextBanner = {
      actionLabel: payload?.actionLabel,
      body: payload?.body,
      category: payload?.category,
      dedupeKey,
      durationMs: Number(payload?.durationMs) > 0 ? Number(payload.durationMs) : DEFAULT_BANNER_DURATION_MS,
      eyebrow: payload?.eyebrow,
      id: bannerId,
      metadata: payload?.metadata || null,
      onAction: typeof payload?.onAction === 'function' ? payload.onAction : null,
      priority: Number.isFinite(Number(payload?.priority))
        ? Number(payload.priority)
        : DEFAULT_BANNER_PRIORITY,
      progressBar: payload?.progressBar !== false,
      title: String(payload?.title || '').trim() || 'Information',
      tone: payload?.tone || 'info',
      variant: payload?.variant || DEFAULT_BANNER_VARIANT,
    };
    setQueue((previousQueue) => {
      const nextQueue = [...previousQueue, nextBanner];
      nextQueue.sort((left, right) => {
        const priorityDiff = Number(right?.priority || 0) - Number(left?.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return String(left?.id || '').localeCompare(String(right?.id || ''));
      });
      if (__DEV__) {
        console.info('[celebrations] queued', {
          queueLength: nextQueue.length,
          title: nextBanner.title,
          variant: nextBanner.variant,
        });
      }
      return nextQueue;
    });
    return bannerId;
  }, [buildFallbackDedupeKey]);

  useEffect(() => subscribeToCelebrations((payload) => {
    showBanner(payload);
  }), [showBanner]);

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
