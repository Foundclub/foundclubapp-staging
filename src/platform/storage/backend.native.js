import { MMKV } from 'react-native-mmkv';

const inMemoryStorageMap = new Map();

const fallbackStorage = {
  addOnValueChangedListener: () => ({ remove: () => {} }),
  clearAll: () => inMemoryStorageMap.clear(),
  contains: (key) => inMemoryStorageMap.has(key),
  delete: (key) => inMemoryStorageMap.delete(key),
  getAllKeys: () => Array.from(inMemoryStorageMap.keys()),
  getBoolean: (key) => {
    const value = inMemoryStorageMap.get(key);
    return typeof value === 'boolean' ? value : false;
  },
  getNumber: (key) => {
    const value = inMemoryStorageMap.get(key);
    return typeof value === 'number' ? value : 0;
  },
  getString: (key) => {
    const value = inMemoryStorageMap.get(key);
    if (typeof value === 'string') return value;
    if (value === undefined || value === null) return undefined;
    return String(value);
  },
  set: (key, value) => {
    inMemoryStorageMap.set(key, value);
  },
};

let storageInstance = null;

export const getStorageBackend = () => {
  if (storageInstance) {
    return storageInstance;
  }

  try {
    storageInstance = new MMKV();
  } catch (error) {
    console.warn('[PlatformStorage] MMKV unavailable, using in-memory fallback storage.', error);
    storageInstance = fallbackStorage;
  }

  return storageInstance;
};

export default getStorageBackend();
