import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  MutationCache, QueryCache, QueryClient, QueryClientProvider,
} from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
// hooks
import { ThemeProvider } from './theme/themeContext';
import { AppProvider } from './store/appContext';
// navigation components
import AppNavigator from './navigation/appNavigator';
// views
import ErrorScreen from './views/EXAMPLE-Error';

Sentry.init({
  dsn: '',
});

// Reactotron configuration to debug app
if (__DEV__) {
  // eslint-disable-next-line global-require
  require('../ReactotronConfig');
}

// create react query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
      throwOnError: false, // TODO find a way to handle this properly
    },
  },
  mutationCache: new MutationCache({
    onError:
    /**
     * Function to handle error on mutation.
     * @param {any} error - The error object.
     * @param {object} variables - The variables object.
     * @param {object} context - The context object.
     * @param {import('@tanstack/react-query').Mutation} mutation - The mutation object.
     * @returns {void} - Void.
     */
    (error, variables, context, mutation) => {
      // eslint-disable-next-line no-console
      console.error('Query error', error);
      if (!mutation?.options?.meta?.preventToastError) {
        // Handle error and show Alert
        // TODO: handle error properly
        // displayErrorAlert(
        //   error.error || error.message,
        //   mutation?.options?.meta?.errorMessageFallback?.toString(),
        // );
      }
    },
  }),

  queryCache: new QueryCache({
    onError:
    /**
     * Function to handle error on query.
     * @param {any} error - The error object.
     * @param {import('@tanstack/react-query').Query} query - The query object.
     * @returns {void} - Void.
     */
    (error, query) => {
      // eslint-disable-next-line no-console
      console.error('Query error', error);
      if (!query?.options?.meta?.preventToastError) {
        // Handle error and show Alert
        // TODO: handle error properly
        // displayErrorAlert(
        //   error.error || error.message,
        //   query?.options?.meta?.errorMessageFallback?.toString(),
        // );
      }
      throw (error);
    },
  }),

});

/**
 * App root component.
 * @returns {import('react').ReactElement} App root component.
 */
function App() {
  return (
    <GestureHandlerRootView>
      <AppProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <Sentry.ErrorBoundary fallback={<ErrorScreen />} showDialog>
              <AppNavigator />
            </Sentry.ErrorBoundary>
          </QueryClientProvider>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
