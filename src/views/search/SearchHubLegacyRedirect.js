import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { resolveLegacySearchTarget } from './searchRouteHelpers';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchHubLegacyRedirect({ navigation, route }) {
  const { Alignments, Colors } = useTheme();
  const { userData } = useAuth();

  useEffect(() => {
    const target = resolveLegacySearchTarget(route?.params, userData);

    if (!target) {
      navigation.replace(RouteNames.SearchEvents);
      return;
    }

    navigation.replace(target.routeName, target.params);
  }, [navigation, route?.params, userData]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.mainCenter]}
    >
      <ActivityIndicator color={Colors.primary500} size="large" />
    </ScreenContainer>
  );
}

export default SearchHubLegacyRedirect;
