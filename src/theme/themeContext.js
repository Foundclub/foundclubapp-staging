import React from 'react';
import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

import { useAppContext } from '@/store/appContext';
import Alignments from '@/theme/alignements';
import generateApplicationStyle from '@/theme/applicationStyle';
import generateColors from '@/theme/colors';
import generateFonts from '@/theme/fonts';
import generateImages from '@/theme/images';
import Spaces from '@/theme/spaces';

/**
 * Get theme function.
 * @param {import('./types').ColorScheme} scheme
 * @param {import('./types').ColorScheme} [defaultScheme]
 * @inheritdoc
 */
const getThemeFn = (scheme = null, defaultScheme = null) => {
  const schemeToUse = scheme || defaultScheme;
  const colors = generateColors();
  const images = generateImages(schemeToUse);
  return {
    Alignments,
    ApplicationStyle: generateApplicationStyle(colors),
    Colors: colors,
    Fonts: generateFonts(colors),
    Images: images,
    scheme: schemeToUse,
    Spaces,
  };
};

/**
 * Theme context.
 * @type {React.Context<{theme: ReturnType<getThemeFn>,
 * changeTheme: (newTheme: import('./types').ColorScheme) =>
 * void,scheme: import('./types').ColorScheme}>}
 */
const ThemeContext = createContext(
  // eslint-disable-next-line max-len
  /** @type {{theme: ReturnType<getThemeFn>,changeTheme: (newTheme: import('./types').ColorScheme) => void,scheme: import('./types').ColorScheme}} */ ({}),
);

/**
 * ThemeProvider component.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The children of the component.
 * @returns {React.JSX.Element} The rendered component.
 */
export function ThemeProvider({ children }) {
  // hooks
  const defaultScheme = 'dark';
  const [, appDispatch] = useAppContext();

  const [theme, setTheme] = useState(
    /** @type {ReturnType<typeof getThemeFn>} */ (getThemeFn('dark')),
  );

  // eslint-disable-next-line function-paren-newline
  const changeTheme = useCallback(
    /**
     * Change theme function.
     * @param {import('./types').ColorScheme} [newScheme] - The new color scheme.
     * @returns {void} - The return void.
     */
    (newScheme = null) => {
      const schemeToChange = newScheme || defaultScheme;
      appDispatch({ payload: schemeToChange, type: 'SET_THEME' });
      setTheme(getThemeFn(schemeToChange));
    }, [defaultScheme, setTheme, appDispatch]);

  const contextValue = useMemo(
    () => ({ changeTheme, scheme: theme.scheme, theme }),
    [theme, changeTheme],
  );

  return React.createElement(
    ThemeContext.Provider,
    { value: contextValue },
    theme ? children : null,
  );
}

/**
 * Custom hook for accessing the theme and theme-related functions.
 *
 * This hook simplifies the process of accessing the global state and dispatch function
 * from the application's context. It returns an array containing the current state
 * and the dispatch function, allowing components to read from the global state and
 * dispatch actions to modify it.
 * @inheritdoc
 */
const useTheme = () => {
  const { changeTheme, scheme, theme } = useContext(ThemeContext);
  return { ...theme, changeTheme, scheme };
};

export default useTheme;
