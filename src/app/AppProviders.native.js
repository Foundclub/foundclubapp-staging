import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TourGuideLayer from '@/components/molecules/tour/TourGuideLayer';

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
          {/* TUTOE-2 : le guide APRÈS les feuilles gorhom (leur hôte de portail
              est le dernier enfant du fournisseur) ⇒ voile et bulle par-dessus
              une feuille ouverte, sur iOS comme sur Android. */}
          <TourGuideLayer />
        </SharedAppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default AppProvidersNative;
