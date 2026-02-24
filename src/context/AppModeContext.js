import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { MMKV } from 'react-native-mmkv';

import useTheme from '@/theme/themeContext';

const inMemoryStorageMap = new Map();
const fallbackStorage = {
  getString: (key) => {
    const value = inMemoryStorageMap.get(key);
    return typeof value === 'string' ? value : undefined;
  },
  set: (key, value) => inMemoryStorageMap.set(key, value),
};

let storageInstance = null;
const getModeStorage = () => {
  if (storageInstance) return storageInstance;
  try {
    storageInstance = new MMKV();
  } catch (error) {
    console.warn('[AppModeContext] MMKV unavailable, using in-memory fallback storage.', error);
    storageInstance = fallbackStorage;
  }
  return storageInstance;
};

export const storage = {
  getString: (key) => getModeStorage().getString(key),
  set: (key, value) => getModeStorage().set(key, value),
};

const STORAGE_KEY = 'user.app_mode';

/**
 * @typedef {'classic' | 'gold'} AppMode
 */

/**
 * App Mode Context
 * @type {React.Context<{mode: AppMode, toggleMode: () => void, isGold: boolean}>}
 */
const AppModeContext = createContext({});

/**
 * AppModeProvider component
 * @param {object} props
 * @param {React.ReactNode} props.children
 */
export function AppModeProvider({ children }) {
  const { changeTheme } = useTheme();

  const getInitialMode = () => {
    const storedMode = storage.getString(STORAGE_KEY);
    return storedMode === 'gold' ? 'gold' : 'classic';
  };

  // Persisted mode between app restarts
  const [mode, setMode] = useState(getInitialMode);

  // Sync theme with mode
  useEffect(() => {
    if (mode === 'gold') {
      changeTheme('dark');
    } else {
      changeTheme('dark');
    }
  }, [mode, changeTheme]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const newMode = prev === 'classic' ? 'gold' : 'classic';
      storage.set(STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  const contextValue = useMemo(() => ({
    isGold: mode === 'gold',
    mode,
    toggleMode,
  }), [mode, toggleMode]);

  return (
    <AppModeContext.Provider value={contextValue}>
      {children}
    </AppModeContext.Provider>
  );
}

/**
 * Hook to use App Mode
 */
export const useAppMode = () => useContext(AppModeContext);
