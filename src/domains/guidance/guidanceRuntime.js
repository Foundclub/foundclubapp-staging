/* eslint-disable no-console */
// @ts-nocheck
const listeners = new Set();

const emitGuidanceSignal = (signal) => {
  listeners.forEach((listener) => {
    try {
      listener(signal);
    } catch (error) {
      console.warn('[guidanceRuntime] listener failed', error);
    }
  });
};

const buildSignal = (kind, key, meta = {}) => ({
  key,
  kind,
  occurredAt: new Date().toISOString(),
  ...meta,
});

export const subscribeToGuidanceSignals = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitGuidanceRouteVisit = (routeName, meta = {}) => {
  if (typeof routeName !== 'string' || routeName.trim().length === 0) {
    return;
  }

  emitGuidanceSignal(buildSignal('route', routeName.trim(), meta));
};

export const emitGuidanceInteraction = (key, meta = {}) => {
  if (typeof key !== 'string' || key.trim().length === 0) {
    return;
  }

  emitGuidanceSignal(buildSignal('interaction', key.trim(), meta));
};

export const emitGuidanceAction = (key, meta = {}) => {
  if (typeof key !== 'string' || key.trim().length === 0) {
    return;
  }

  emitGuidanceSignal(buildSignal('action', key.trim(), meta));
};

export const resetGuidanceRuntimeForTests = () => {
  listeners.clear();
};
