const STORAGE_PREFIX = 'fc:app:';
const listeners = new Set();
const fallbackMemoryStore = new Map();

const canUseLocalStorage = () => (
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
);

const notifyListeners = (key) => {
  listeners.forEach((listener) => {
    try {
      listener(key);
    } catch (error) {
      console.warn('[PlatformStorage] Listener failed.', error);
    }
  });
};

const toStorageKey = (key) => `${STORAGE_PREFIX}${key}`;

const serializeValue = (value) => JSON.stringify({
  __fcStoredValue: true,
  value,
});

const parseStoredPayload = (rawValue) => {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && parsed.__fcStoredValue) {
      return parsed.value;
    }
  } catch (_error) {
    return rawValue;
  }

  return rawValue;
};

const getAllScopedKeys = () => {
  if (!canUseLocalStorage()) {
    return Array.from(fallbackMemoryStore.keys());
  }

  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .map((key) => key.slice(STORAGE_PREFIX.length));
};

const getRawValue = (key) => {
  if (!canUseLocalStorage()) {
    return fallbackMemoryStore.get(key);
  }

  return window.localStorage.getItem(toStorageKey(key)) ?? undefined;
};

const setRawValue = (key, rawValue) => {
  if (!canUseLocalStorage()) {
    fallbackMemoryStore.set(key, rawValue);
    notifyListeners(key);
    return;
  }

  window.localStorage.setItem(toStorageKey(key), rawValue);
  notifyListeners(key);
};

const deleteRawValue = (key) => {
  if (!canUseLocalStorage()) {
    fallbackMemoryStore.delete(key);
    notifyListeners(key);
    return;
  }

  window.localStorage.removeItem(toStorageKey(key));
  notifyListeners(key);
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    const storageKey = String(event.key || '');
    if (!storageKey.startsWith(STORAGE_PREFIX)) {
      return;
    }
    notifyListeners(storageKey.slice(STORAGE_PREFIX.length));
  });
}

export const getStorageBackend = () => ({
  addOnValueChangedListener: (listener) => {
    listeners.add(listener);
    return {
      remove: () => listeners.delete(listener),
    };
  },
  clearAll: () => {
    getAllScopedKeys().forEach((key) => deleteRawValue(key));
  },
  contains: (key) => {
    if (!canUseLocalStorage()) {
      return fallbackMemoryStore.has(key);
    }
    return window.localStorage.getItem(toStorageKey(key)) !== null;
  },
  delete: (key) => {
    deleteRawValue(key);
  },
  getAllKeys: () => getAllScopedKeys(),
  getBoolean: (key) => {
    const value = parseStoredPayload(getRawValue(key));
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return false;
  },
  getNumber: (key) => {
    const value = parseStoredPayload(getRawValue(key));
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  },
  getString: (key) => {
    const value = parseStoredPayload(getRawValue(key));
    if (typeof value === 'string') return value;
    if (value === undefined || value === null) return undefined;
    return String(value);
  },
  set: (key, value) => {
    setRawValue(key, serializeValue(value));
  },
});

const storageBackend = getStorageBackend();

export default storageBackend;
