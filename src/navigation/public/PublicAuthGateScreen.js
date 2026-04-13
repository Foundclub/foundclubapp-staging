import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { View } from 'react-native';

import { openPublicAuthFlow } from './publicAuthNavigation';

/**
 * Minimal fallback screen for protected public tabs.
 * The primary path is tabPress interception; this screen only covers direct navigation edge cases.
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 * @param {any} route
 * @returns {import('react').ReactElement}
 */
function PublicAuthGateScreen({ navigation, route }) {
  useFocusEffect(
    useCallback(() => {
      openPublicAuthFlow(navigation, {
        origin: route?.name,
        source: 'public-tab-fallback',
      });
    }, [navigation, route?.name]),
  );

  return <View style={{ flex: 1 }} />;
}

export default PublicAuthGateScreen;
