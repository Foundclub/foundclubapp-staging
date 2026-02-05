
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { MMKV } from 'react-native-mmkv';
import useTheme from '@/theme/themeContext';

// Initialize MMKV
export const storage = new MMKV();

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

  // Load initial mode - defaults to 'classic' per user request (always start in classic)
  const [mode, setMode] = useState('classic');

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
    mode,
    isGold: mode === 'gold',
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
