/* eslint-disable no-console */
// @ts-nocheck
import { getItem, removeItem, setItem } from '@/platform/storage';

const GUIDANCE_STORAGE_PREFIX = 'fc-guidance-state-v1';

const getGuidanceStorageKey = (userId) => `${GUIDANCE_STORAGE_PREFIX}:${userId || 'anonymous'}`;

export const readStoredGuidanceState = (userId) => {
  if (!userId) return null;

  try {
    const rawValue = getItem(getGuidanceStorageKey(userId));
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      return null;
    }
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn('[guidanceStorage] read failed', error);
    return null;
  }
};

export const persistGuidanceState = (userId, state) => {
  if (!userId) return;

  try {
    setItem(getGuidanceStorageKey(userId), JSON.stringify(state));
  } catch (error) {
    console.warn('[guidanceStorage] persist failed', error);
  }
};

export const clearStoredGuidanceState = (userId) => {
  if (!userId) return;

  try {
    removeItem(getGuidanceStorageKey(userId));
  } catch (error) {
    console.warn('[guidanceStorage] clear failed', error);
  }
};
