import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

const SEARCH_ROUTES = new Set([
  RouteNames.SearchClubs,
  RouteNames.SearchEvents,
  RouteNames.SearchRecruitment,
  RouteNames.SearchReservations,
]);

/**
 * Redirects stack-level search routes to tab-level search routes
 * so the bottom tab bar stays visible.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchRouteRedirect({ navigation, route }) {
  const { Alignments, Colors } = useTheme();

  useEffect(() => {
    const targetRoute = route?.name;
    if (!SEARCH_ROUTES.has(targetRoute)) {
      navigation.replace(RouteNames.HomeTab, {
        screen: RouteNames.Search,
      });
      return;
    }

    navigation.replace(RouteNames.HomeTab, {
      params: {
        params: route?.params,
        screen: targetRoute,
      },
      screen: RouteNames.Search,
    });
  }, [navigation, route?.name, route?.params]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.mainCenter]}
    >
      <ActivityIndicator color={Colors.primary500} size="large" />
    </ScreenContainer>
  );
}

export default SearchRouteRedirect;
