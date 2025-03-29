import {
  useState, createContext, useContext, useMemo, useCallback,
} from 'react';
// style
import generateColors from './colors';
import generateFonts from './fonts';
import generateApplicationStyle from './applicationStyle';
import generateImages from './images';
import Spaces from './spaces';
import Alignments from './alignements';
// hooks
import { useAppContext } from '../store/appContext';

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
    scheme: schemeToUse,
    Colors: colors,
    Fonts: generateFonts(colors),
    Spaces,
    Alignments,
    ApplicationStyle: generateApplicationStyle(colors),
    Images: images,
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
      appDispatch({ type: 'SET_THEME', payload: schemeToChange });
      setTheme(getThemeFn(schemeToChange));
    }, [defaultScheme, setTheme, appDispatch]);

  const contextValue = useMemo(
    () => ({ theme, changeTheme, scheme: theme.scheme }),
    [theme, changeTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {theme && children}
    </ThemeContext.Provider>
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
  const { theme, changeTheme, scheme } = useContext(ThemeContext);
  return { ...theme, changeTheme, scheme };
};

export default useTheme;
