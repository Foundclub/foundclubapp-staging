import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SharedAppProviders from './AppProviders.shared';

/**
 * Native runtime provider stack.
 * @param {object} props
 * @param {import('@tanstack/react-query').QueryClient} props.queryClient
 * @param {React.ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function AppProvidersNative({ children, queryClient }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SharedAppProviders queryClient={queryClient}>
          <BottomSheetModalProvider>
            {children}
          </BottomSheetModalProvider>
        </SharedAppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default AppProvidersNative;
