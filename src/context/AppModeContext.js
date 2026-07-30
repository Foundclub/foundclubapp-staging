import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import useTheme from '@/theme/themeContext';

import { storageBackend } from '@/platform/storage';

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
 * @type {React.Context<{
 *   mode: AppMode,
 *   setMode: (mode: AppMode) => void,
 *   toggleMode: () => void,
 *   isGold: boolean
 * }>}
 */
const AppModeContext = createContext({});

/**
 * AppModeProvider component
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {React.ReactElement}
 */
export function AppModeProvider({ children }) {
  const { changeTheme } = useTheme();

  const getInitialMode = () => {
    const storedMode = storage.getString(STORAGE_KEY);
    return storedMode === 'gold' ? 'gold' : 'classic';
  };

  // Persisted mode between app restarts
  const [mode, setModeState] = useState(getInitialMode);

  // Le thème ne dépend PAS du mode : les deux branches d'un `if (mode === 'gold')`
  // appelaient toutes les deux `changeTheme('dark')`. La condition était décorative
  // et se relisait comme un choix qui n'existait pas — aplatie le 2026-07-30
  // (audit LEAGUE, défaut G13).
  // `mode` reste dans les dépendances à dessein : on ré-affirme le thème sombre à
  // chaque bascule de mode, exactement comme avant. Le jour où le mode « gold »
  // méritera son propre thème, c'est ici qu'il se branche.
  useEffect(() => {
    changeTheme('dark');
  }, [mode, changeTheme]);

  const setMode = useCallback((nextMode) => {
    const normalizedMode = nextMode === 'gold' ? 'gold' : 'classic';
    storage.set(STORAGE_KEY, normalizedMode);
    setModeState(normalizedMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const newMode = prev === 'classic' ? 'gold' : 'classic';
      storage.set(STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  const contextValue = useMemo(() => ({
    isGold: mode === 'gold',
    mode,
    setMode,
    toggleMode,
  }), [mode, setMode, toggleMode]);

  return React.createElement(
    AppModeContext.Provider,
    { value: contextValue },
    children,
  );
}

/**
 * Hook to use App Mode.
 * @returns {React.ContextType<typeof AppModeContext>}
 */
export const useAppMode = () => useContext(AppModeContext);
