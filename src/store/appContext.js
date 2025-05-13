import React, { useContext, useEffect, useReducer } from 'react';
import { MMKV } from 'react-native-mmkv';

import appReducer from '@/store/appReducer';

const AppStateContext = React.createContext(/** @type {Store} */ ({}));
const AppDispatchContext = React
  .createContext(/** @type {React.Dispatch<{ type: AppContextTypes; payload?: any; }>} */ ({}));

export const storage = new MMKV();

/**
 * Initial state for the global application context.
 * @type {Store}
 */
const initStore = {
  auth: storage.contains('auth') ? JSON.parse(storage.getString('auth') || '') : undefined,
  clubFilters: undefined,
  eventFilters: undefined,
  fcmToken: storage.contains('fcmToken') ? storage.getString('fcmToken') : undefined,
  onboardingViews: undefined,
  teamFilters: undefined,
  theme: storage.contains('theme') ? storage.getString('theme') : undefined,
};

/**
 * Set the token in local storage.
 * @param {string} key - The key to set in local storage.
 * @param {any} newValue - The value to set in local storage.
 */
const setPersistantState = (key, newValue) => {
  if (newValue && newValue !== 'undefined') {
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
    setPersistantState('auth', JSON.stringify(state.auth));
    setPersistantState('fcmToken', JSON.stringify(state.fcmToken));
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

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
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
