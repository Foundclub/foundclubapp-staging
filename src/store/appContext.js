import React, { useContext, useEffect, useReducer } from 'react';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import appReducer from '@/store/appReducer';

const AppStateContext = React.createContext(/** @type {Store} */({}));
const AppDispatchContext = React
  .createContext(/** @type {React.Dispatch<{ type: AppContextTypes; payload?: any; }>} */({}));

let storageInstance = null;
let storageBackend = 'mmkv';
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

export const getStorage = () => {
  if (Platform.OS === 'web') {
    storageBackend = 'memory-fallback-web';
    return fallbackStorage;
  }

  if (!storageInstance) {
    try {
      storageInstance = new MMKV();
      storageBackend = 'mmkv';
    } catch (error) {
      console.warn('[AppContext] MMKV unavailable, using in-memory fallback storage.', error);
      storageInstance = fallbackStorage;
      storageBackend = 'memory-fallback-mmkv-error';
    }
  }
  return storageInstance;
};

export const storage = {
  addOnValueChangedListener: (listener) => getStorage().addOnValueChangedListener(listener),
  clearAll: () => getStorage().clearAll(),
  contains: (key) => getStorage().contains(key),
  delete: (key) => getStorage().delete(key),
  getAllKeys: () => getStorage().getAllKeys(),
  getBoolean: (key) => getStorage().getBoolean(key),
  getNumber: (key) => getStorage().getNumber(key),
  getString: (key) => getStorage().getString(key),
  set: (key, value) => getStorage().set(key, value),
};

/**
 * Safely parse persisted JSON values during startup.
 * Never throws to keep app bootstrap crash-free.
 * @template T
 * @param {string | undefined} rawValue
 * @param {T} fallbackValue
 * @param {string} key
 * @returns {T}
 */
const safeJsonParse = (rawValue, fallbackValue, key) => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn('[BOOT] APP_CONTEXT_PARSE_FAILED', {
      error: error?.message || 'unknown',
      key,
      rawValuePreview: rawValue.slice(0, 120),
    });
    return fallbackValue;
  }
};

const getStoredJson = (key, fallbackValue) => {
  if (!storage.contains(key)) return fallbackValue;
  return safeJsonParse(storage.getString(key), fallbackValue, key);
};

const MAX_PERSISTED_STRING_LENGTH = 250000;

/**
 * Safely stringify values before persisting to storage.
 * Returns undefined when serialization fails or becomes suspiciously large.
 * @param {string} key
 * @param {unknown} value
 * @returns {string | undefined}
 */
const safeJsonStringify = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string' || serialized.length === 0) {
      return undefined;
    }
    if (serialized.length > MAX_PERSISTED_STRING_LENGTH) {
      console.warn('[BOOT] APP_CONTEXT_STRINGIFY_SKIPPED_TOO_LARGE', {
        key,
        length: serialized.length,
      });
      return undefined;
    }
    return serialized;
  } catch (error) {
    console.warn('[BOOT] APP_CONTEXT_STRINGIFY_FAILED', {
      error: error?.message || 'unknown',
      key,
    });
    return undefined;
  }
};

/**
 * Normalize a persisted fcmToken value from legacy formats.
 * @param {string | undefined} rawValue
 * @returns {string | undefined}
 */
const normalizeStoredFcmToken = (rawValue) => {
  if (typeof rawValue !== 'string') return undefined;
  if (rawValue.length > 8192) return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string' && parsed.trim().length > 0 && parsed.length <= 8192) {
        return parsed;
      }
      return undefined;
    } catch (_error) {
      return undefined;
    }
  }

  return trimmed;
};

const storedAuth = getStoredJson('auth', undefined);
const storedAuthSessionsRaw = getStoredJson('authSessions', []);
const storedAuthSessions = Array.isArray(storedAuthSessionsRaw) ? storedAuthSessionsRaw : [];
const rawStoredFcmToken = storage.contains('fcmToken') ? storage.getString('fcmToken') : undefined;
const storedFcmToken = normalizeStoredFcmToken(rawStoredFcmToken);
if (storage.contains('fcmToken') && !storedFcmToken) {
  storage.delete('fcmToken');
}

/**
 * Initial state for the global application context.
 * @type {Store}
 */
const initStore = {
  auth: storedAuth,
  authSessions: (() => {
    if (storedAuthSessions.length === 0 && storedAuth) {
      return [storedAuth];
    }
    return storedAuthSessions;
  })(),
  clubFilters: undefined,
  eventFilters: undefined,
  fcmToken: storedFcmToken,
  isAddingAccount: false,
  mercatoFilters: undefined,
  onboardingViews: undefined,
  pendingNotification: null,
  reservationFilters: undefined,
  squadFilters: undefined,
  teamFilters: undefined,
  theme: storage.contains('theme') ? storage.getString('theme') : undefined,
};

/**
 * Set the token in local storage.
 * @param {string} key - The key to set in local storage.
 * @param {any} newValue - The value to set in local storage.
 */
const setPersistantState = (key, newValue) => {
  if (typeof newValue === 'string' && newValue.trim().length > 0 && newValue !== 'undefined') {
    storage.set(key, newValue);
  } else {
    storage.delete(key);
  }
};

/**
 * Provider for the global application context.
 * This provider wraps the application in a context provider, allowing components to
 * access the global state and dispatch function.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components.
 * @returns {import('react').ReactElement} The rendered component.
 */
function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initStore);

  useEffect(() => {
    console.info('[BOOT] BOOT_STORE_READY', {
      hasAuth: Boolean(state.auth),
      sessionCount: Array.isArray(state.authSessions) ? state.authSessions.length : 0,
      storageBackend,
    });
    // We only need this marker once at bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPersistantState('auth', safeJsonStringify('auth', state.auth));
    setPersistantState('authSessions', safeJsonStringify('authSessions', state.authSessions));
    setPersistantState(
      'fcmToken',
      typeof state.fcmToken === 'string' ? state.fcmToken.trim() : undefined,
    );
    setPersistantState('theme', state.theme);
  }, [state]);

  useEffect(() => {
    const listener = storage.addOnValueChangedListener((changedKey) => {
      if (changedKey === 'auth') {
        const newValue = storage.getString(changedKey);
        if (!newValue) {
          dispatch({ type: 'DELETE_AUTHENTICATION' });
        }
      }
    });
    return () => listener.remove();
  });

  const contextValue = React.useMemo(() => state, [state]);
  const dispatchValue = React.useMemo(() => dispatch, []);

  return (
    <AppStateContext.Provider value={contextValue}>
      <AppDispatchContext.Provider value={dispatchValue}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

/**
 * Custom hook for accessing the global application context and dispatch function.
 *
 * This hook simplifies the process of accessing the global state and dispatch function
 * from the application's context. It returns an array containing the current state
 * and the dispatch function, allowing components to read from the global state and
 * dispatch actions to modify it.
 * @returns {[Store, AppContextDispatch]}
 * state object and the second element is the dispatch function to update the state.
 */
const useAppContext = () => [useContext(AppStateContext), useContext(AppDispatchContext)];

export {
  AppDispatchContext,
  AppProvider,
  AppStateContext,
  useAppContext,
};
