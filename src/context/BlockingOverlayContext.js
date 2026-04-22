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

const blockingOverlayLogger = createLogger('blocking-overlay');

const defaultBlockingOverlayContext = {
  acquireRenderLock: () => false,
  activePromptId: null,
  dequeuePrompt: () => {},
  enqueuePrompt: () => {},
  releaseRenderLock: () => {},
  renderLockOwnerId: null,
};

const BlockingOverlayContext = createContext(defaultBlockingOverlayContext);

const sortRequests = (requests) => [...requests].sort((left, right) => {
  if ((right?.priority || 0) !== (left?.priority || 0)) {
    return (right?.priority || 0) - (left?.priority || 0);
  }
  return (left?.order || 0) - (right?.order || 0);
});

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function BlockingOverlayProvider({ children }) {
  const requestOrderRef = useRef(0);
  const releaseTimersRef = useRef(new Map());
  const [requests, setRequests] = useState([]);
  const [renderLockOwnerId, setRenderLockOwnerId] = useState(null);
  const activePromptId = renderLockOwnerId || requests[0]?.id || null;

  const enqueuePrompt = useCallback((id, priority = 0) => {
    if (!id) return;

    setRequests((previousRequests) => {
      const existingRequest = previousRequests.find((request) => request.id === id);
      if (existingRequest) {
        if (existingRequest.priority === priority) {
          return previousRequests;
        }
        return sortRequests(previousRequests.map((request) => (
          request.id === id
            ? {
              ...request,
              priority,
            }
            : request
        )));
      }

      const nextOrder = requestOrderRef.current + 1;
      requestOrderRef.current = nextOrder;
      blockingOverlayLogger.info('queued', {
        id,
        priority,
      });
      return sortRequests([
        ...previousRequests,
        {
          id,
          order: nextOrder,
          priority,
        },
      ]);
    });
  }, []);

  const dequeuePrompt = useCallback((id) => {
    if (!id) return;

    setRequests((previousRequests) => {
      const nextRequests = previousRequests.filter((request) => request.id !== id);
      if (nextRequests.length !== previousRequests.length) {
        blockingOverlayLogger.info('dequeued', { id });
      }
      return nextRequests.length === previousRequests.length
        ? previousRequests
        : nextRequests;
    });
  }, []);

  const acquireRenderLock = useCallback((id) => {
    if (!id) return false;

    const existingTimer = releaseTimersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      releaseTimersRef.current.delete(id);
    }

    let didAcquire = false;
    setRenderLockOwnerId((previousOwnerId) => {
      if (!previousOwnerId || previousOwnerId === id) {
        didAcquire = true;
        blockingOverlayLogger.info('lock_acquired', { id });
        return id;
      }
      return previousOwnerId;
    });

    return didAcquire;
  }, []);

  const releaseRenderLock = useCallback((id, options = {}) => {
    if (!id) return;

    const existingTimer = releaseTimersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      releaseTimersRef.current.delete(id);
    }

    const delayMs = Number(options.delayMs || 0);
    if (delayMs > 0) {
      const timeoutId = setTimeout(() => {
        setRenderLockOwnerId((previousOwnerId) => (previousOwnerId === id ? null : previousOwnerId));
        releaseTimersRef.current.delete(id);
        blockingOverlayLogger.info('lock_released', { delayMs, id });
      }, delayMs);
      releaseTimersRef.current.set(id, timeoutId);
      return;
    }

    setRenderLockOwnerId((previousOwnerId) => {
      if (previousOwnerId === id) {
        blockingOverlayLogger.info('lock_released', { id });
        return null;
      }
      return previousOwnerId;
    });
  }, []);

  useEffect(() => () => {
    releaseTimersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    releaseTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const queue = requests.map((request) => ({
      id: request.id,
      order: request.order,
      priority: request.priority,
    }));
    /* eslint-disable no-underscore-dangle */
    window.__FC_ACTIVE_BLOCKING_OVERLAY__ = activePromptId;
    window.__FC_BLOCKING_OVERLAY_DEBUG__ = {
      activePromptId,
      queue,
      renderLockOwnerId,
    };
    /* eslint-enable no-underscore-dangle */
  }, [activePromptId, renderLockOwnerId, requests]);

  const value = useMemo(() => ({
    acquireRenderLock,
    activePromptId,
    dequeuePrompt,
    enqueuePrompt,
    releaseRenderLock,
    renderLockOwnerId,
  }), [
    activePromptId,
    acquireRenderLock,
    dequeuePrompt,
    enqueuePrompt,
    releaseRenderLock,
    renderLockOwnerId,
  ]);

  return React.createElement(
    BlockingOverlayContext.Provider,
    { value },
    children,
  );
}

export const useBlockingOverlayContext = () => useContext(BlockingOverlayContext);

export const useBlockingOverlayPrompt = (id, enabled, priority = 0) => {
  const { activePromptId, dequeuePrompt, enqueuePrompt } = useBlockingOverlayContext();

  React.useEffect(() => {
    if (!enabled) {
      dequeuePrompt(id);
      return undefined;
    }

    enqueuePrompt(id, priority);
    return () => dequeuePrompt(id);
  }, [dequeuePrompt, enabled, enqueuePrompt, id, priority]);

  return Boolean(enabled) && activePromptId === id;
};

export const useBlockingOverlayLifecycle = (id, isVisible, options = {}) => {
  const { acquireRenderLock, releaseRenderLock } = useBlockingOverlayContext();
  const previousVisibleRef = useRef(false);
  const releaseDelayMs = Number(options.releaseDelayMs || 280);

  useEffect(() => {
    if (isVisible) {
      acquireRenderLock(id);
      previousVisibleRef.current = true;
      return undefined;
    }

    if (previousVisibleRef.current) {
      releaseRenderLock(id, { delayMs: releaseDelayMs });
      previousVisibleRef.current = false;
    }

    return undefined;
  }, [acquireRenderLock, id, isVisible, releaseDelayMs, releaseRenderLock]);

  useEffect(() => () => {
    releaseRenderLock(id);
  }, [id, releaseRenderLock]);
};
