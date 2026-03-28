import React from 'react';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import { storageBackend } from '@/platform/storage';
import useTheme from '@/theme/themeContext';

export const storage = {
  getString: (key) => storageBackend.getString(key),
  set: (key, value) => storageBackend.set(key, value),
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

  return React.createElement(
    AppModeContext.Provider,
    { value: contextValue },
    children,
  );
}

/**
 * Hook to use App Mode
 */
export const useAppMode = () => useContext(AppModeContext);
