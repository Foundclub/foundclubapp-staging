import { storage } from '@/store/appContext';

import { getTutorialFlowId, TUTORIAL_FLOW_PREFIX } from './tutorialIds';

const TUTORIAL_STORAGE_PREFIX = 'tutorial-v1';
const ONBOARDING_PROGRESS_PREFIX = 'onboarding-progress-v1';
const FEATURE_SEEN_MAP_SUFFIX = 'feature_seen_map';
const HOME_HUB_SEEN_SUFFIX = 'homehub_seen';
const PROGRAM_VERSION_SUFFIX = 'program_version';

const CURRENT_TUTORIAL_PROGRAM_VERSION = 1;

const toSafeUserId = (userId) => userId || 'anonymous';

const getFeatureSeenMapKey = (userId) => `${TUTORIAL_STORAGE_PREFIX}:${toSafeUserId(userId)}:${FEATURE_SEEN_MAP_SUFFIX}`;
const getHomeHubSeenKey = (userId) => `${TUTORIAL_STORAGE_PREFIX}:${toSafeUserId(userId)}:${HOME_HUB_SEEN_SUFFIX}`;
const getProgramVersionKey = (userId) => `${TUTORIAL_STORAGE_PREFIX}:${toSafeUserId(userId)}:${PROGRAM_VERSION_SUFFIX}`;
const getOnboardingProgressKey = (tutorialId, userId) => `${ONBOARDING_PROGRESS_PREFIX}:${getTutorialFlowId(tutorialId, userId)}:completed`;

/**
 * @param {unknown} rawValue
 * @returns {Record<string, { seenAt?: string; completedAt?: string; source?: string }>}
 */
const parseSeenMap = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') return {};
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (_error) {
    return {};
  }
};

/**
 * @param {string | undefined | null} userId
 * @returns {Record<string, { seenAt?: string; completedAt?: string; source?: string }>}
 */
export const getTutorialSeenMap = (userId) => (
  parseSeenMap(storage.getString(getFeatureSeenMapKey(userId)))
);

/**
 * @param {string | undefined | null} userId
 * @param {string} tutorialId
 * @returns {{ seenAt?: string; completedAt?: string; source?: string }}
 */
export const getTutorialState = (userId, tutorialId) => {
  const map = getTutorialSeenMap(userId);
  return map?.[tutorialId] || {};
};

/**
 * @param {string | undefined | null} userId
 * @param {string} tutorialId
 * @param {{ seenAt?: string; completedAt?: string; source?: string }} partialState
 */
export const setTutorialState = (userId, tutorialId, partialState) => {
  const seenMap = getTutorialSeenMap(userId);
  seenMap[tutorialId] = {
    ...seenMap[tutorialId],
    ...partialState,
  };
  storage.set(getFeatureSeenMapKey(userId), JSON.stringify(seenMap));
};

/**
 * @param {string | undefined | null} userId
 * @param {string} tutorialId
 * @param {'auto' | 'manual' | 'homeHub'} [source]
 */
export const markTutorialSeen = (userId, tutorialId, source = 'auto') => {
  setTutorialState(userId, tutorialId, {
    seenAt: new Date().toISOString(),
    source,
  });
};

/**
 * @param {string | undefined | null} userId
 * @param {string} tutorialId
 * @param {'auto' | 'manual' | 'homeHub'} [source]
 */
export const markTutorialCompleted = (userId, tutorialId, source = 'auto') => {
  setTutorialState(userId, tutorialId, {
    completedAt: new Date().toISOString(),
    source,
  });
};

/**
 * @param {string | undefined | null} userId
 * @param {string} tutorialId
 * @returns {boolean}
 */
export const hasSeenTutorial = (userId, tutorialId) => Boolean(getTutorialState(userId, tutorialId)?.seenAt);

/**
 * @param {string | undefined | null} userId
 * @returns {boolean}
 */
export const hasSeenHomeHubTutorial = (userId) => (
  storage.getBoolean(getHomeHubSeenKey(userId)) || false
);

/**
 * @param {string | undefined | null} userId
 * @param {boolean} [value]
 */
export const setHomeHubTutorialSeen = (userId, value = true) => {
  storage.set(getHomeHubSeenKey(userId), Boolean(value));
};

/**
 * @param {string | undefined | null} userId
 * @returns {number}
 */
export const getTutorialProgramVersion = (userId) => (
  storage.getNumber(getProgramVersionKey(userId)) || 0
);

/**
 * @param {string | undefined | null} userId
 * @param {number} [version]
 */
export const setTutorialProgramVersion = (userId, version = CURRENT_TUTORIAL_PROGRAM_VERSION) => {
  storage.set(getProgramVersionKey(userId), Number(version));
};

/**
 * @param {string | undefined | null} userId
 * @param {string} tutorialId
 */
export const resetTutorialState = (userId, tutorialId) => {
  const seenMap = getTutorialSeenMap(userId);
  if (seenMap[tutorialId]) {
    delete seenMap[tutorialId];
    storage.set(getFeatureSeenMapKey(userId), JSON.stringify(seenMap));
  }
  storage.delete(getOnboardingProgressKey(tutorialId, userId));
};

/**
 * @param {string | undefined | null} userId
 * @returns {number}
 */
export const resetAllTutorialsForUser = (userId) => {
  const normalizedUserId = toSafeUserId(userId);
  let deletedCount = 0;

  storage.delete(getFeatureSeenMapKey(normalizedUserId));
  storage.delete(getHomeHubSeenKey(normalizedUserId));
  storage.delete(getProgramVersionKey(normalizedUserId));
  deletedCount += 3;

  const allKeys = storage.getAllKeys?.() || [];
  allKeys.forEach((key) => {
    const shouldDeleteOnboardingFlow = key.startsWith(`${ONBOARDING_PROGRESS_PREFIX}:${TUTORIAL_FLOW_PREFIX}:`)
      && key.endsWith(`:${normalizedUserId}:completed`);

    if (shouldDeleteOnboardingFlow) {
      storage.delete(key);
      deletedCount += 1;
    }
  });

  return deletedCount;
};

export { CURRENT_TUTORIAL_PROGRAM_VERSION };
