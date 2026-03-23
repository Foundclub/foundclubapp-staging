import { MMKV } from 'react-native-mmkv';

const DEDUPE_STORAGE_KEY = 'notification-dedupe-keys-v1';
const MAX_KEYS = 100;
const TTL_MS = 24 * 60 * 60 * 1000;

/** @type {MMKV | null} */
let dedupeStorageInstance = null;

const getStorage = () => {
  if (!dedupeStorageInstance) {
    dedupeStorageInstance = new MMKV({
      id: 'notification-dedupe-storage',
    });
  }
  return dedupeStorageInstance;
};

const readEntries = () => {
  try {
    const raw = getStorage().getString(DEDUPE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const writeEntries = (entries) => {
  getStorage().set(DEDUPE_STORAGE_KEY, JSON.stringify(entries));
};

const normalizeEntries = (entries, now = Date.now()) => {
  const filtered = entries
    .filter((entry) => entry && typeof entry.key === 'string' && entry.key.length > 0)
    .filter((entry) => Number.isFinite(Number(entry.ts)) && (now - Number(entry.ts)) <= TTL_MS)
    .sort((a, b) => Number(b.ts) - Number(a.ts));

  return filtered.slice(0, MAX_KEYS);
};

export const hasRecentNotificationKey = (key, now = Date.now()) => {
  if (!key) return false;
  const entries = normalizeEntries(readEntries(), now);
  return entries.some((entry) => entry.key === key);
};

export const rememberNotificationKey = (key, now = Date.now()) => {
  if (!key) return;
  const entries = normalizeEntries(readEntries(), now)
    .filter((entry) => entry.key !== key);
  entries.unshift({ key, ts: now });
  writeEntries(entries.slice(0, MAX_KEYS));
};

export const isDuplicateNotificationKey = (key, now = Date.now()) => {
  if (!key) return false;
  const duplicate = hasRecentNotificationKey(key, now);
  rememberNotificationKey(key, now);
  return duplicate;
};
